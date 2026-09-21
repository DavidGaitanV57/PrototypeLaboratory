/**
 * Compact API index for `public/runtime/**`.
 *
 * Agents must import the kits, never re-read their sources. Pasting signatures once
 * (prompt) and serving digests on demand (read_file) keeps multi-turn runs cheap.
 */
import fs from "node:fs/promises";
import path from "node:path";

/** @type {Map<string, { fingerprint: string, digest: string }>} */
const fileCache = new Map();
/** @type {Map<string, { fingerprint: string, text: string }>} */
const indexCache = new Map();

/** Kits listed first — the ones gameplay actually wires every build. */
const PRIORITY = [
  "Engine.js",
  "SceneKit.js",
  "Input.js",
  "Primitives.js",
  "CameraRig.js",
  "HudKit.js",
  "JuiceKit.js",
  "PathKit.js",
  "MinimapKit.js",
  "EventBus.js",
];

function runtimeDir(root) {
  return path.join(root, "public", "runtime");
}

/** Skip strings/comments so brace counting does not trip on `"}"`. */
function findBlockEnd(src, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === "/" && src[i + 1] === "/") {
      const nl = src.indexOf("\n", i);
      i = nl === -1 ? src.length : nl;
      continue;
    }
    if (ch === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      i = end === -1 ? src.length : end + 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i += 1;
      while (i < src.length) {
        if (src[i] === "\\") i += 2;
        else if (src[i] === quote) break;
        else i += 1;
      }
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Split an object literal body into its top-level segments (nested groups dropped). */
function topLevelSegments(inner) {
  const segments = [];
  let current = "";
  let depth = 0;
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i];
    if (ch === "/" && inner[i + 1] === "/") {
      const nl = inner.indexOf("\n", i);
      i = nl === -1 ? inner.length : nl;
      continue;
    }
    if (ch === "/" && inner[i + 1] === "*") {
      const end = inner.indexOf("*/", i + 2);
      i = end === -1 ? inner.length : end + 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i += 1;
      while (i < inner.length) {
        if (inner[i] === "\\") i += 2;
        else if (inner[i] === quote) break;
        else i += 1;
      }
      continue;
    }
    if (ch === "{" || ch === "(" || ch === "[") depth += 1;
    else if (ch === "}" || ch === ")" || ch === "]") depth -= 1;
    if (depth === 0 && ch === ",") {
      segments.push(current);
      current = "";
      continue;
    }
    if (depth === 0 || (depth === 1 && (ch === "{" || ch === "(" || ch === "["))) current += ch;
  }
  segments.push(current);
  return segments;
}

function keysFromObjectLiteral(inner) {
  const keys = [];
  for (const seg of topLevelSegments(inner)) {
    if (/^\s*\.\.\./.test(seg)) continue; // spread copies, not a public key
    const m = seg.match(/^\s*(?:get\s+|set\s+|async\s+)?([A-Za-z_$][\w$]*)/);
    if (!m) continue;
    const key = m[1];
    if (["return", "if", "else", "new", "typeof", "await", "function"].includes(key)) continue;
    if (!keys.includes(key)) keys.push(key);
  }
  return keys;
}

