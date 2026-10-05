/** Smoke: asset library is indexed from glTF JSON only, offered only in asset mode, and stays read-only. */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatAssetManifest, scanAssetLibrary, scanLibrary } from "../agent/assetCatalog.js";
import { materialLibraryIndex } from "../agent/materialCatalog.js";
import { buildGenerateFinalPrompt, loadPromptPack } from "../agent/prompts/index.js";
import { buildRuntimeApiIndex } from "../agent/runtimeIndex.js";
import { assertAgentWriteAllowed } from "../agent/writePolicy.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const errors = [];

function ok(m) {
  console.log("OK ", m);
}
function fail(m) {
  console.error("FAIL", m);
  errors.push(m);
}

/** Minimal GLB: one wrapper root with two named children (a 1×2×1 box scaled ×2, and a 0.5 cube). */
function makeGlb() {
  const json = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [
      { name: "Root", children: [1, 2] },
      { name: "Tall Crate", mesh: 0, scale: [2, 2, 2] },
      { name: "Small Box", mesh: 1, translation: [5, 0, 0] },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }, { primitives: [{ attributes: { POSITION: 1 } }] }],
    accessors: [
      { componentType: 5126, count: 0, type: "VEC3", min: [-0.5, 0, -0.5], max: [0.5, 2, 0.5] },
      { componentType: 5126, count: 0, type: "VEC3", min: [0, 0, 0], max: [0.5, 0.5, 0.5] },
    ],
    animations: [{ name: "Idle", channels: [], samplers: [] }],
  };
  let text = JSON.stringify(json);
  while (text.length % 4) text += " ";
  const body = Buffer.from(text, "utf8");
  const head = Buffer.alloc(20);
  head.writeUInt32LE(0x46546c67, 0);
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(20 + body.length, 8);
  head.writeUInt32LE(body.length, 12);
  head.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([head, body]);
}

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "plab-assets-"));
try {
  const dir = path.join(tmp, "public", "assets", "props");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "crates.glb"), makeGlb());
  await fs.writeFile(path.join(tmp, "public", "assets", "broken.glb"), "not a glb");
  await fs.writeFile(path.join(tmp, "public", "assets", "notes.txt"), "ignored");

  const lib = await scanAssetLibrary(tmp);
  lib.length === 2 ? ok("scan finds .glb files recursively, skips other extensions") : fail(`scan found ${lib.length}`);
  const crates = lib.find((a) => a.file === "props/crates.glb");
  crates?.url === "/assets/props/crates.glb" ? ok("url maps to /assets/<path>") : fail(`url ${crates?.url}`);
  const names = crates?.objects.map((o) => o.name).join("|");
  names === "Tall Crate|Small Box" ? ok("single root wrapper unwrapped to its children") : fail(`objects ${names}`);
  const tall = crates?.objects.find((o) => o.name === "Tall Crate");
  tall?.size?.join(",") === "1,2,1" ? ok("object size measured in its own frame (transform reset)") : fail(`size ${tall?.size}`);
  crates?.animations[0] === "Idle" ? ok("animation clips listed") : fail("clips missing");
  lib.find((a) => a.file === "broken.glb")?.error ? ok("invalid file flagged, not thrown") : fail("broken file not flagged");

  const manifest = formatAssetManifest(lib);
  manifest.includes("`props/crates.glb`") && !manifest.includes("broken.glb")
    ? ok("manifest lists usable files only")
    : fail("manifest content");
  formatAssetManifest([]) === "" ? ok("empty library → empty manifest") : fail("empty manifest not empty");

  const pack = await loadPromptPack();
  const base = { slug: "Demo", tddText: "# 1 · Demo", pack, runtimeIndex: "IDX" };
  const withAssets = buildGenerateFinalPrompt({ ...base, assetManifest: manifest });
  const plain = buildGenerateFinalPrompt(base);
  withAssets.includes("Asset mode") && withAssets.includes("props/crates.glb") && withAssets.includes("`assets.js`")
    ? ok("asset prompt carries contract + manifest + assets.js step")
    : fail("asset prompt incomplete");
  !plain.includes("Asset mode") ? ok("plain Generate prompt unchanged") : fail("plain prompt mentions assets");

  const idxPlain = await buildRuntimeApiIndex(ROOT);
  const idxAssets = await buildRuntimeApiIndex(ROOT, { withAssets: true });
  !idxPlain.includes("AssetKit") && idxAssets.includes("/runtime/AssetKit.js")
    ? ok("AssetKit is opt-in in the runtime index")
    : fail("AssetKit index gating");

  // ── material sets ──
  const png = Buffer.from("89504e470d0a1a0a", "hex");
  const mdir = path.join(tmp, "public", "assets", "interior", "carpet");
  await fs.mkdir(mdir, { recursive: true });
  for (const f of ["carpet_color.png", "carpet_normal.png", "carpet_rough.png"]) await fs.writeFile(path.join(mdir, f), png);
  await fs.writeFile(
    path.join(mdir, "material.json"),
    JSON.stringify({ version: 1, surfaces: ["floor"], tileSize: [1.5, 1], roughness: 2, colour: "red", maps: { ao: "missing.png" } }),
  );
  const multi = path.join(tmp, "public", "assets", "pbr");
  await fs.mkdir(path.join(multi, "preview"), { recursive: true });
  for (const f of ["Bricks059_1K-PNG_Color.png", "Bricks059_1K-PNG_NormalDX.png", "brick_wall_diff_1k.jpg", "brick_wall_arm_1k.jpg", "notes.png"]) {
    await fs.writeFile(path.join(multi, f), png);
  }
  await fs.writeFile(path.join(multi, "preview", "x_color.png"), png);

  const { materials, manifest: full } = await scanLibrary(tmp);
  const ids = materials.map((m) => m.id).join("|");
  ids === "interior/carpet|pbr/brick_wall|pbr/Bricks059_1K-PNG" ? ok("sets: one per folder, split by base name, preview/ skipped") : fail(`ids ${ids}`);
  const carpet = materials.find((m) => m.id === "interior/carpet");
  carpet?.tileSize.join() === "1.5,1" && carpet.surfaces.join() === "floor" && !carpet.inferred.tileSize
    ? ok("material.json tileSize + surfaces applied")
    : fail(`carpet ${JSON.stringify(carpet)}`);
  const w = carpet?.warnings.join(" | ") || "";
  /roughness/.test(w) && /colour/.test(w) && /missing\.png/.test(w) && carpet.roughness === 1
    ? ok("invalid sidecar fields dropped with warnings, defaults kept")
    : fail(`warnings ${w}`);
  const dx = materials.find((m) => m.id === "pbr/Bricks059_1K-PNG");
  dx?.normalConvention === "dx" ? ok("NormalDX detected → dx convention") : fail("dx convention");
  const orm = materials.find((m) => m.id === "pbr/brick_wall");
  orm?.maps.orm && orm.metalness === 1 && orm.inferred.surfaces && orm.surfaces.includes("wall")
    ? ok("ORM/ARM map detected; surfaces guessed from name")
    : fail(`orm ${JSON.stringify(orm)}`);
  full.includes("`interior/carpet` — floor · tile 1.5×1 m") && full.includes("(guessed)")
    ? ok("manifest lists material sets with tile size and guesses flagged")
    : fail("material manifest");
  const index = materialLibraryIndex(materials);
  index.materials["interior/carpet"]?.maps.color === "interior/carpet/carpet_color.png"
    ? ok("library.json maps resolve to library paths")
    : fail("library index paths");

  try {
    assertAgentWriteAllowed("public/assets/props/crates.glb", "generate");
    fail("agent may write public/assets/");
  } catch {
    ok("agent writes to public/assets/ are rejected");
  }
} finally {
  await fs.rm(tmp, { recursive: true, force: true });
}

if (errors.length) {
  console.error(`\n${errors.length} failure(s)`);
  process.exit(1);
}
console.log("\nAll asset smoke checks passed");
