import fs from "node:fs/promises";
import path from "node:path";
import { assertAgentWriteAllowed } from "../writePolicy.js";

/**
 * OpenAI-compatible tool-calling provider.
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

  const tools = [
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
    {
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
    },
  ];

  async function execTool(name, args) {
    const rel = String(args.path || "").replace(/\\/g, "/");
    const abs = path.join(root, rel);
    if (!abs.startsWith(root)) throw new Error("Path escapes root");

    if (name === "list_dir") {
      const ents = await fs.readdir(abs, { withFileTypes: true });
      return ents.map((e) => (e.isDirectory() ? `${e.name}/` : e.name)).join("\n");
    }
    if (name === "read_file") {
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
      signal?.addEventListener?.("abort", () => ac.abort());

      const messages = [
        {
          role: "system",
          content:
            "You are a gameplay prototyping agent. Use tools to read/write files. Obey write policy in the user prompt.",
        },
        { role: "user", content: prompt },
      ];

      for (let turn = 0; turn < 24; turn++) {
        if (aborted) break;
        const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
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
          signal: ac.signal,
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`LLM HTTP ${res.status}: ${errText.slice(0, 400)}`);
        }
        const data = await res.json();
        const msg = data.choices?.[0]?.message;
        if (!msg) throw new Error("Empty LLM response");
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
          onEvent?.({ type: "done", status: "finished" });
          return data;
        }

        for (const call of calls) {
          const name = call.function?.name;
          let args = {};
          try {
            args = JSON.parse(call.function?.arguments || "{}");
          } catch {
            args = {};
          }
          const relPath = String(args.path || "").replace(/\\/g, "/");
          onEvent?.({ type: "tool", name, path: relPath || undefined, status: "call" });
          let result;
          try {
            result = await execTool(name, args);
            if (name === "write_file") onEvent?.({ type: "file", path: args.path });
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
      onEvent?.({ type: "done", status: aborted ? "cancelled" : "max_turns" });
    },
    cancel() {
      aborted = true;
      ctrl.current?.abort?.();
    },
  };
}
