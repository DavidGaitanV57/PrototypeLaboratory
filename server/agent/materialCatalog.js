/**
 * Material sets in the asset library — tiling PBR textures for floors, walls, ceilings, ground…
 *
 * A set is a group of images that share a base name and differ by a map suffix
 * (`carpet_color.png`, `carpet_normal.png`, `carpet_rough.png`). One set per folder is the norm;
 * several sets in one folder are told apart by base name. An optional `material.json` (or
 * `<base>.material.json` in a multi-set folder) declares what the textures cannot say: real-world
 * tile size, which surfaces it is meant for, and shading overrides. Spec: ASSETS.md.
 *
 * Without a sidecar every field is inferred (surfaces from the name, 2 m tiles) and flagged so the
 * prompt can tell the model it is a guess.
 */
import fs from "node:fs/promises";
import path from "node:path";

const IMAGE_RE = /\.(png|jpe?g|webp)$/i;
const SKIP_DIRS = /^(previews?|thumbs?|thumbnails?|_.*)$/i;

export const MATERIAL_SCHEMA_VERSION = 1;
export const SURFACES = ["floor", "wall", "ceiling", "ground", "path", "trim", "water", "any"];
export const MAP_KEYS = ["color", "normal", "roughness", "metalness", "ao", "orm", "height", "emissive", "opacity"];
export const DEFAULT_TILE_SIZE = 2;

/** Suffix (separators removed, lower case) → map key. "normaldx" is a normal map with a flipped green channel. */
const MAP_ALIASES = {
  color: ["color", "colour", "albedo", "basecolor", "basecolour", "diffuse", "diff", "col", "alb"],
  normal: ["normal", "normalgl", "norgl", "nrm", "nor", "norm", "normalmap"],
  normaldx: ["normaldx", "nordx"],
  roughness: ["roughness", "rough", "rgh"],
  metalness: ["metalness", "metallic", "metal", "met"],
  ao: ["ao", "ambientocclusion", "occlusion", "occ"],
  orm: ["orm", "arm"],
  height: ["height", "heightmap", "displacement", "disp", "bump"],
  emissive: ["emissive", "emission", "emit", "glow"],
  opacity: ["opacity", "alpha", "mask", "transparency"],
};
const SUFFIX_TO_MAP = new Map(Object.entries(MAP_ALIASES).flatMap(([k, list]) => list.map((s) => [s, k])));

/** Name keywords → surfaces, used only when no sidecar says otherwise. */
const SURFACE_HINTS = [
  ["ceiling", /ceiling|techo/i],
  ["floor", /carpet|floor|rug|parquet|laminate|linoleum|moqueta|suelo|piso/i],
  ["wall", /wall|plaster|brick|drywall|pared|muro/i],
  ["ground", /grass|dirt|sand|mud|gravel|soil|snow|terrain|cesped|tierra|arena/i],
  ["path", /asphalt|road|cobble|pavement|sidewalk|asfalto|camino/i],
  ["water", /water|agua/i],
  ["trim", /trim|molding|moulding|baseboard|zocalo/i],
];

const ALLOWED_KEYS = new Set([
  "$schema", "version", "name", "description", "surfaces", "tags", "tileSize", "maps",
  "normalConvention", "tint", "roughness", "metalness", "normalScale", "height",
  "emissive", "emissiveIntensity", "transparent", "alphaTest", "doubleSided",
]);

/**
 * Split "Bricks059_1K-PNG_NormalGL" → { base: "Bricks059_1K-PNG", map: "normaldx"|… }.
 * Tries the last two tokens joined (nor_gl, base_color, ambient_occlusion), then the last one.
 * A trailing resolution token (_1k, _2048) is ignored.
 */
export function parseTextureName(fileName) {
  const stem = fileName.replace(IMAGE_RE, "");
  const parts = stem.split(/([_\-. ])/); // keep separators to rebuild the base exactly
  const tokens = [];
  for (let i = 0; i < parts.length; i += 2) tokens.push({ text: parts[i], idx: i });
  let end = tokens.length;
  while (end > 1 && /^(\d+k|\d{3,5}(px)?)$/i.test(tokens[end - 1].text)) end -= 1;
  for (const take of [2, 1]) {
    if (end - take < 1) continue;
    const key = tokens.slice(end - take, end).map((t) => t.text.toLowerCase()).join("");
    const map = SUFFIX_TO_MAP.get(key);
    if (map) {
      const cut = tokens[end - take].idx;
      const base = parts.slice(0, Math.max(0, cut - 1)).join("");
      return { base, map };
    }
  }
  return null;
}

function inferSurfaces(text) {
  const out = SURFACE_HINTS.filter(([, re]) => re.test(text)).map(([s]) => s);
  return out.length ? out : ["any"];
}

const isHex = (v) => typeof v === "string" && /^#?[0-9a-f]{6}$/i.test(v);
const isNum = (v, min = -Infinity, max = Infinity) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;

/**
 * Validate a sidecar. Bad fields are dropped with a warning — a typo never breaks generation.
 * @returns {{ value: object, warnings: string[] }}
 */
