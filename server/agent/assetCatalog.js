/**
 * Asset library catalog — `public/assets/**` (.glb / .gltf).
 *
 * Generate Prototype with Assets hands the model this manifest instead of the binaries: per file
 * the URL, named nodes (what `AssetKit.cloneNode` can pull out), their approximate size in metres
 * and the animation clips. Only the glTF JSON is read — never the binary payload — so a library
 * of several hundred MB stays cheap to index.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { formatMaterialManifest, scanMaterialSets } from "./materialCatalog.js";

export { scanMaterialSets };
export const ASSET_DIR_REL = "public/assets";
const MODEL_RE = /\.(glb|gltf)$/i;
const GLB_MAGIC = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a; // "JSON"

/** @type {Map<string, { fp: string, entry: object }>} */
const cache = new Map();

export function assetsDir(root) {
  return path.join(root, "public", "assets");
}

async function walk(dir, prefix = "") {
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const ent of entries) {
    if (ent.name.startsWith(".")) continue;
    const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...(await walk(abs, rel)));
    else if (ent.isFile() && MODEL_RE.test(ent.name)) out.push({ rel, abs });
  }
  return out;
}

/** Reads the JSON chunk of a .glb (first 20 bytes + chunk) or a whole .gltf. */
async function readGltfJson(abs) {
  if (/\.gltf$/i.test(abs)) return JSON.parse(await fs.readFile(abs, "utf8"));
  const fh = await fs.open(abs, "r");
  try {
    const head = Buffer.alloc(20);
    await fh.read(head, 0, 20, 0);
    if (head.readUInt32LE(0) !== GLB_MAGIC) throw new Error("not a GLB");
    const jsonLen = head.readUInt32LE(12);
    if (head.readUInt32LE(16) !== CHUNK_JSON) throw new Error("GLB without JSON chunk");
    const buf = Buffer.alloc(jsonLen);
    await fh.read(buf, 0, jsonLen, 20);
    return JSON.parse(buf.toString("utf8"));
  } finally {
    await fh.close();
  }
}

/* ── tiny matrix helpers (column-major, glTF convention) ─────────────────── */

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c += 1)
    for (let r = 0; r < 4; r += 1)
      for (let k = 0; k < 4; k += 1) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}

