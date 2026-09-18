import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Agent } from "@cursor/sdk";
import { createRunMeter } from "../runMeter.js";

function toolPathFromEvent(event) {
  const raw =
    event?.toolCall?.arguments ??
    event?.arguments ??
    event?.input ??
    event?.params ??
    null;
  if (!raw) return "";
  let args = raw;
  if (typeof raw === "string") {
    try {
      args = JSON.parse(raw);
    } catch {
      return "";
    }
  }
  if (typeof args !== "object" || !args) return "";
  return String(args.path || args.file || args.target || "").replace(/\\/g, "/");
}

function usageFromResult(result) {
  if (!result || typeof result !== "object") return null;
  return (
    result.usage ||
    result.tokenUsage ||
    result.tokens ||
    result.info?.usage ||
    result.stats?.usage ||
    null
  );
}

/**
 * Cursor may stream either raw token deltas or growing message snapshots.
 * Never concatenate two snapshots of the same answer (breaks on markdown like
 * `**Biol**` → `**Biolum**`, which is not a strict string prefix).
 */
function absorbAssistantDelta(prev, next) {
  const a = String(prev || "");
  const b = String(next || "");
  if (!b) return a;
  if (!a) return b;
  if (b.startsWith(a)) return b;
  if (a.startsWith(b)) return a;
  if (b.length >= a.length) return b;
  if (b.length <= 32) return a + b;
  return a;
}

function errText(err) {
  if (!err) return "";
  if (typeof err === "string") return err;
  const parts = [err.message, err.cause?.message, err.code, err.cause?.code]
    .filter(Boolean)
    .map(String);
  return parts.join(" · ") || String(err);
}

/** Known flaky Cursor cloud handshake (forum: transient TCP/TLS/DNS after idle). */
function isCursorKeyExchangeError(err) {
  const t = errText(err);
  if (isTlsCertError(err)) return false;
  return /key exchange|exchange endpoint|ECONNRESET|ETIMEDOUT|ENOTFOUND|other side closed|UND_ERR/i.test(
    t,
  ) || (/fetch failed/i.test(t) && !/certificate|CERT_|SSL|TLS/i.test(t));
}

function isTlsCertError(err) {
  const t = errText(err);
  return /self[- ]signed certificate|certificate in certificate chain|UNABLE_TO_VERIFY_LEAF|CERT_HAS_EXPIRED|unable to verify the first certificate/i.test(
    t,
  );
}

function friendlyCursorError(err) {
  const raw = errText(err);
  if (isTlsCertError(err)) {
    return (
      `Cursor TLS error (${raw.slice(0, 120)}). The lab now starts with --use-system-ca; restart via npm start. ` +
      `If it persists: set NODE_EXTRA_CA_CERTS to your corporate root CA .pem before starting, or switch chat provider to OpenAI/Kimi for Agent edits.`
    );
  }
  if (isCursorKeyExchangeError(err)) {
    return (
      `Cursor could not reach its API key exchange endpoint (${raw.slice(0, 160)}). ` +
      `Retry Agent, check VPN/firewall/DNS, or switch chat provider to OpenAI/Kimi for edits.`
    );
  }
  return raw || "Cursor request failed";
}

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

async function disposeAgent(agent) {
  if (!agent) return;
  try {
    await agent[Symbol.asyncDispose]?.();
  } catch {
    /* */
  }
}

/**
 * Cursor SDK provider — local cwd agent. Model may be "auto" or a listed id.
 * @param {{ root: string, apiKey?: string, model?: string, writeMode?: string }} opts
 */
