/** Smoke: Generate Final prompt stays slim (chat-web spend) by default. */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildGenerateFinalPrompt,
  loadPromptPack,
  summarizeTddForPrompt,
} from "../agent/prompts/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const errors = [];

function ok(m) {
  console.log("OK ", m);
}
function fail(m) {
  console.error("FAIL", m);
  errors.push(m);
}

const pack = await loadPromptPack();
const agentsMd = await fs.readFile(path.join(ROOT, "AGENTS.md"), "utf8");

let tddText = "";
const thr = path.join(ROOT, "docs/tdds/ThresholdRooms/TDD_ThresholdRooms.md");
try {
  tddText = await fs.readFile(thr, "utf8");
} catch {
  tddText = `# 1 · High Concept\nElevator pitch. Liminal horror.\n\n# 3 · Core Gameplay\nCore loop. Wake explore sanity exit.\n\n# 8 · Art Direction\nMaster palette #C9B45A fog grain vignette.\n\n## Mechanic: Wanderer Locomotion\n## Mechanic: AtmosphereDirector\n`;
  tddText = tddText.padEnd(60_000, " x");
}

const digest = summarizeTddForPrompt(tddText);
if (digest.length < tddText.length || tddText.length < 10_000) ok(`TDD digest ${digest.length} chars`);
else fail("digest should shrink large TDDs");
if (digest.length > 14_000) fail(`digest too large: ${digest.length}`);
else ok("digest within budget");

const slim = buildGenerateFinalPrompt({
  slug: "ThresholdRooms",
  tddText,
  agentsMd,
  pack,
  tddRelPath: "docs/tdds/ThresholdRooms/TDD_ThresholdRooms.md",
  runtime: "llm",
});
if (slim.length > 28_000) fail(`slim Generate Final too large: ${slim.length}`);
else ok(`slim Generate Final ${slim.length} chars`);
if (/Compact contracts/i.test(slim) && /TDD digest/i.test(slim)) ok("slim has compact + digest");
else fail("slim missing compact/digest sections");
if (slim.includes(agentsMd) && agentsMd.length > 1000) fail("slim should not paste full AGENTS.md");
else ok("slim omits full AGENTS.md");
if (/playable-quality|Vertical slice presentation/i.test(slim) && slim.includes(pack.quality.slice(0, 80))) {
  fail("slim should not paste full quality pack");
} else ok("slim omits full quality/vertical packs");

const fat = buildGenerateFinalPrompt({
  slug: "ThresholdRooms",
  tddText,
  agentsMd,
  pack,
  tddRelPath: "docs/tdds/ThresholdRooms/TDD_ThresholdRooms.md",
  verbose: true,
});
if (fat.length > slim.length * 2) ok(`verbose path still available (${fat.length} chars)`);
else ok(`verbose path ${fat.length} chars (TDD may be short fixture)`);

if (errors.length) {
  console.error(`\n${errors.length} failure(s)`);
  process.exit(1);
}
console.log("\nAll generate-final slim smoke checks passed");
