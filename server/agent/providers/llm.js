import fs from "node:fs/promises";
import path from "node:path";
import { assertAgentWriteAllowed } from "../writePolicy.js";
import {
  canonicalizeRel,
  isSensitiveRel,
  resolveWithinRoot,
} from "../../security/paths.js";
import { createRunMeter } from "../runMeter.js";

/** Per-request hang limit — then retry (does not end the run). */
const TURN_FETCH_TIMEOUT_MS = 12 * 60 * 1000;
const RETRY_BASE_MS = 1500;
const RETRY_MAX_MS = 45_000;

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
      return;
    }
    const t = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
    };
    signal?.addEventListener?.("abort", onAbort, { once: true });
  });
}

function isAbortError(err) {
  if (!err) return false;
  if (err.name === "AbortError") return true;
  const msg = String(err.message || err);
  return /aborted|AbortError/i.test(msg);
}

function isRetryableHttp(status) {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function isRetryableNetwork(err) {
  if (!err || isAbortError(err)) return false;
  const msg = String(err.message || err);
  const code = err.code || err.cause?.code || "";
  return (
    /fetch failed|network|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket|TLS|undici|other side closed|terminated|timeout|UND_ERR/i.test(
      msg,
    ) ||
    /ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|UND_ERR/i.test(String(code))
  );
}

function backoffMs(attempt) {
  const exp = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.min(attempt - 1, 6));
  const jitter = Math.floor(Math.random() * 400);
  return exp + jitter;
}

/**
 * OpenAI-compatible tool-calling provider.
 * Keeps going through transient network/API failures until the model finishes
 * or the operator hits Stop.
 */
