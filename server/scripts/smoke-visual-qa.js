/** Smoke: visual QA parsing, provider pick, digest + fix message, judge request against a mock vision API. */
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { buildQaFixMessage, formatQaDigest, judgeCapture, pickVisionProvider } from "../agent/visualQa.js";

const errors = [];
const ok = (m) => console.log("OK ", m);
const fail = (m) => {
  console.error("FAIL", m);
  errors.push(m);
};

// Provider pick: Cursor alone cannot judge; OpenAI-compatible slots can.
if (pickVisionProvider({ CURSOR_API_KEY: "x" }) === null) ok("cursor-only → no vision judge");
else fail("cursor-only should not pick a judge");
const picked = pickVisionProvider({ CURSOR_API_KEY: "x", OPENAI_API_KEY: "k", ANTHROPIC_API_KEY: "a" });
if (picked?.id === "anthropic") ok("prefers anthropic when present");
else fail(`unexpected judge ${picked?.id}`);
const forced = pickVisionProvider({ OPENAI_API_KEY: "k", ANTHROPIC_API_KEY: "a", LAB_QA_PROVIDER: "openai", LAB_QA_MODEL: "gpt-x" });
if (forced?.id === "openai" && forced.model === "gpt-x") ok("LAB_QA_PROVIDER / LAB_QA_MODEL respected");
else fail("LAB_QA_PROVIDER override ignored");

// Mock OpenAI-compatible vision endpoint
let seenBody = null;
const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    seenBody = JSON.parse(body);
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        choices: [
          {
            message: {
              content:
                'Here you go:\n```json\n{"scores":{"readability":6,"lighting_mood":4,"palette_cohesion":5,"world_dressing":3,"characters_motion":6,"hud_clarity":7,"feedback_juice":5,"tdd_fidelity":6},"overall":5.2,"verdict":"Readable but empty.","strengths":["clear HUD"],"fixes":[{"priority":1,"file":"public/gameplay/look.js","change":"Switch preset to dusk and raise bloom to 0.6","why":"flat lighting"}]}\n```',
            },
          },
        ],
      }),
    );
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "plab-qa-"));
const shot = path.join(tmp, "shot-1.jpg");
await fs.writeFile(shot, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
const capture = { ok: true, shots: [{ at: 1500, label: "intro", file: shot, rel: "sessions/qa/x/shot-1.jpg", state: "Intro", info: {} }], errors: [], fps: 60 };
const judge = await judgeCapture({
  root: tmp,
  capture,
  tddText: "# 1 · High concept\nA kart racer.",
  env: { LLM_API_KEY: "k", LLM_BASE_URL: `http://127.0.0.1:${port}/v1`, LLM_MODEL: "vision-x" },
});
server.close();
if (judge.judged && judge.overall === 5.2 && judge.fixes.length === 1) ok("judge parses fenced JSON");
else fail(`judge parse failed: ${JSON.stringify(judge)}`);
const content = seenBody?.messages?.[0]?.content || [];
if (seenBody?.model === "vision-x" && content.some((c) => c.type === "image_url")) ok("judge sends images to the vision model");
else fail("judge request missing images/model");

const report = { capture, judge, technical: ["HUD/game info identical across shots"] };
const digest = formatQaDigest(report);
if (/5\.2\/10/.test(digest) && /look\.js/.test(digest)) ok("digest shows score + fixes");
else fail(`digest: ${digest}`);
const msg = buildQaFixMessage(report);
if (/Keep the loop/.test(msg) && /dusk/.test(msg)) ok("auto-polish message carries fixes + guardrails");
else fail("fix message incomplete");

await fs.rm(tmp, { recursive: true, force: true });
if (errors.length) {
  console.error(`\n${errors.length} failure(s)`);
  process.exit(1);
}
console.log("\nAll visual QA smoke checks passed");
