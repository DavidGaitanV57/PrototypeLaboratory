/** Smoke: genre starter templates are complete, pick sensibly, reach the prompt, and bundle for export. */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { TEMPLATES, pickTemplate, seedTemplateIfEmpty, templateBrief } from "../agent/templates/index.js";
import { buildGenerateFinalPrompt, loadPromptPack } from "../agent/prompts/index.js";
import { exportBuild } from "../export.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const TPL = path.join(ROOT, "server", "agent", "templates");
const errors = [];
const ok = (m) => console.log("OK ", m);
const fail = (m) => {
  console.error("FAIL", m);
  errors.push(m);
};

for (const [id, tpl] of Object.entries(TEMPLATES)) {
  for (const f of tpl.files) {
    try {
      await fs.access(path.join(TPL, id, f));
    } catch {
      fail(`${id}/${f} missing`);
    }
  }
  const main = await fs.readFile(path.join(TPL, id, "main.js"), "utf8").catch(() => "");
  if (/export\s+async\s+function\s+mount\s*\(/.test(main) && /export\s+async\s+function\s+unmount\s*\(/.test(main)) ok(`${id} exports mount/unmount`);
  else fail(`${id} missing mount/unmount`);
  if (/installLook\(/.test(main) && /window\.__plab\s*=/.test(main) && /__PLAB_AUTOPLAY/.test(main)) ok(`${id} wires LookKit + QA hooks`);
  else fail(`${id} missing LookKit or QA hooks`);
  const look = await fs.readFile(path.join(TPL, id, "look.js"), "utf8").catch(() => "");
  if (/export const LOOK/.test(look) && /preset:/.test(look)) ok(`${id} has a Look Bible`);
  else fail(`${id} look.js incomplete`);
  const juice = await fs.readFile(path.join(TPL, id, "juice.js"), "utf8").catch(() => "");
  if (/JuiceKit/.test(juice) && /FxKit/.test(juice) && /AudioKit/.test(juice)) ok(`${id} juice.js is a feedback hub`);
  else fail(`${id} juice.js missing kits`);
}

const cases = [
  ["genre: \"Kart racer\"\nlaps checkpoints drift item box", "kart"],
  ["Liminal horror. Backrooms. Sanity. First-person.", "firstperson"],
  ["genre: \"3D platformer\"\njump double jump coins", "platformer"],
  ["| **Genre / sub-genre** | Mini-game / arcade collector |\ncollect coins before the timer", "platformer"],
  ["Top-down arena brawler. Survive waves of enemies.", "arena"],
];
for (const [text, want] of cases) {
  const got = pickTemplate(text).id;
  if (got === want) ok(`pickTemplate → ${want}`);
  else fail(`pickTemplate expected ${want}, got ${got}`);
}

// Seeding into a temp root + prompt section
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "plab-tpl-"));
const seed = await seedTemplateIfEmpty(tmp, "genre: kart racer, laps", { env: {} });
if (seed.seeded && seed.id === "kart" && seed.files.includes("public/gameplay/main.js")) ok("seedTemplateIfEmpty seeds kart");
else fail(`seed failed: ${JSON.stringify(seed)}`);
const again = await seedTemplateIfEmpty(tmp, "genre: kart racer", { env: {} });
if (!again.seeded) ok("seed skips when a build exists");
else fail("seed must not overwrite an existing build");
const off = await seedTemplateIfEmpty(path.join(tmp, "x"), "kart", { env: { LAB_TEMPLATES: "off" } });
if (!off.seeded) ok("LAB_TEMPLATES=off disables seeding");
else fail("LAB_TEMPLATES=off ignored");
const brief = templateBrief(seed);
if (/look\.js/.test(brief) && /not to start over|transform/i.test(brief)) ok("templateBrief tells the agent to adapt");
else fail("templateBrief weak");
const pack = await loadPromptPack();
const prompt = buildGenerateFinalPrompt({ slug: "Demo", tddText: "genre: kart", agentsMd: "", pack, templateSeed: seed, runtimeIndex: "" });
if (prompt.includes("Starter template already in public/gameplay")) ok("Generate prompt carries the template brief");
else fail("Generate prompt missing template brief");

// Every template bundles through the export pipeline (catches bad imports).
for (const id of Object.keys(TEMPLATES)) {
  const troot = path.join(tmp, `exp-${id}`);
  const pub = path.join(troot, "public");
  await fs.mkdir(path.join(pub, "gameplay"), { recursive: true });
  await fs.cp(path.join(ROOT, "public", "runtime"), path.join(pub, "runtime"), { recursive: true });
  for (const f of TEMPLATES[id].files) await fs.copyFile(path.join(TPL, id, f), path.join(pub, "gameplay", f));
  const res = await exportBuild({
    root: ROOT,
    publicRoot: pub,
    tddsRoot: path.join(troot, "docs", "tdds"),
    slug: id,
    destination: path.join(troot, "out"),
    allowOutsideExports: true,
  });
  if (res.ok) ok(`${id} bundles for export`);
  else fail(`${id} export failed: ${res.reason}`);
}

// Addons resolve to the same THREE instance in exports
{
  const troot = path.join(tmp, "addon");
  const pub = path.join(troot, "public");
  await fs.mkdir(path.join(pub, "gameplay"), { recursive: true });
  await fs.cp(path.join(ROOT, "public", "runtime"), path.join(pub, "runtime"), { recursive: true });
  await fs.writeFile(
    path.join(pub, "gameplay", "main.js"),
    `import * as THREE from "/vendor/three/build/three.module.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "/vendor/three/examples/jsm/utils/BufferGeometryUtils.js";
export async function mount() { return new THREE.Mesh(mergeGeometries([new RoundedBoxGeometry()])); }
export async function unmount() {}
`,
    "utf8",
  );
  const res = await exportBuild({ root: ROOT, publicRoot: pub, tddsRoot: path.join(troot, "docs"), slug: "addon", destination: path.join(troot, "out"), allowOutsideExports: true });
  if (!res.ok) fail(`addon export failed: ${res.reason}`);
  else {
    const js = await fs.readFile(path.join(troot, "out", "play.js"), "utf8");
    const copies = (js.match(/REVISION\s*=\s*["']\d+/g) || []).length;
    if (copies <= 1) ok("addons bundle with a single THREE instance");
    else fail(`THREE bundled ${copies} times`);
  }
}
void esbuild;

await fs.rm(tmp, { recursive: true, force: true });
if (errors.length) {
  console.error(`\n${errors.length} failure(s)`);
  process.exit(1);
}
console.log("\nAll template smoke checks passed");
