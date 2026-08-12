import path from "node:path";

/** TDD folder / session slug: no path separators or traversal. */
export const SAFE_SLUG_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;

const SENSITIVE_BASENAMES = new Set([
  ".env",
  ".lab-agent-provider",
  ".npmrc",
  ".netrc",
  "credentials.json",
  "secrets.json",
]);

/**
 * @param {unknown} slug
 * @returns {string}
 */
export function assertSafeSlug(slug) {
  const s = String(slug ?? "").trim();
  if (!SAFE_SLUG_RE.test(s)) {
    throw new Error("Invalid slug — use letters, numbers, _ or - only");
  }
  return s;
}

/**
 * Normalize a relative project path and reject `..` escapes.
 * @param {unknown} p
 * @returns {string} forward-slash relative path
 */
export function canonicalizeRel(p) {
  const raw = String(p || "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "");
  if (!raw) throw new Error("Path required");
  if (raw.includes("\0")) throw new Error("Invalid path");
  const parts = [];
  for (const seg of raw.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") {
      if (!parts.length) throw new Error(`Path escapes project root: ${p}`);
      parts.pop();
      continue;
    }
    parts.push(seg);
  }
  if (!parts.length) throw new Error("Path required");
  return parts.join("/");
}

/**
 * Resolve `rel` under `root` and ensure the result stays inside `root`.
 * @param {string} root
 * @param {string} rel
 * @returns {string} absolute path
 */
export function resolveWithinRoot(root, rel) {
  const rootAbs = path.resolve(root);
  const abs = path.resolve(rootAbs, canonicalizeRel(rel));
  if (abs !== rootAbs && !abs.startsWith(rootAbs + path.sep)) {
    throw new Error(`Path escapes project root: ${rel}`);
  }
  return abs;
}

/**
 * True if `candidate` is `dir` or a path inside it.
 * @param {string} dir
 * @param {string} candidate
 */
export function isInsideDir(dir, candidate) {
  const base = path.resolve(dir);
  const target = path.resolve(candidate);
  return target === base || target.startsWith(base + path.sep);
}

/**
 * Block reads of credential / env files (relative path).
 * @param {string} rel
 */
export function isSensitiveRel(rel) {
  let r;
  try {
    r = canonicalizeRel(rel);
  } catch {
    return true;
  }
  const base = path.posix.basename(r);
  if (SENSITIVE_BASENAMES.has(base)) return true;
  if (base.startsWith(".env.")) return true;
  if (/\.(pem|key|p12|pfx)$/i.test(base)) return true;
  if (/(^|\/)\.git(\/|$)/i.test(r)) return true;
  return false;
}

/**
 * Export destinations must stay under `<root>/exports`.
 * @param {string} root
 * @param {string | null | undefined} destination
 * @param {{ slug: string, stamp: string }} opts
 * @returns {{ ok: true, dest: string } | { ok: false, reason: string }}
 */
export function resolveExportDestination(root, destination, { slug, stamp }) {
  const exportsRoot = path.resolve(root, "exports");
  if (!destination || !String(destination).trim()) {
    return { ok: true, dest: path.join(exportsRoot, `${slug}-${stamp}`) };
  }
  const raw = String(destination).trim();
  let dest;
  try {
    dest = path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(root, raw);
  } catch {
    return { ok: false, reason: "Invalid export destination" };
  }
  if (!isInsideDir(exportsRoot, dest)) {
    return {
      ok: false,
      reason: "Export destination must be inside the project exports/ folder",
    };
  }
  return { ok: true, dest };
}