export function validateMaterialJson(raw, { files = [] } = {}) {
  const warnings = [];
  const value = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { value, warnings: ["material.json must be a JSON object"] };
  }
  for (const k of Object.keys(raw)) if (!ALLOWED_KEYS.has(k)) warnings.push(`unknown key "${k}" ignored`);
  const take = (key, ok, msg) => {
    if (raw[key] === undefined) return;
    if (ok(raw[key])) value[key] = raw[key];
    else warnings.push(`"${key}" ${msg} — ignored`);
  };
  take("version", (v) => v === MATERIAL_SCHEMA_VERSION, `must be ${MATERIAL_SCHEMA_VERSION}`);
  take("name", (v) => typeof v === "string" && v.trim(), "must be a non-empty string");
  take("description", (v) => typeof v === "string", "must be a string");
  take("surfaces", (v) => Array.isArray(v) && v.length && v.every((s) => SURFACES.includes(s)), `must be a non-empty array of: ${SURFACES.join(", ")}`);
  take("tags", (v) => Array.isArray(v) && v.every((s) => typeof s === "string"), "must be an array of strings");
  take("tileSize", (v) => isNum(v, 0.01, 1000) || (Array.isArray(v) && v.length === 2 && v.every((n) => isNum(n, 0.01, 1000))), "must be metres (number) or [width, height]");
  take("normalConvention", (v) => v === "gl" || v === "dx", 'must be "gl" or "dx"');
  take("tint", isHex, 'must be a hex colour like "#ffffff"');
  take("roughness", (v) => isNum(v, 0, 1), "must be 0..1");
  take("metalness", (v) => isNum(v, 0, 1), "must be 0..1");
  take("normalScale", (v) => isNum(v, 0, 10), "must be 0..10");
  take("emissive", isHex, 'must be a hex colour like "#000000"');
  take("emissiveIntensity", (v) => isNum(v, 0, 100), "must be 0..100");
  take("transparent", (v) => typeof v === "boolean", "must be true/false");
  take("alphaTest", (v) => isNum(v, 0, 1), "must be 0..1");
  take("doubleSided", (v) => typeof v === "boolean", "must be true/false");
  take(
    "height",
    (v) => v && typeof v === "object" && ["bump", "displacement", "none"].includes(v.mode ?? "bump") && (v.scale === undefined || isNum(v.scale, 0, 100)),
    'must be { "mode": "bump"|"displacement"|"none", "scale": number }',
  );
  if (raw.maps !== undefined) {
    if (!raw.maps || typeof raw.maps !== "object" || Array.isArray(raw.maps)) {
      warnings.push('"maps" must be an object — ignored');
    } else {
      value.maps = {};
      for (const [k, f] of Object.entries(raw.maps)) {
        if (!MAP_KEYS.includes(k)) warnings.push(`maps.${k}: unknown map (use ${MAP_KEYS.join(", ")}) — ignored`);
        else if (typeof f !== "string" || !files.includes(f)) warnings.push(`maps.${k}: file "${f}" not found in the folder — ignored`);
        else value.maps[k] = f;
      }
    }
  }
  return { value, warnings };
}

async function readJson(abs) {
  try {
    return { json: JSON.parse(await fs.readFile(abs, "utf8")) };
  } catch (err) {
    if (err.code === "ENOENT") return null;
    return { error: `invalid JSON (${err.message})` };
  }
}

const toPosix = (p) => p.split(path.sep).join("/");