/** Find `const <name> = { … }` declared at the factory's top level. */
function keysFromNamedObject(body, name) {
  const re = new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*\\{`);
  const m = body.match(re);
  if (!m) return [];
  const open = body.indexOf("{", m.index + m[0].length - 1);
  const end = findBlockEnd(body, open);
  if (end === -1) return [];
  return keysFromObjectLiteral(body.slice(open + 1, end));
}

/** Public surface of a factory: the `return { … }` (or `return api;`) at body top level. */
function returnedKeys(body) {
  let depth = 0;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (ch === "/" && body[i + 1] === "/") {
      const nl = body.indexOf("\n", i);
      i = nl === -1 ? body.length : nl;
      continue;
    }
    if (ch === "/" && body[i + 1] === "*") {
      const end = body.indexOf("*/", i + 2);
      i = end === -1 ? body.length : end + 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i += 1;
      while (i < body.length) {
        if (body[i] === "\\") i += 2;
        else if (body[i] === quote) break;
        else i += 1;
      }
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    if (depth !== 1 || ch !== "r" || !/^return\b/.test(body.slice(i))) continue;

    const after = body.slice(i + 6).match(/^\s*(\{|[A-Za-z_$][\w$]*)/);
    if (!after) continue;
    if (after[1] === "{") {
      const open = body.indexOf("{", i + 6);
      const end = findBlockEnd(body, open);
      if (end === -1) continue;
      const keys = keysFromObjectLiteral(body.slice(open + 1, end));
      if (keys.length >= 2) return keys.slice(0, 18);
    } else {
      const keys = keysFromNamedObject(body, after[1]);
      if (keys.length >= 2) return keys.slice(0, 18);
    }
  }
  return [];
}

function fileSummary(src) {
  const head = src.slice(0, 600);
  const block = head.match(/\/\*\*([\s\S]*?)\*\//);
  const raw = block
    ? block[1]
    : (head.match(/^\/\/\s?(.+)$/m) || [])[1] || "";
  const line = String(raw)
    .split("\n")
    .map((l) => l.replace(/^\s*\*\s?/, "").trim())
    .filter((l) => l && !l.startsWith("@"))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return line.slice(0, 150);
}

/**
 * Signatures + factory surface for one runtime module.
 * @param {string} name e.g. "HudKit.js"
 * @param {string} src
 */
export function digestRuntimeSource(name, src) {
  const text = String(src || "");
  const lines = [];
  const summary = fileSummary(text);
  lines.push(`### /runtime/${name}`);
  if (summary) lines.push(summary);

  const consts = [...text.matchAll(/^export\s+const\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
  if (consts.length) lines.push(`- const: ${consts.join(", ")}`);

  const fnRe = /^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/gm;
  let m;
  while ((m = fnRe.exec(text))) {
    const fnName = m[1];
    const params = m[2].replace(/\s+/g, " ").trim();
    const open = text.indexOf("{", m.index + m[0].length);
    const end = open === -1 ? -1 : findBlockEnd(text, open);
    const body = open !== -1 && end !== -1 ? text.slice(open, end + 1) : "";
    const keys = returnedKeys(body);
    const sig = `${fnName}(${params})`;
    lines.push(keys.length ? `- ${sig} → { ${keys.join(", ")} }` : `- ${sig}`);
  }

  if (lines.length === 1) lines.push("(no exports detected)");
  return lines.join("\n");
}

async function listRuntimeFiles(root) {
  let names = [];
  try {
    names = (await fs.readdir(runtimeDir(root))).filter((f) => f.endsWith(".js"));
  } catch {
    return [];
  }
  return names.sort((a, b) => {
    const ia = PRIORITY.indexOf(a);
    const ib = PRIORITY.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a.localeCompare(b);
  });
}

async function fingerprint(root, names) {
  const parts = [];
  for (const name of names) {
    try {
      const st = await fs.stat(path.join(runtimeDir(root), name));
      parts.push(`${name}:${Math.round(st.mtimeMs)}:${st.size}`);
    } catch {
      /* skip */
    }
  }
  return parts.join("|");
}

/**
 * Digest for a single runtime module (used when an agent still calls read_file).
 * @param {string} root
 * @param {string} rel e.g. "public/runtime/HudKit.js"
 */
export async function runtimeFileDigest(root, rel) {
  const name = path.basename(String(rel || ""));
  const abs = path.join(runtimeDir(root), name);
  let st;
  try {
    st = await fs.stat(abs);
  } catch {
    return null;
  }
  const fp = `${Math.round(st.mtimeMs)}:${st.size}`;
  const hit = fileCache.get(name);
  if (hit?.fingerprint === fp) return hit.digest;
  const src = await fs.readFile(abs, "utf8").catch(() => "");
  if (!src) return null;
  const digest = digestRuntimeSource(name, src);
  fileCache.set(name, { fingerprint: fp, digest });
  return digest;
}

/** One line per module: `HudKit.js: createHud, themeFromPalette` — for chat turns. */
function compactLines(blocks) {
  return blocks.map((block) => {
    const lines = block.split("\n");
    const name = (lines[0] || "").replace("### /runtime/", "").trim();
    const names = lines
      .filter((l) => l.startsWith("- "))
      .map((l) => l.replace(/^-\s+/, "").replace(/^const:\s*/, "").split(/[(→]/)[0].trim())
      .filter(Boolean);
    return `- \`/runtime/${name}\` — ${names.join(", ")}`;
  });
}

/**
 * Whole-runtime API index for prompts — replaces per-file reads entirely.
 * @param {string} root
 * @param {{ compact?: boolean }} [opts] compact = names only (chat turns)
 * @returns {Promise<string>}
 */
export async function buildRuntimeApiIndex(root, { compact = false } = {}) {
  const names = await listRuntimeFiles(root);
  if (!names.length) return "";
  const fp = await fingerprint(root, names);
  const key = compact ? "compact" : "full";
  const hit = indexCache.get(key);
  if (hit?.fingerprint === fp) return hit.text;

  const blocks = [];
  for (const name of names) {
    const digest = await runtimeFileDigest(root, `public/runtime/${name}`);
    if (digest) blocks.push(digest);
  }
  const text = compact
    ? [
        "## Runtime API index (import — do NOT read runtime sources)",
        ...compactLines(blocks),
      ].join("\n")
    : [
        "## Runtime API index (import these — do NOT read runtime sources)",
        "Every export below is already available at `/runtime/<file>`. Reading those files wastes turns; this index is the contract.",
        "",
        ...blocks,
      ].join("\n");
  indexCache.set(key, { fingerprint: fp, text });
  return text;
}
