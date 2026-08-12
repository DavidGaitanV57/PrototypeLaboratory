import { Agent } from "@cursor/sdk";

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

/**
 * Cursor SDK provider — local cwd agent. Model may be "auto" or a listed id.
 */
export function createCursorProvider({ root, apiKey, model }) {
  const key = apiKey || process.env.CURSOR_API_KEY;
  if (!key) {
    throw new Error("CURSOR_API_KEY missing. Set it in .env.");
  }
  const modelId = model || process.env.CURSOR_MODEL || "auto";

  let agent = null;
  let aborted = false;

  return {
    id: "cursor",
    model: modelId,
    async run(prompt, { onEvent, signal } = {}) {
      aborted = false;
      const onAbort = () => {
        aborted = true;
      };
      signal?.addEventListener?.("abort", onAbort);

      try {
        onEvent?.({ type: "status", message: `Cursor · model ${modelId}` });
        agent = await Agent.create({
          apiKey: key,
          model: { id: modelId },
          local: { cwd: root },
        });

        const run = await agent.send(prompt);
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
            for (const block of event.message?.content || []) {
              if (block.type === "text") onEvent?.({ type: "assistant", text: block.text });
            }
          } else if (event.type === "tool_call") {
            const name = event.name || event.toolCall?.name || "tool";
            const relPath = toolPathFromEvent(event);
            onEvent?.({ type: "tool", name, path: relPath || undefined, status: "call" });
          }
        }
        const result = await run.wait();
        onEvent?.({ type: "done", status: result?.status || "finished" });
        return result;
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
