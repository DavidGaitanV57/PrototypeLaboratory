/** Smoke: runtime API index replaces reading public/runtime sources. */
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildRuntimeApiIndex,
  digestRuntimeSource,
  runtimeFileDigest,
} from "../agent/runtimeIndex.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const errors = [];

function ok(m) {
  console.log("OK ", m);
}
function fail(m) {
  console.error("FAIL", m);
  errors.push(m);
}

const sample = `/** Demo kit — does things. */
export const DEMO_PRESETS = { a: 1 };
export function createDemo(root, opts = {}) {
  const api = { start() {}, stop() {} };
  function hidden() { return { nope: 1 }; }
  return { mount, update, dispose, get state() { return 1; } };
}
`;
const digest = digestRuntimeSource("DemoKit.js", sample);
if (/createDemo\(root, opts = \{\}\)/.test(digest)) ok("digest keeps signature");
else fail(`signature missing: ${digest}`);
if (/mount, update, dispose, state/.test(digest)) ok("digest lists returned surface");
else fail(`returned keys wrong: ${digest}`);
if (/nope/.test(digest)) fail("digest leaked nested return keys");
else ok("digest ignores nested returns");
if (/DEMO_PRESETS/.test(digest)) ok("digest lists exported consts");
else fail("digest missing consts");

const full = await buildRuntimeApiIndex(ROOT);
if (!full) fail("no runtime index built");
else ok(`full index ${full.length} chars`);
if (full.length > 6000) fail(`full index too large: ${full.length}`);
else ok("full index within budget");

for (const kit of ["HudKit.js", "JuiceKit.js", "Engine.js", "PathKit.js"]) {
  if (full.includes(`/runtime/${kit}`)) ok(`index covers ${kit}`);
  else fail(`index missing ${kit}`);
}
if (/createHud\(root, opts = \{\}\).*panel/s.test(full)) ok("HudKit surface includes panel");
else fail("HudKit surface missing panel");
if (/themeFromPalette|HUD_THEMES/.test(full)) ok("HudKit surface includes theming");
else fail("HudKit surface missing theming");

const compact = await buildRuntimeApiIndex(ROOT, { compact: true });
if (compact.length < full.length) ok(`compact index ${compact.length} chars`);
else fail("compact index should be smaller");
if (compact.length > 1400) fail(`compact index too large: ${compact.length}`);
else ok("compact index within chat budget");

const hud = await runtimeFileDigest(ROOT, "public/runtime/HudKit.js");
if (hud && hud.length < 1200) ok(`HudKit digest ${hud.length} chars (source is ~16k)`);
else fail(`HudKit digest missing or too large: ${hud?.length}`);

const missing = await runtimeFileDigest(ROOT, "public/runtime/NotAKit.js");
if (missing === null) ok("unknown runtime file returns null");
else fail("unknown runtime file should return null");

if (errors.length) {
  console.error(`\n${errors.length} failure(s)`);
  process.exit(1);
}
console.log("\nAll runtime index smoke checks passed");
