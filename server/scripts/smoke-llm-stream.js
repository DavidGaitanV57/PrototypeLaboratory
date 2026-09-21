/** Smoke: SSE chat.completions stream assembler used by Kimi/OpenAI LLM path. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const llmPath = path.join(ROOT, "server/agent/providers/llm.js");
const src = fs.readFileSync(llmPath, "utf8");
const errors = [];

function ok(m) {
  console.log("OK ", m);
}
function fail(m) {
  console.error("FAIL", m);
  errors.push(m);
}

if (/stream:\s*true/.test(src)) ok("chat completions request uses stream:true");
else fail("missing stream:true on chat path");
if (/readChatCompletionStream/.test(src)) ok("SSE reader present");
else fail("missing readChatCompletionStream");
if (/MAX_NETWORK_RETRIES/.test(src)) ok("network retry cap present");
else fail("missing MAX_NETWORK_RETRIES");

async function readChatCompletionStream(res) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  const toolCalls = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      const json = JSON.parse(payload);
      const delta = json.choices?.[0]?.delta || {};
      if (typeof delta.content === "string") content += delta.content;
      for (const tc of delta.tool_calls || []) {
        const idx = tc.index ?? 0;
        if (!toolCalls[idx]) toolCalls[idx] = { id: "", function: { name: "", arguments: "" } };
        if (tc.id) toolCalls[idx].id = tc.id;
        if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
        if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
      }
    }
  }
  return { content, toolCalls: toolCalls.filter(Boolean) };
}

const enc = new TextEncoder();
const parts = [
  'data: {"choices":[{"delta":{"role":"assistant","tool_calls":[{"index":0,"id":"c1","type":"function","function":{"name":"read_file","arguments":""}}]}}]}\n\n',
  'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"path\\":\\"x.js\\"}"}}]}}]}\n\n',
  "data: [DONE]\n\n",
];
const stream = new ReadableStream({
  start(controller) {
    for (const p of parts) controller.enqueue(enc.encode(p));
    controller.close();
  },
});
const parsed = await readChatCompletionStream(new Response(stream));
if (
  parsed.toolCalls[0]?.function?.name === "read_file" &&
  /x\.js/.test(parsed.toolCalls[0].function.arguments)
) {
  ok("SSE tool_call assembly");
} else fail("SSE tool_call assembly broken");

if (errors.length) {
  console.error(`\n${errors.length} failure(s)`);
  process.exit(1);
}
console.log("\nAll llm stream smoke checks passed");
