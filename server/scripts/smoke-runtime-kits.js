/** Smoke: vertical-slice runtime kits exist and PathKit exports createPath. */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const RUNTIME = path.join(ROOT, "public", "runtime");
const errors = [];

function ok(msg) {
  console.log("OK ", msg);
}
function fail(msg) {
  console.error("FAIL", msg);
  errors.push(msg);
}

const kits = ["HudKit.js", "JuiceKit.js", "PathKit.js", "MinimapKit.js"];
for (const name of kits) {
  try {
    const body = await fs.readFile(path.join(RUNTIME, name), "utf8");
    ok(`runtime/${name} exists`);
    if (!/export\s+function/.test(body)) fail(`${name} missing exports`);
  } catch {
    fail(`missing runtime/${name}`);
  }
}

const pathBody = await fs.readFile(path.join(RUNTIME, "PathKit.js"), "utf8").catch(() => "");
if (/export\s+function\s+createPath/.test(pathBody)) ok("PathKit exports createPath");
else fail("PathKit missing createPath export");

const verticalSlice = path.join(ROOT, "server", "agent", "prompts", "vertical-slice.md");
try {
  const text = await fs.readFile(verticalSlice, "utf8");
  if (/HudKit/.test(text) && /JuiceKit/.test(text)) ok("vertical-slice.md prompt");
  else fail("vertical-slice.md missing kit refs");
} catch {
  fail("vertical-slice.md missing");
}

if (errors.length) {
  console.error(`\n${errors.length} failure(s)`);
  process.exit(1);
}
console.log("\nAll runtime kit smoke checks passed");