export function createLlmProvider({
  root,
  apiKey,
  baseUrl = "https://api.openai.com/v1",
  model = "gpt-4o-mini",
  writeMode = "generate",
  slug,
}) {
  let aborted = false;
  const ctrl = { current: null };

  const readTools = [
    {
      type: "function",
      function: {
        name: "list_dir",
        description: "List files in a relative directory",
        parameters: {
          type: "object",
          properties: { path: { type: "string" } },
          required: ["path"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "read_file",
        description: "Read a UTF-8 text file relative to project root",
        parameters: {
          type: "object",
          properties: { path: { type: "string" } },
          required: ["path"],
        },
      },
    },
  ];
  const writeTool = {
    type: "function",
    function: {
      name: "write_file",
      description: "Write a UTF-8 text file (subject to write policy)",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "content"],
      },
    },
  };
  const tools = writeMode === "ask" ? readTools : [...readTools, writeTool];

  async function execTool(name, args) {
    const rel = canonicalizeRel(args.path || "");
    const abs = resolveWithinRoot(root, rel);

    if (name === "list_dir") {
      if (isSensitiveRel(rel)) throw new Error("Access denied");
      const ents = await fs.readdir(abs, { withFileTypes: true });
      return ents
        .filter((e) => !isSensitiveRel(`${rel}/${e.name}`))
        .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
        .join("\n");
    }
    if (name === "read_file") {
      if (isSensitiveRel(rel)) throw new Error("Access denied to sensitive file");
      return await fs.readFile(abs, "utf8");
    }
    if (name === "write_file") {
      assertAgentWriteAllowed(rel, writeMode, { slug });
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, args.content ?? "", "utf8");
      return `Wrote ${rel}`;
    }
    throw new Error(`Unknown tool ${name}`);
  }

  return {
    id: "llm",
    async run(prompt, { onEvent, signal } = {}) {
      aborted = false;
      const ac = new AbortController();
      ctrl.current = ac;
      const onParentAbort = () => {
        aborted = true;
        ac.abort();
      };
      if (signal?.aborted) onParentAbort();
      else signal?.addEventListener?.("abort", onParentAbort);

      const meter = createRunMeter();
      const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

      const messages = [
        {
          role: "system",
          content:
            writeMode === "ask"
              ? "You answer questions about an existing playable prototype. Read-only tools only. Match answer length to the question: short factual questions get short human answers — no file dumps, audits, or verification checklists unless asked."
              : "You are a gameplay prototyping agent. Use tools to read/write files. Obey write policy in the user prompt. Keep working until the task is complete — do not stop early.",
        },
        { role: "user", content: prompt },
      ];

      const emitBenchmark = (status, errorMessage) => {
        onEvent?.(
          meter.finish({
            provider: "llm",
            model,
            status,
            ...(errorMessage
              ? { errorMessage: String(errorMessage).slice(0, 800) }
              : {}),
          }),
        );
      };

      async function fetchCompletion(turn) {
        let attempt = 0;
        while (!aborted) {
          attempt += 1;
          const turnAc = new AbortController();
          const timer = setTimeout(() => turnAc.abort(), TURN_FETCH_TIMEOUT_MS);
          const onCancel = () => turnAc.abort();
          ac.signal.addEventListener("abort", onCancel);

          try {
            const res = await fetch(endpoint, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model,
                messages,
                tools,
                tool_choice: "auto",
              }),
              signal: turnAc.signal,
            });

            if (!res.ok) {
              const errText = await res.text();
              const httpErr = new Error(`LLM HTTP ${res.status}: ${errText.slice(0, 400)}`);
              httpErr.status = res.status;
              if (isRetryableHttp(res.status) && !aborted) {
                const wait = backoffMs(attempt);
                onEvent?.({
                  type: "status",
                  message: `API ${res.status} — retry ${attempt} in ${(wait / 1000).toFixed(1)}s (Stop to cancel)`,
                });
                await sleep(wait, ac.signal);
                continue;
              }
              throw httpErr;
            }

            return await res.json();
          } catch (err) {
            if (aborted || ac.signal.aborted || isAbortError(err)) {
              throw Object.assign(new Error("Stopped"), { name: "AbortError" });
            }
            // Per-turn timeout or transient network — keep the run alive
            if (isRetryableNetwork(err) || turnAc.signal.aborted) {
              const wait = backoffMs(attempt);
              const why = turnAc.signal.aborted && !ac.signal.aborted
                ? "request timed out"
                : err.message || "fetch failed";
              onEvent?.({
                type: "status",
                message: `${why} — retry ${attempt} in ${(wait / 1000).toFixed(1)}s (turn ${turn}, Stop to cancel)`,
              });
              await sleep(wait, ac.signal);
              continue;
            }
            throw err;
          } finally {
            clearTimeout(timer);
            ac.signal.removeEventListener("abort", onCancel);
          }
        }
        throw Object.assign(new Error("Stopped"), { name: "AbortError" });
      }

      try {
        let turn = 0;
        while (!aborted) {
          turn += 1;
          onEvent?.({
            type: "status",
            message: turn === 1 ? `LLM · ${model}` : `LLM turn ${turn}…`,
          });

          const data = await fetchCompletion(turn);
          meter.noteTurn(data.usage);
          const msg = data.choices?.[0]?.message;
          if (!msg) {
            onEvent?.({
              type: "status",
              message: "Empty LLM response — retrying…",
            });
            await sleep(backoffMs(1), ac.signal);
            continue;
          }
          messages.push(msg);

          if (msg.content) {
            const cleaned = String(msg.content)
              .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, "")
              .replace(/<\/?think\b[^>]*>/gi, "")
              .trim();
            const snippet = cleaned.replace(/\s+/g, " ").slice(0, 120);
            if (snippet.length >= 8) onEvent?.({ type: "status", message: snippet });
            if (cleaned) onEvent?.({ type: "assistant", text: cleaned });
          }

          const calls = msg.tool_calls || [];
          if (!calls.length) {
            emitBenchmark("finished");
            onEvent?.({ type: "done", status: "finished" });
            return data;
          }

          for (const call of calls) {
            if (aborted) break;
            const name = call.function?.name;
            let args = {};
            try {
              args = JSON.parse(call.function?.arguments || "{}");
            } catch {
              args = {};
            }
            const relPath = String(args.path || "").replace(/\\/g, "/");
            meter.noteTool();
            onEvent?.({ type: "tool", name, path: relPath || undefined, status: "call" });
            let result;
            try {
              result = await execTool(name, args);
              if (name === "write_file") {
                meter.noteFile();
                onEvent?.({ type: "file", path: args.path });
              }
            } catch (err) {
              result = `ERROR: ${err.message}`;
            }
            messages.push({
              role: "tool",
              tool_call_id: call.id,
              content: String(result).slice(0, 120000),
            });
          }
        }

        emitBenchmark("cancelled");
        onEvent?.({ type: "done", status: "cancelled" });
      } catch (err) {
        if (aborted || isAbortError(err)) {
          emitBenchmark("cancelled");
          onEvent?.({ type: "done", status: "cancelled" });
          return;
        }
        emitBenchmark("error", err?.message || err);
        throw err;
      } finally {
        signal?.removeEventListener?.("abort", onParentAbort);
      }
    },
    cancel() {
      aborted = true;
      ctrl.current?.abort?.();
    },
  };
}