export function createCursorProvider({ root, apiKey, model, writeMode = "generate" }) {
  const key = apiKey || process.env.CURSOR_API_KEY;
  if (!key) {
    throw new Error("CURSOR_API_KEY missing. Set it in .env.");
  }
  const modelId = model || process.env.CURSOR_MODEL || "auto";
  const askMode = writeMode === "ask";
  const planMode = writeMode === "plan";

  let agent = null;
  let aborted = false;

  return {
    id: "cursor",
    supportsCheckpoint: false,
    getCheckpoint() {
      return null;
    },
    model: modelId,
    async run(prompt, { onEvent, signal, images } = {}) {
      aborted = false;
      const meter = createRunMeter();
      const onAbort = () => {
        aborted = true;
      };
      signal?.addEventListener?.("abort", onAbort);

      const emitBenchmark = (status, usage, errorMessage) => {
        if (usage && !meter.tokensKnown) meter.noteUsage(usage);
        onEvent?.(
          meter.finish({
            provider: "cursor",
            model: modelId,
            status,
            ...(errorMessage
              ? { errorMessage: String(errorMessage).slice(0, 800) }
              : {}),
          }),
        );
      };

      let imageNote = "";
      const attachList = Array.isArray(images) ? images.slice(0, 3) : [];
      if (attachList.length) {
        const saved = [];
        try {
          for (let i = 0; i < attachList.length; i += 1) {
            const img = attachList[i];
            if (img.relPath) {
              saved.push(String(img.relPath).replace(/\\/g, "/"));
              continue;
            }
            const dir = path.join(root, "sessions", "chat-attach", randomUUID());
            await fs.mkdir(dir, { recursive: true });
            const ext =
              /jpeg|jpg/i.test(img.mimeType || "")
                ? "jpg"
                : /webp/i.test(img.mimeType || "")
                  ? "webp"
                  : /gif/i.test(img.mimeType || "")
                    ? "gif"
                    : "png";
            const rel = path
              .join("sessions", "chat-attach", path.basename(dir), `shot-${i + 1}.${ext}`)
              .replace(/\\/g, "/");
            await fs.writeFile(
              path.join(dir, `shot-${i + 1}.${ext}`),
              Buffer.from(img.data, "base64"),
            );
            saved.push(rel);
          }
          imageNote = [
            "",
            "## User-attached screenshot(s)",
            "The operator attached gameplay screenshot(s) as visual evidence.",
            ...saved.map((p) => `- Image file on disk: ${p}`),
            "Open/read these image files if your tools support viewing images.",
            "If you cannot decode the image bytes, say so clearly and answer from the user's text + typical playable layout — do not invent UI details.",
            "",
          ].join("\n");
        } catch (err) {
          imageNote = `\n(Could not persist screenshots: ${err?.message || err})\n`;
        }
      }

      const fullPrompt = planMode
        ? [
            "PLAN MODE (read-only).",
            "Only inspect the codebase and answer with a short implementation plan as JSON.",
            "Do not edit files. No code samples.",
            "",
            prompt,
            imageNote,
          ].join("\n")
        : askMode
          ? [
              "ASK MODE (read-only).",
              "Only inspect the codebase and answer with diagnosis + a concrete fix plan.",
              "If you would normally write code, describe the edits instead.",
              "",
              prompt,
              imageNote,
            ].join("\n")
          : `${prompt}${imageNote}`;

      const maxAttempts = 3;

      try {
        onEvent?.({
          type: "status",
          message: planMode
            ? `Cursor · model ${modelId} · PLAN (read-only)`
            : askMode
              ? `Cursor · model ${modelId} · ASK (read-only request)`
              : `Cursor · model ${modelId}`,
        });

        let lastErr = null;
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          if (aborted || signal?.aborted) {
            throw Object.assign(new Error("Stopped"), { name: "AbortError" });
          }
          await disposeAgent(agent);
          agent = null;
          try {
            agent = await Agent.create({
              apiKey: key,
              model: { id: modelId },
              local: { cwd: root },
            });
            const run = await agent.send(fullPrompt);
            /** @type {string[]} */
            const replyParts = [];
            let live = "";
            let lastStatusAt = 0;
            const flushLive = () => {
              const t = live.trim();
              if (t) replyParts.push(t);
              live = "";
            };
            for await (const event of run.stream()) {
              if (aborted) {
                try {
                  await run.cancel?.();
                } catch {
                  /* */
                }
                break;
              }
              if (event.type === "assistant") {
                meter.noteTurn(event.usage || event.message?.usage);
                for (const block of event.message?.content || []) {
                  if (block.type !== "text" || !block.text) continue;
                  live = absorbAssistantDelta(live, block.text);
                  const now = Date.now();
                  if (now - lastStatusAt > 400) {
                    lastStatusAt = now;
                    const snip = live.replace(/\s+/g, " ").trim().slice(-120);
                    if (snip.length >= 8) onEvent?.({ type: "status", message: snip });
                  }
                }
              } else if (
                event.type === "tool_call" ||
                event.type === "tool_call_started" ||
                event.type === "tool_call_completed"
              ) {
                flushLive();
                meter.noteTool();
                const name =
                  event.name ||
                  event.toolCall?.name ||
                  event.tool_call?.name ||
                  event.tool?.name ||
                  "";
                const relPath = toolPathFromEvent(event);
                const writeLike =
                  /write|edit|apply|patch|search_replace|str_replace|create_file|delete_file/i.test(
                    name,
                  ) ||
                  (/gameplay\//i.test(relPath) &&
                    /\.(js|ts|json|css|html|md)$/i.test(relPath));
                if (writeLike) {
                  meter.noteFile();
                  if (relPath) onEvent?.({ type: "file", path: relPath });
                  else onEvent?.({ type: "file", path: "public/gameplay/" });
                }
                onEvent?.({
                  type: "tool",
                  name: name || "tool",
                  path: relPath || undefined,
                  status: "call",
                });
              }
            }
            flushLive();
            const finalText = replyParts.join("\n\n").trim();
            if (finalText) onEvent?.({ type: "assistant", text: finalText });
            const result = await run.wait();
            const status = aborted ? "cancelled" : result?.status || "finished";
            if (!aborted && /error|fail/i.test(String(status))) {
              const detail =
                result?.error?.message ||
                result?.error ||
                result?.message ||
                `Cursor run status: ${status}`;
              const detailErr = new Error(String(detail));
              if (isCursorKeyExchangeError(detailErr) && attempt < maxAttempts) {
                lastErr = detailErr;
                onEvent?.({
                  type: "status",
                  message: `Cursor cloud handshake failed — retry ${attempt}/${maxAttempts - 1}…`,
                });
                await sleep(800 * attempt, signal);
                continue;
              }
              onEvent?.({ type: "error", message: String(detail).slice(0, 800) });
            } else if (!aborted && !finalText && attachList.length) {
              onEvent?.({
                type: "assistant",
                text:
                  "No readable reply came back for this screenshot turn. Cursor SDK cannot attach images multimodally like ChatGPT vision — switch provider to OpenAI/Anthropic (vision model) for image Ask, or describe the bug in text.",
              });
            }
            emitBenchmark(status, usageFromResult(result));
            onEvent?.({ type: "done", status });
            return result;
          } catch (err) {
            lastErr = err;
            if (aborted || signal?.aborted || err?.name === "AbortError") {
              throw Object.assign(new Error("Stopped"), { name: "AbortError" });
            }
            if (isCursorKeyExchangeError(err) && attempt < maxAttempts) {
              onEvent?.({
                type: "status",
                message: `Cursor cloud handshake failed — retry ${attempt}/${maxAttempts - 1}…`,
              });
              await sleep(800 * attempt, signal);
              continue;
            }
            throw err;
          }
        }
        throw lastErr || new Error("Cursor request failed");
      } catch (err) {
        if (err?.name === "AbortError") {
          emitBenchmark("cancelled");
          onEvent?.({ type: "done", status: "cancelled" });
          return { status: "cancelled" };
        }
        const raw = errText(err);
        const msg = friendlyCursorError(err);
        onEvent?.({ type: "error", message: msg.slice(0, 800) });
        emitBenchmark("error", null, msg);
        throw new Error(msg);
      } finally {
        signal?.removeEventListener?.("abort", onAbort);
        await disposeAgent(agent);
        agent = null;
      }
    },
    cancel() {
      aborted = true;
    },
  };
}
