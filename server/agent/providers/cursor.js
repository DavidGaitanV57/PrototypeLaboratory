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
    async run(prompt, { onEvent, signal } = {}) {
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

      const fullPrompt = planMode
        ? [
            "PLAN MODE (read-only). Do NOT edit files. Return only the JSON plan object. No code samples.",
            "",
            prompt,
          ].join("\n")
        : askMode
          ? [
              "ASK MODE (read-only). Do NOT edit, create, delete, or patch any files.",
              "Only inspect the codebase and answer with diagnosis + a concrete fix plan.",
              "If you would normally write code, describe the edits instead.",
              "",
              prompt,
            ].join("\n")
          : prompt;

      try {
        onEvent?.({
          type: "status",
          message: planMode
            ? `Cursor · model ${modelId} · PLAN (read-only)`
            : askMode
              ? `Cursor · model ${modelId} · ASK (read-only request)`
              : `Cursor · model ${modelId}`,
        });
        agent = await Agent.create({
          apiKey: key,
          model: { id: modelId },
          local: { cwd: root },
        });

        const run = await agent.send(fullPrompt);
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
              if (block.type === "text") onEvent?.({ type: "assistant", text: block.text });
            }
          } else if (event.type === "tool_call") {
            meter.noteTool();
            const name = event.name || event.toolCall?.name || "tool";
            const relPath = toolPathFromEvent(event);
            if (/write|edit|apply|patch/i.test(name) || /\.(js|ts|css|html|md)$/i.test(relPath)) {
              meter.noteFile();
              if (relPath) onEvent?.({ type: "file", path: relPath });
            }
            onEvent?.({ type: "tool", name, path: relPath || undefined, status: "call" });
          }
        }
        const result = await run.wait();
        const status = aborted ? "cancelled" : result?.status || "finished";
        emitBenchmark(status, usageFromResult(result));
        onEvent?.({ type: "done", status });
        return result;
      } catch (err) {
        emitBenchmark("error", null, err?.message || err);
        throw err;
      } finally {
        signal?.removeEventListener?.("abort", onAbort);
        try {
          await agent?.[Symbol.asyncDispose]?.();
        } catch {
          /* */
        }
        agent = null;
      }
    },
    cancel() {
      aborted = true;
    },
  };
}
