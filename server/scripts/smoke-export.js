import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exportBuild } from "../export.js";
import { listGameplayFiles, mergeChatDigest, parseSyncProposal } from "../agent/gameplayEvidence.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const errors = [];

function ok(msg) {
  console.log("OK ", msg);
}
function fail(msg) {
  console.error("FAIL", msg);
  errors.push(msg);
}

const digest = mergeChatDigest(
  [{ role: "user", message: "add minimap top-right" }],
  "user: invert steer left/right",
);
if (digest.includes("minimap") && digest.includes("invert steer")) ok("mergeChatDigest");
else fail("mergeChatDigest missing expected lines");

const proposal = parseSyncProposal(`Here is the list:
\`\`\`json
{"items":[{"id":"minimap","kind":"hud","title":"Add minimap HUD","section":"§9.1","detail":"Top-right race minimap"}]}
\`\`\`
`);
if (proposal.items.length === 1 && proposal.items[0].id === "minimap") ok("parseSyncProposal");
else fail("parseSyncProposal did not extract checklist item");


const files = await listGameplayFiles(ROOT);
if (files.some((f) => f.endsWith("main.js"))) ok(`listGameplayFiles (${files.length} files)`);
else fail("listGameplayFiles missing main.js");

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "plab-export-"));
const publicRoot = path.join(tmp, "public");
const tddsRoot = path.join(tmp, "docs", "tdds", "CoinRush");
await fs.mkdir(path.join(publicRoot, "gameplay"), { recursive: true });
await fs.mkdir(path.join(publicRoot, "runtime"), { recursive: true });
await fs.mkdir(tddsRoot, { recursive: true });

await fs.writeFile(
  path.join(publicRoot, "gameplay", "main.js"),
  `export async function mount(canvas) {}
export async function unmount() {}
`,
  "utf8",
);
await fs.writeFile(path.join(publicRoot, "runtime", "Engine.js"), "export const THREE = {};\n", "utf8");
await fs.writeFile(path.join(tddsRoot, "TDD.md"), "# TDD\nDocument version** | 1.0.0\n", "utf8");

const dest = path.join(tmp, "out");
const result = await exportBuild({
  root: ROOT,
  publicRoot,
  tddsRoot: path.join(tmp, "docs", "tdds"),
  slug: "CoinRush",
  destination: dest,
  allowOutsideExports: true,
});

if (!result.ok) fail(result.reason || "export failed");
else ok(`export copied ${result.filesCopied} files`);

if (result.ok) {
  const entries = await fs.readdir(dest);
  for (const need of ["index.html", "play.js", "server.mjs", "gameplay", "runtime", "tdd"]) {
    if (entries.includes(need)) ok(`export has ${need}/`);
    else fail(`export missing ${need}`);
  }
  if (!entries.includes("app.js")) ok("export omits lab app.js");
  else fail("lab app.js must not ship");
}

await fs.rm(tmp, { recursive: true, force: true });

if (errors.length) {
  console.error(`\n${errors.length} failure(s)`);
  process.exit(1);
}
console.log("\nAll export smoke checks passed");
