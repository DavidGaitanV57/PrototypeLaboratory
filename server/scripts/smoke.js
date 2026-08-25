import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseMechanics } from "../tdd/parser.js";
import { findLabSpeak } from "../tdd/antiLabSpeak.js";
import { assertAgentWriteAllowed } from "../agent/writePolicy.js";
import {
  discoverProviders,
  initProviderCatalog,
  providerStatus,
  requireActiveProvider,
} from "../agent/providers/catalog.js";
import {
  assertSafeSlug,
  canonicalizeRel,
  isSensitiveRel,
  resolveExportDestination,
  resolveWithinRoot,
} from "../security/paths.js";
import "dotenv/config";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tddPath = path.join(ROOT, "docs", "tdds", "CoinRush", "TDD.md");

const errors = [];

function ok(msg) {
  console.log("OK ", msg);
}
function fail(msg) {
  console.error("FAIL", msg);
  errors.push(msg);
}

try {
  assertAgentWriteAllowed("public/gameplay/main.js", "generate");
  ok("writePolicy generate gameplay");
} catch (e) {
  fail(e.message);
}
try {
  assertAgentWriteAllowed("public/runtime/Engine.js", "generate");
  fail("kernel write should be blocked");
} catch {
  ok("writePolicy blocks runtime");
}
try {
  assertAgentWriteAllowed("public/gameplay/../../server/index.js", "generate");
  fail("path traversal write should be blocked");
} catch {
  ok("writePolicy blocks gameplay/../ traversal");
}
try {
  assertAgentWriteAllowed("docs/tdds/CoinRush/TDD.md", "sync", { slug: "CoinRush" });
  ok("writePolicy sync TDD");
} catch (e) {
  fail(e.message);
}
try {
  assertAgentWriteAllowed("public/gameplay/main.js", "plan");
  fail("plan write should be blocked");
} catch {
  ok("writePolicy plan is read-only");
}

try {
  assertSafeSlug("../etc");
  fail("unsafe slug should throw");
} catch {
  ok("assertSafeSlug rejects traversal");
}
try {
  canonicalizeRel("../../../etc/passwd");
  fail("canonicalize should reject escape");
} catch {
  ok("canonicalizeRel rejects .. escape");
}
if (canonicalizeRel("public/gameplay/../../.env") === ".env") {
  ok("canonicalizeRel collapses traversal inside root");
} else {
  fail("canonicalizeRel should collapse to .env");
}
if (isSensitiveRel(".env")) ok("isSensitiveRel .env");
else fail("isSensitiveRel missed .env");
try {
  resolveWithinRoot(ROOT, "docs/tdds/CoinRush/TDD.md");
  ok("resolveWithinRoot ok path");
} catch (e) {
  fail(e.message);
}
const blockedExport = resolveExportDestination(ROOT, path.join(ROOT, "..", "outside-export"), {
  slug: "CoinRush",
  stamp: "t",
});
if (!blockedExport.ok) ok("export destination confined to exports/");
else fail("export should reject outside exports/");

let text = "";
try {
  text = await fs.readFile(tddPath, "utf8");
  ok("TDD present");
} catch {
  fail("TDD missing — run npm run seed");
}

if (text) {
  const mechs = parseMechanics(text);
  if (mechs.length >= 1) ok(`parsed ${mechs.length} mechanics`);
  else fail("no mechanics parsed");
  const hits = findLabSpeak(text);
  if (hits.length) fail(`lab speak in seed TDD: ${hits[0].text}`);
  else ok("seed TDD unity-clean");
}

await initProviderCatalog(ROOT);
const list = discoverProviders();
if (!list.length) fail("no API keys — local provider is forbidden");
else ok(`providers ready: ${list.map((p) => p.id).join(", ")}`);

try {
  const slot = requireActiveProvider();
  if (slot.id === "local") fail("active provider must not be local");
  else ok(`active ${slot.id} · model ${slot.model}`);
} catch (e) {
  fail(e.message);
}

const status = providerStatus();
if (status.providers.some((p) => p.id === "local")) fail("local still listed");
else ok("no local provider in catalog");
if (!status.configured) fail("status.configured false with keys present");
else ok("status.configured");

if (errors.length) {
  console.error(`\n${errors.length} failure(s)`);
  process.exit(1);
}
console.log("\nAll smoke checks passed");
