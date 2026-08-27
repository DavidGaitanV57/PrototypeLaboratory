/** Smoke: final reply selection from Cursor-style cumulative snapshots. */
function mergeAssistantChunks(chunks) {
  const parts = chunks.map((c) => String(c || "").trim()).filter(Boolean);
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0];
  const longest = parts.reduce((a, b) => (a.length >= b.length ? a : b));
  const last = parts[parts.length - 1];
  if (last.length >= Math.max(48, longest.length * 0.7)) return last;
  return longest;
}

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

const errors = [];
function ok(cond, msg) {
  if (cond) console.log("OK ", msg);
  else {
    console.error("FAIL", msg);
    errors.push(msg);
  }
}

const snaps = [
  "**Biol**",
  "**Biolum**",
  "**Biolum As**",
  "**Biolum Ascent**",
  "**Biolum Ascent** es un endless vertical tipo Doodle Jump, pero bajo el mar.",
];
const merged = mergeAssistantChunks(snaps);
ok(merged.startsWith("**Biolum Ascent**"), "last snapshot wins");
ok(!merged.includes("**Biol****Biolum**"), "no concatenated bold snapshots");
ok(!merged.includes("**Biolum****Biolum As**"), "no mid-grow concat");

let live = "";
for (const s of snaps) live = absorbAssistantDelta(live, s);
ok(live === snaps[snaps.length - 1], "provider absorb prefers growing rewrite");

const deltas = ["Hello", " ", "world"];
let d = "";
for (const t of deltas) d = absorbAssistantDelta(d, t);
ok(d === "Hello world", "short deltas still append");

if (errors.length) {
  console.error(`\n${errors.length} failure(s)`);
  process.exit(1);
}
console.log("\nAll chat merge smoke checks passed");