function nodeMatrix(node) {
  if (Array.isArray(node.matrix) && node.matrix.length === 16) return node.matrix;
  const [tx, ty, tz] = node.translation || [0, 0, 0];
  const [x, y, z, w] = node.rotation || [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale || [1, 1, 1];
  const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  return [
    (1 - 2 * (yy + zz)) * sx, 2 * (xy + wz) * sx, 2 * (xz - wy) * sx, 0,
    2 * (xy - wz) * sy, (1 - 2 * (xx + zz)) * sy, 2 * (yz + wx) * sy, 0,
    2 * (xz + wy) * sz, 2 * (yz - wx) * sz, (1 - 2 * (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

function transformPoint(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

/** World-space AABB of one mesh from its POSITION accessor min/max (8 corners). */
function meshBox(json, meshIndex, matrix, box) {
  const mesh = json.meshes?.[meshIndex];
  for (const prim of mesh?.primitives || []) {
    const acc = json.accessors?.[prim.attributes?.POSITION];
    if (!acc?.min || !acc?.max) continue;
    for (let i = 0; i < 8; i += 1) {
      const p = transformPoint(matrix, [
        i & 1 ? acc.max[0] : acc.min[0],
        i & 2 ? acc.max[1] : acc.min[1],
        i & 4 ? acc.max[2] : acc.min[2],
      ]);
      for (let a = 0; a < 3; a += 1) {
        box.min[a] = Math.min(box.min[a], p[a]);
        box.max[a] = Math.max(box.max[a], p[a]);
      }
    }
  }
}

function emptyBox() {
  return { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
}

function boxSize(box) {
  if (!Number.isFinite(box.min[0])) return null;
  return box.max.map((v, i) => Math.round((v - box.min[i]) * 100) / 100);
}

/**
 * Selectable objects = the children of the scene roots (or the roots themselves when a scene has a
 * single wrapper node). Each carries the size of its whole subtree, measured in the file's units.
 */
function describeGltf(json) {
  const nodes = json.nodes || [];
  const sceneIdx = json.scene ?? 0;
  let roots = json.scenes?.[sceneIdx]?.nodes || [];
  if (roots.length === 1 && !nodes[roots[0]]?.mesh && (nodes[roots[0]]?.children || []).length) {
    roots = nodes[roots[0]].children;
  }

  const subtreeBox = (idx, parent, box, depth = 0) => {
    const node = nodes[idx];
    if (!node || depth > 64) return;
    const m = mul(parent, nodeMatrix(node));
    if (node.mesh !== undefined) meshBox(json, node.mesh, m, box);
    for (const c of node.children || []) subtreeBox(c, m, box, depth + 1);
  };

  const objects = [];
  const whole = emptyBox();
  for (const idx of roots) {
    const node = nodes[idx];
    if (!node) continue;
    const box = emptyBox();
    // Size is measured in the node's own frame: the object is cloned with a reset transform.
    if (node.mesh !== undefined) meshBox(json, node.mesh, IDENTITY, box);
    for (const c of node.children || []) subtreeBox(c, IDENTITY, box);
    subtreeBox(idx, IDENTITY, whole);
    objects.push({ name: node.name || `node_${idx}`, size: boxSize(box) });
  }

  const skinned = (json.skins || []).length > 0;
  const animations = (json.animations || []).map((a, i) => a.name || `clip_${i}`);
  return {
    objects,
    size: boxSize(whole),
    animations,
    skinned,
    meshCount: (json.meshes || []).length,
    materialCount: (json.materials || []).length,
    extensions: json.extensionsRequired || json.extensionsUsed || [],
  };
}

/**
 * @param {string} root
 * @returns {Promise<Array<{ file: string, url: string, bytes: number, objects: Array<{name:string,size:number[]|null}>, size: number[]|null, animations: string[], skinned: boolean, extensions: string[], error?: string }>>}
 */
export async function scanAssetLibrary(root) {
  const files = await walk(assetsDir(root));
  const out = [];
  for (const { rel, abs } of files.sort((a, b) => a.rel.localeCompare(b.rel))) {
    let st;
    try {
      st = await fs.stat(abs);
    } catch {
      continue;
    }
    const fp = `${Math.round(st.mtimeMs)}:${st.size}`;
    const hit = cache.get(rel);
    if (hit?.fp === fp) {
      out.push(hit.entry);
      continue;
    }
    const base = { file: rel, url: `/assets/${rel.split("/").map(encodeURIComponent).join("/")}`, bytes: st.size };
    let entry;
    try {
      entry = { ...base, ...describeGltf(await readGltfJson(abs)) };
    } catch (err) {
      entry = { ...base, objects: [], size: null, animations: [], skinned: false, extensions: [], error: err.message };
    }
    cache.set(rel, { fp, entry });
    out.push(entry);
  }
  return out;
}

const fmtSize = (s) => (s ? `${s[0]}×${s[1]}×${s[2]}` : "?");
const fmtMb = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`;

/**
 * Manifest block for prompts.
 * @param {Awaited<ReturnType<typeof scanAssetLibrary>>} library
 * @param {{ compact?: boolean, maxObjects?: number }} [opts]
 */
export function formatAssetManifest(library, { compact = false, maxObjects = 40, materials = [] } = {}) {
  const usable = library.filter((a) => !a.error);
  if (!usable.length && !materials.length) return "";
  const lines = [
    "## Asset library (`public/assets/**` — read-only, already served)",
    `${usable.length} model file(s), ${materials.length} material set(s). Everything loads through \`/runtime/AssetKit.js\`.`,
    "",
  ];
  if (materials.length) lines.push(formatMaterialManifest(materials, { compact }), "");
  if (usable.length) {
    lines.push(
      "### Models",
      "Load by the **file** path; pull single objects out by **name**. Sizes are W×H×D in the file's units (usually metres) before any scaling.",
    );
  }
  for (const a of usable) {
    const anim = a.animations.length ? ` · clips: ${a.animations.slice(0, 12).join(", ")}` : "";
    lines.push(`#### \`${a.file}\` (${fmtMb(a.bytes)}${a.skinned ? ", skinned" : ""}${anim})`);
    if (compact) {
      lines.push(`objects: ${a.objects.slice(0, maxObjects).map((o) => `"${o.name}"`).join(", ")}${a.objects.length > maxObjects ? ` …(+${a.objects.length - maxObjects})` : ""}`);
      continue;
    }
    for (const o of a.objects.slice(0, maxObjects)) lines.push(`- "${o.name}" — ${fmtSize(o.size)}`);
    if (a.objects.length > maxObjects) lines.push(`- …(+${a.objects.length - maxObjects} more objects)`);
  }
  return lines.join("\n");
}

/**
 * Whole library (models + material sets) and its prompt block in one call.
 * @param {string} root
 * @param {{ compact?: boolean }} [opts]
 */
export async function scanLibrary(root, { compact = false } = {}) {
  const [models, materials] = await Promise.all([scanAssetLibrary(root), scanMaterialSets(root)]);
  return { models, materials, manifest: formatAssetManifest(models, { compact, materials }) };
}

/** True when the generated build imports AssetKit — chat turns then get the library too. */
export async function gameplayUsesAssets(root) {
  const dir = path.join(root, "public", "gameplay");
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries = [];
    try {
      entries = await fs.readdir(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const abs = path.join(cur, ent.name);
      if (ent.isDirectory()) stack.push(abs);
      else if (/\.js$/i.test(ent.name)) {
        const src = await fs.readFile(abs, "utf8").catch(() => "");
        if (src.includes("/runtime/AssetKit.js")) return true;
      }
    }
  }
  return false;
}