async function scanDir(dirAbs, dirRel, out) {
  let entries = [];
  try {
    entries = await fs.readdir(dirAbs, { withFileTypes: true });
  } catch {
    return;
  }
  const files = entries.filter((e) => e.isFile()).map((e) => e.name);
  for (const ent of entries) {
    if (ent.isDirectory() && !ent.name.startsWith(".") && !SKIP_DIRS.test(ent.name)) {
      await scanDir(path.join(dirAbs, ent.name), dirRel ? `${dirRel}/${ent.name}` : ent.name, out);
    }
  }
  const images = files.filter((f) => IMAGE_RE.test(f));
  if (!images.length) return;
  const hasSidecar = files.some((f) => /(^|\.)material\.json$/i.test(f));
  // A .gltf keeps its textures next to it — those images belong to the model, not to a set.
  if (files.some((f) => /\.gltf$/i.test(f)) && !hasSidecar) return;

  /** @type {Map<string, Record<string,string>>} */
  const groups = new Map();
  for (const img of images) {
    const parsed = parseTextureName(img);
    if (!parsed) continue;
    const g = groups.get(parsed.base) || {};
    const key = parsed.map === "normaldx" ? "normal" : parsed.map;
    if (!g[key]) g[key] = img;
    if (parsed.map === "normaldx") g.__dx = "1";
    groups.set(parsed.base, g);
  }
  // Folder-level sidecar may name maps whose files do not follow the suffix convention.
  if (!groups.size && files.includes("material.json")) groups.set(path.basename(dirAbs), {});

  const single = groups.size === 1;
  for (const [base, detected] of groups) {
    const id = single ? dirRel || base : dirRel ? `${dirRel}/${base}` : base;
    const sidecarName = single && files.includes("material.json") ? "material.json" : files.includes(`${base}.material.json`) ? `${base}.material.json` : null;
    const warnings = [];
    let meta = {};
    if (sidecarName) {
      const read = await readJson(path.join(dirAbs, sidecarName));
      if (read?.error) warnings.push(`${sidecarName}: ${read.error}`);
      else if (read?.json) {
        const v = validateMaterialJson(read.json, { files: images });
        meta = v.value;
        warnings.push(...v.warnings.map((w) => `${sidecarName}: ${w}`));
      }
    }
    const { __dx, ...auto } = detected;
    const maps = { ...auto, ...(meta.maps || {}) };
    if (!maps.color && !maps.orm && !maps.normal) continue;
    const prefix = dirRel ? `${dirRel}/` : "";
    let bytes = 0;
    for (const f of Object.values(maps)) bytes += (await fs.stat(path.join(dirAbs, f)).catch(() => ({ size: 0 }))).size;
    const ts = meta.tileSize ?? DEFAULT_TILE_SIZE;
    const hasNormal = Boolean(maps.normal);
    out.push({
      id,
      name: meta.name || base.replace(/[_-]+/g, " ").trim() || id,
      description: meta.description || "",
      surfaces: meta.surfaces || inferSurfaces(`${id} ${base}`),
      tags: meta.tags || [],
      tileSize: Array.isArray(ts) ? ts : [ts, ts],
      maps: Object.fromEntries(Object.entries(maps).map(([k, f]) => [k, `${prefix}${f}`])),
      normalConvention: meta.normalConvention || (__dx ? "dx" : "gl"),
      tint: meta.tint || "#ffffff",
      roughness: meta.roughness ?? 1,
      metalness: meta.metalness ?? (maps.metalness || maps.orm ? 1 : 0),
      normalScale: meta.normalScale ?? 1,
      height: maps.height
        ? { mode: meta.height?.mode || (hasNormal ? "none" : "bump"), scale: meta.height?.scale ?? (meta.height?.mode === "displacement" ? 0.05 : 1) }
        : { mode: "none", scale: 0 },
      emissive: meta.emissive || (maps.emissive ? "#ffffff" : "#000000"),
      emissiveIntensity: meta.emissiveIntensity ?? 1,
      transparent: meta.transparent ?? false,
      alphaTest: meta.alphaTest ?? 0,
      doubleSided: meta.doubleSided ?? false,
      sidecar: sidecarName ? `${prefix}${sidecarName}` : null,
      inferred: { surfaces: !meta.surfaces, tileSize: meta.tileSize === undefined },
      bytes,
      warnings,
    });
  }
}

/** Every material set under public/assets/**, sorted by id. */
export async function scanMaterialSets(root) {
  const out = [];
  await scanDir(path.join(root, "public", "assets"), "", out);
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/** What `/assets/library.json` serves — the runtime (AssetKit.loadMaterial) resolves sets from it. */
export function materialLibraryIndex(sets) {
  return {
    version: MATERIAL_SCHEMA_VERSION,
    materials: Object.fromEntries(
      sets.map(({ id, name, surfaces, tileSize, maps, normalConvention, tint, roughness, metalness, normalScale, height, emissive, emissiveIntensity, transparent, alphaTest, doubleSided }) => [
        id,
        { name, surfaces, tileSize, maps: Object.fromEntries(Object.entries(maps).map(([k, f]) => [k, toPosix(f)])), normalConvention, tint, roughness, metalness, normalScale, height, emissive, emissiveIntensity, transparent, alphaTest, doubleSided },
      ]),
    ),
  };
}

/** Prompt block for material sets. */
export function formatMaterialManifest(sets, { compact = false } = {}) {
  if (!sets.length) return "";
  const lines = [
    "### Material sets (tiling PBR textures — floors, walls, ceilings, ground)",
    "Load by **id** with `loadMaterial(id)`; build surfaces with `texturedBox` / `texturedPlane` (or `tileUv` on your own mesh) so textures repeat at real-world scale instead of stretching. `tile` = metres one repeat covers. `(guessed)` = no material.json, inferred from the name.",
  ];
  for (const s of sets) {
    const surf = `${s.surfaces.join("/")}${s.inferred.surfaces ? " (guessed)" : ""}`;
    if (compact) {
      lines.push(`- \`${s.id}\` — ${surf}`);
      continue;
    }
    const tile = `${s.tileSize[0] === s.tileSize[1] ? s.tileSize[0] : s.tileSize.join("×")} m${s.inferred.tileSize ? " (guessed)" : ""}`;
    const tags = s.tags.length ? ` · tags: ${s.tags.join(", ")}` : "";
    const desc = s.description ? ` — ${s.description.slice(0, 160)}` : "";
    lines.push(`- \`${s.id}\` — ${surf} · tile ${tile} · maps: ${Object.keys(s.maps).join(", ")}${tags}${desc}`);
  }
  return lines.join("\n");
}
