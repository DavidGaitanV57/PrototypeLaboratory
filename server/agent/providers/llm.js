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
  const causeMsg = String(err.cause?.message || "");
  return (
    /fetch failed|network|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket|TLS|undici|other side closed|terminated|timeout|UND_ERR/i.test(
      msg,
    ) ||
    /ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|UND_ERR/i.test(String(code)) ||
    /ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|socket|TLS|UND_ERR/i.test(causeMsg)
  );
}

/** Undici often wraps the real reason in err.cause — surface it in the UI. */
function formatNetworkErr(err, fallback = "fetch failed") {
  const top = String(err?.message || fallback).trim() || fallback;
  const cause = err?.cause;
  if (!cause) return top;
  const bit = String(cause.code || cause.message || cause).trim();
  if (!bit || top.includes(bit)) return top;
  return `${top} (${bit})`;
}

const MAX_NETWORK_RETRIES = 14;

function backoffMs(attempt) {
  const exp = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.min(attempt - 1, 6));
  const jitter = Math.floor(Math.random() * 400);
  return exp + jitter;
}

/** Newer OpenAI models cannot use function tools on chat/completions. */
function modelNeedsResponsesApi(model) {
  const id = String(model || "")
    .toLowerCase()
    .replace(/^openai\//, "");
  return /^(gpt-5|gpt-6|o1|o3|o4)([\-./]|$)/.test(id);
}

function isOpenAiHost(url) {
  try {
    return /openai\.com$/i.test(new URL(url).hostname.replace(/^www\./, ""));
  } catch {
    return /openai\.com/i.test(String(url || ""));
  }
}

function wantsResponsesApi(detail) {
  const text = String(detail || "");
  return /\/v1\/responses/i.test(text) || (/function tools/i.test(text) && /reasoning_effort/i.test(text));
}

/**
 * Cap tool read payloads so multi-turn Generate Final does not re-send huge runtime/TDD dumps.
 * Runtime sources are intentionally tiny — agents should import kits, not paste APIs.
 */
function truncateToolRead(rel, body) {
  const text = String(body ?? "");
  const norm = String(rel || "").replace(/\\/g, "/");
  let max = 48_000;
  if (/^public\/runtime\//i.test(norm)) max = 6_000;
  else if (/^docs\/tdds\//i.test(norm)) max = 28_000;
  else if (/AGENTS\.md$/i.test(norm) || /^server\/agent\/prompts\//i.test(norm)) max = 4_000;
  if (text.length <= max) return text;
  return (
    `${text.slice(0, max)}\n\n` +
    `…(truncated ${text.length - max} chars from ${norm}; ` +
    `for runtime kits prefer import from /runtime/*.js — do not re-read full sources. ` +
    `For TDD, re-read only if you still need a specific section.)`
  );
}

function chatToolsToResponses(tools) {
  return (tools || []).map((t) => ({
    type: "function",
    name: t.function?.name,
    description: t.function?.description || "",
    parameters: t.function?.parameters || { type: "object", properties: {} },
  }));
}

/**
 * Read an OpenAI-compatible SSE chat.completions stream into one message.
 * Streaming keeps gateways (esp. Kimi Code) from closing idle non-stream connections
 * while the model thinks / emits a long tool-call turn.
 */
async function readChatCompletionStream(res) {
  if (!res.body || typeof res.body.getReader !== "function") {
    return res.json();
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let role = "assistant";
  let content = "";
  /** @type {Array<{ id: string, type: string, function: { name: string, arguments: string } }>} */
  const toolCalls = [];
  let finishReason = null;
  let usage = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(":")) continue;
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      let json;
      try {
        json = JSON.parse(payload);
      } catch {
        continue;
      }
      if (json.usage) usage = json.usage;
      const choice = json.choices?.[0];
      if (!choice) continue;
      if (choice.finish_reason) finishReason = choice.finish_reason;
      const delta = choice.delta || choice.message || {};
      if (delta.role) role = delta.role;
      if (typeof delta.content === "string") content += delta.content;
      if (Array.isArray(delta.tool_calls)) {
        for (const tc of delta.tool_calls) {
          const idx = Number.isInteger(tc.index) ? tc.index : toolCalls.length;
          if (!toolCalls[idx]) {
            toolCalls[idx] = {
              id: "",
              type: "function",
              function: { name: "", arguments: "" },
            };
          }
          const slot = toolCalls[idx];
          if (tc.id) slot.id = tc.id;
          if (tc.type) slot.type = tc.type;
          if (tc.function?.name) slot.function.name += tc.function.name;
          if (typeof tc.function?.arguments === "string") {
            slot.function.arguments += tc.function.arguments;
          }
        }
      }
    }
  }

  const calls = toolCalls.filter((c) => c && (c.id || c.function?.name));
  return {
    choices: [
      {
        message: {
          role,
          content: content || null,
          ...(calls.length ? { tool_calls: calls } : {}),
        },
        finish_reason: finishReason,
      },
    ],
    ...(usage ? { usage } : {}),
  };
}

function messagesToResponsesInput(messages) {
  let instructions = "";
  const input = [];
  for (const m of messages || []) {
    if (m.role === "system") {
      const text = String(m.content || "").trim();
      if (text) instructions = instructions ? `${instructions}\n\n${text}` : text;
      continue;
    }
    if (m.role === "user") {
      if (Array.isArray(m.content)) {
        const parts = [];
        for (const part of m.content) {
          if (!part) continue;
          if (part.type === "text" || typeof part.text === "string") {
            parts.push({ type: "input_text", text: String(part.text || "") });
          } else if (part.type === "image_url") {
            const url = part.image_url?.url || part.image_url || "";
            if (url) parts.push({ type: "input_image", image_url: url });
          }
        }
        input.push({ role: "user", content: parts.length ? parts : String(m.content) });
      } else {
        input.push({ role: "user", content: String(m.content || "") });
      }
      continue;
    }
    if (m.role === "assistant") {
      if (m.content) input.push({ role: "assistant", content: String(m.content) });
      for (const call of m.tool_calls || []) {
        input.push({
          type: "function_call",
          call_id: call.id,
          name: call.function?.name,
          arguments: call.function?.arguments || "{}",
        });
      }
      continue;
    }
    if (m.role === "tool") {
      input.push({
        type: "function_call_output",
        call_id: m.tool_call_id,
        output: String(m.content ?? ""),
      });
    }
  }
  return { instructions, input };
}

function userMessageContent(prompt, images = []) {
  const text = String(prompt || "");
  if (!Array.isArray(images) || !images.length) return text;
  const parts = [{ type: "text", text }];
  for (const img of images.slice(0, 3)) {
    const mime = String(img.mimeType || "image/png");
    const data = String(img.data || "").replace(/\s+/g, "");
    if (!data) continue;
    // ~375KB binary — larger payloads often reset the provider connection.
    if (data.length > 500_000) {
      parts.push({
        type: "text",
        text: `(screenshot omitted — too large for this provider; re-paste or use 📎 with a smaller shot)`,
      });
      continue;
    }
    parts.push({
      type: "image_url",
      image_url: { url: `data:${mime};base64,${data}` },
    });
  }
  return parts.length > 1 ? parts : text;
}

function pendingFunctionOutputs(messages) {
  const outputs = [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m.role !== "tool") break;
    outputs.unshift({
      type: "function_call_output",
      call_id: m.tool_call_id,
      output: String(m.content ?? ""),
    });
  }
  return outputs;
}

function normalizeResponsesPayload(data) {
  const output = Array.isArray(data?.output) ? data.output : [];
  const texts = [];
  const tool_calls = [];
  for (const item of output) {
    if (item?.type === "function_call") {
      tool_calls.push({
        id: item.call_id || item.id,
        type: "function",
        function: {
          name: item.name,
          arguments:
            typeof item.arguments === "string" ? item.arguments : JSON.stringify(item.arguments || {}),
        },
      });
    } else if (item?.type === "message") {
      for (const part of item.content || []) {
        if (typeof part?.text === "string" && part.text) texts.push(part.text);
      }
    } else if (item?.type === "output_text" && item.text) {
      texts.push(item.text);
    }
  }
  if (!texts.length && typeof data?.output_text === "string" && data.output_text) texts.push(data.output_text);
  const content = texts.join("\n").trim();
  return {
    id: data?.id,
    usage: data?.usage,
    choices: [
      {
        message: {
          role: "assistant",
          content: content || null,
          ...(tool_calls.length ? { tool_calls } : {}),
        },
      },
    ],
  };
}

function cloneMessages(messages) {
  return JSON.parse(JSON.stringify(messages || []));
}

/** Ensure every assistant tool_call has a matching tool result (API requires it). */
function sealToolResults(messages) {
  const out = cloneMessages(messages);
  const pending = new Set();
  for (const m of out) {
    if (m.role === "assistant" && Array.isArray(m.tool_calls)) {
      for (const c of m.tool_calls) {
        if (c?.id) pending.add(c.id);
      }
    }
    if (m.role === "tool" && m.tool_call_id) pending.delete(m.tool_call_id);
  }
  for (const id of pending) {
    out.push({
      role: "tool",
      tool_call_id: id,
      content: "ERROR: Stopped by user before tool finished",
    });
  }
  return out;
}

/**
 * OpenAI-compatible tool-calling provider.
 * Keeps going through transient network/API failures until the model finishes
 * or the operator hits Stop. Snapshots messages for Continue-after-Stop.
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
  /** @type {{ messages: object[], turn: number, writeMode: string, model: string, at: number } | null} */
  let checkpoint = null;

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
  const tools = writeMode === "ask" || writeMode === "plan" ? readTools : [...readTools, writeTool];

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
      const body = await fs.readFile(abs, "utf8");
      return truncateToolRead(rel, body);
    }
    if (name === "write_file") {
      assertAgentWriteAllowed(rel, writeMode, { slug });
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, args.content ?? "", "utf8");
      return `Wrote ${rel}`;
    }
    throw new Error(`Unknown tool ${name}`);
  }

  function saveCheckpoint(messages, turn) {
    checkpoint = {
      messages: sealToolResults(messages),
      turn: Math.max(1, turn || 1),
      writeMode,
      model,
      at: Date.now(),
    };
  }

  return {
    id: "llm",
    supportsCheckpoint: true,
    getCheckpoint() {
      return checkpoint ? { ...checkpoint, messages: cloneMessages(checkpoint.messages) } : null;
    },
    clearCheckpoint() {
      checkpoint = null;
    },
    async run(prompt, { onEvent, signal, resumeMessages, resumeTurn, images } = {}) {
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
      const apiRoot = baseUrl.replace(/\/$/, "");
      const chatEndpoint = `${apiRoot}/chat/completions`;
      const responsesEndpoint = `${apiRoot}/responses`;
      let useResponses = modelNeedsResponsesApi(model) && isOpenAiHost(apiRoot);
      let lastResponseId = null;
      let droppedResponseId = false;
      const resuming = Array.isArray(resumeMessages) && resumeMessages.length >= 2;

      const messages = resuming
        ? sealToolResults(resumeMessages)
        : [
            {
              role: "system",
              content:
                writeMode === "ask"
                  ? "You answer questions about an existing playable prototype. Read-only tools only. Match answer length to the question: short factual questions get short human answers — no file dumps, audits, or verification checklists unless asked."
                  : writeMode === "plan"
                    ? "You write a short implementation plan as JSON for an existing playable. Read-only tools only. No file edits. No code samples. End with the JSON object (title, goal, approach, steps[{id,file,title,detail}], risks, verify)."
                    : "You are a gameplay prototyping agent. Use tools to read/write files. Obey write policy in the user prompt. Keep working until the task is complete — do not stop early.",
            },
            { role: "user", content: userMessageContent(prompt, images) },
          ];

      if (resuming) {
        messages.push({
          role: "user",
          content:
            "Continue from this checkpoint. Finish remaining work. Do not redo completed writes unless they are broken.",
        });
      }

      let turn = resuming ? Math.max(0, Number(resumeTurn) || 0) : 0;
      saveCheckpoint(messages, Math.max(1, turn || 1));

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

      const emitCancelled = () => {
        saveCheckpoint(messages, turn);
        onEvent?.({
          type: "checkpoint",
          resumable: true,
          turn: checkpoint.turn,
          writeMode,
          model,
        });
        emitBenchmark("cancelled");
        onEvent?.({ type: "done", status: "cancelled", resumable: true });
      };

      function responsesBody() {
        const shared = {
          model,
          tools: chatToolsToResponses(tools),
          reasoning: { effort: "low" },
          store: true,
        };
        const outputs = lastResponseId ? pendingFunctionOutputs(messages) : [];
        if (lastResponseId && outputs.length) {
          return {
            ...shared,
            previous_response_id: lastResponseId,
            input: outputs,
          };
        }
        const { instructions, input } = messagesToResponsesInput(messages);
        return {
          ...shared,
          ...(instructions ? { instructions } : {}),
          input: input.length ? input : "",
        };
      }

      async function fetchCompletion(turnNo) {
        let attempt = 0;
        let switchedToResponses = false;
        let forceNonStream = false;
        while (!aborted) {
          attempt += 1;
          const turnAc = new AbortController();
          const timer = setTimeout(() => turnAc.abort(), TURN_FETCH_TIMEOUT_MS);
          const onCancel = () => turnAc.abort();
          ac.signal.addEventListener("abort", onCancel);

          try {
            const useStream = !useResponses && !forceNonStream;
            const res = await fetch(useResponses ? responsesEndpoint : chatEndpoint, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(
                useResponses
                  ? responsesBody()
                  : {
                      model,
                      messages,
                      tools,
                      tool_choice: "auto",
                      ...(useStream ? { stream: true } : {}),
                    },
              ),
              signal: turnAc.signal,
            });

            if (!res.ok) {
              const errText = await res.text();
              if (
                useStream &&
                !forceNonStream &&
                (/stream/i.test(errText) || res.status === 400)
              ) {
                forceNonStream = true;
                onEvent?.({
                  type: "status",
                  message: "Provider rejected stream — retrying without stream…",
                });
                continue;
              }
              if (!useResponses && !switchedToResponses && wantsResponsesApi(errText)) {
                useResponses = true;
                switchedToResponses = true;
                onEvent?.({
                  type: "status",
                  message: "Model needs /v1/responses for tools — retrying…",
                });
                continue;
              }
              if (
                useResponses &&
                lastResponseId &&
                !droppedResponseId &&
                /previous_response_id/i.test(errText)
              ) {
                lastResponseId = null;
                droppedResponseId = true;
                onEvent?.({
                  type: "status",
                  message: "Stored response expired — retrying with full history…",
                });
                continue;
              }
              const httpErr = new Error(`LLM HTTP ${res.status}: ${errText.slice(0, 400)}`);
              httpErr.status = res.status;
              if (isRetryableHttp(res.status) && !aborted) {
                if (attempt > MAX_NETWORK_RETRIES) throw httpErr;
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

            if (useResponses) {
              const data = await res.json();
              const normalized = normalizeResponsesPayload(data);
              if (normalized.id) lastResponseId = normalized.id;
              return normalized;
            }

            if (useStream) {
              return await readChatCompletionStream(res);
            }
            return await res.json();
          } catch (err) {
            if (aborted || ac.signal.aborted || isAbortError(err)) {
              throw Object.assign(new Error("Stopped"), { name: "AbortError" });
            }
            if (isRetryableNetwork(err) || turnAc.signal.aborted) {
              if (attempt > MAX_NETWORK_RETRIES) {
                throw new Error(
                  `${formatNetworkErr(err)}. Gave up after ${attempt} tries on turn ${turnNo}. ` +
                    `Long Generate Final turns often drop on Kimi without streaming — retry, Continue from checkpoint, or use Cursor.`,
                );
              }
              const wait = backoffMs(attempt);
              const why =
                turnAc.signal.aborted && !ac.signal.aborted
                  ? "request timed out"
                  : formatNetworkErr(err);
              onEvent?.({
                type: "status",
                message: `${why} — retry ${attempt} in ${(wait / 1000).toFixed(1)}s (turn ${turnNo}, Stop to cancel)`,
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
        if (resuming) {
          onEvent?.({
            type: "status",
            message: `Resuming checkpoint · ${model} · turn ${turn || 1}+`,
          });
        }

        while (!aborted) {
          turn += 1;
          onEvent?.({
            type: "status",
            message:
              turn === 1 && !resuming ? `LLM · ${model}` : `LLM turn ${turn}…`,
          });
          saveCheckpoint(messages, turn);

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
          saveCheckpoint(messages, turn);

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
            checkpoint = null;
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
              content: String(result).slice(0, 48_000),
            });
          }
          saveCheckpoint(messages, turn);
        }

        emitCancelled();
        return { status: "cancelled", resumable: true };
      } catch (err) {
        if (aborted || isAbortError(err)) {
          emitCancelled();
          return { status: "cancelled", resumable: true };
        }
        saveCheckpoint(messages, turn);
        const raw = String(err?.message || err || "");
        const hadImages = Array.isArray(images) && images.length > 0;
        const nicer =
          hadImages && isRetryableNetwork(err)
            ? `Provider network error while sending screenshot(s): ${raw.slice(0, 200)}. Try a smaller paste, 📎, or a vision model (OpenAI/Anthropic).`
            : raw;
        emitBenchmark("error", nicer);
        throw new Error(nicer);
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
