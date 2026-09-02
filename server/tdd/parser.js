import fs from "node:fs/promises";
import path from "node:path";
import { assertSafeSlug, SAFE_SLUG_RE } from "../security/paths.js";

/** Version snapshots written by sync — never treat as the active TDD. */
const VERSION_SNAP_RE = /^TDD\.v\d+\.\d+\.\d+\.md$/i;
const SKIP_MD_NAMES = new Set(["changelog.md"]);

export function parseMechanics(markdown) {
  const lines = String(markdown || "").split(/\r?\n/);
  const mechanics = [];
  let current = null;

  for (const line of lines) {
    const m =
      line.match(/^#{2,3}\s+Mechanic:\s*(.+?)\s*$/i) ||
      line.match(/^#{2,3}\s+\*\*Mechanic:\s*(.+?)\*\*\s*$/i);
    if (m) {
      if (current) mechanics.push(current);
      const title = m[1].replace(/\*+/g, "").trim();
      current = {
        id: toMechanicId(title),
        title,
        body: "",
      };
      continue;
    }
    if (current) current.body += (current.body ? "\n" : "") + line;
  }
  if (current) mechanics.push(current);

  for (const mech of mechanics) {
    const type = mech.body.match(/^\s*[-*]?\s*\*?\*?type\*?\*?\s*[:|]\s*`?(\w+)`?/im);
    if (type) mech.type = type[1];
    const desc = mech.body.match(/Player-facing behavior[\s\S]*?\n([\s\S]{0,280})/i);
    if (desc) mech.description = desc[1].trim().split("\n")[0];
  }
  return mechanics;
}

export function toMechanicId(title) {
  return String(title)
    .replace(/[^a-zA-Z0-9]+/g, "")
    .replace(/^\d+/, "") || "Mechanic";
}

export function parseProjectName(markdown) {
  const m =
    markdown.match(/project_name:\s*["']?([^"'\n]+)/i) ||
    markdown.match(/\|\s*\*\*Game title\*\*\s*\|\s*([^|]+)\|/i) ||
    markdown.match(/project:\s*\r?\n\s*name:\s*["']?([^"'\n]+)/i);
  return (m?.[1] || "Untitled").trim();
}

/**
 * Pick the active TDD markdown inside a slug folder.
 * Prefers `TDD.md`; otherwise the first non-snapshot `.md` (folder-name match first).
 * @returns {Promise<{ slug: string, fileName: string, absPath: string, relPath: string }>}
 */
export async function resolveTddFile(tddsRoot, slug) {
  const safe = assertSafeSlug(slug);
  const dir = path.join(tddsRoot, safe);
  const preferredName = "TDD.md";
  const preferred = path.join(dir, preferredName);
  try {
    await fs.access(preferred);
    return {
      slug: safe,
      fileName: preferredName,
      absPath: preferred,
      relPath: `docs/tdds/${safe}/${preferredName}`,
    };
  } catch {
    /* fall through to any .md */
  }

  let entries = [];
  try {
    entries = await fs.readdir(dir);
  } catch (err) {
    throw new Error(`TDD folder not found: docs/tdds/${safe}`);
  }

  const candidates = entries
    .filter((name) => {
      if (!/\.md$/i.test(name)) return false;
      if (VERSION_SNAP_RE.test(name)) return false;
      if (SKIP_MD_NAMES.has(name.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      const stem = (n) => n.replace(/\.md$/i, "");
      const aHit = stem(a).toLowerCase() === safe.toLowerCase() ? 0 : 1;
      const bHit = stem(b).toLowerCase() === safe.toLowerCase() ? 0 : 1;
      if (aHit !== bHit) return aHit - bHit;
      return a.localeCompare(b);
    });

  if (!candidates.length) {
    throw new Error(`No TDD markdown found in docs/tdds/${safe}/`);
  }

  const fileName = candidates[0];
  return {
    slug: safe,
    fileName,
    absPath: path.join(dir, fileName),
    relPath: `docs/tdds/${safe}/${fileName}`,
  };
}

export async function listTdds(tddsRoot) {
  let entries = [];
  try {
    entries = await fs.readdir(tddsRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    if (!SAFE_SLUG_RE.test(ent.name)) continue;
    try {
      const resolved = await resolveTddFile(tddsRoot, ent.name);
      const text = await fs.readFile(resolved.absPath, "utf8");
      out.push({
        slug: ent.name,
        fileName: resolved.fileName,
        projectName: parseProjectName(text),
        mechanics: parseMechanics(text).map((m) => ({ id: m.id, title: m.title, type: m.type })),
      });
    } catch {
      /* skip folders without a readable TDD markdown */
    }
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

export async function readTdd(tddsRoot, slug) {
  const resolved = await resolveTddFile(tddsRoot, slug);
  const text = await fs.readFile(resolved.absPath, "utf8");
  return {
    slug: resolved.slug,
    fileName: resolved.fileName,
    path: resolved.absPath,
    relPath: resolved.relPath,
    text,
    projectName: parseProjectName(text),
    mechanics: parseMechanics(text),
  };
}

export async function importTddUpload(tddsRoot, filename, buffer) {
  const base =
    path
      .basename(filename, path.extname(filename))
      .replace(/[^A-Za-z0-9_-]+/g, "")
      .slice(0, 80) || "Imported";
  let slug = assertSafeSlug(base);
  let i = 1;
  while (true) {
    try {
      await fs.access(path.join(tddsRoot, slug));
      slug = assertSafeSlug(`${base}${i++}`.slice(0, 80));
    } catch {
      break;
    }
  }
  const dir = path.join(tddsRoot, slug);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "TDD.md"), buffer, "utf8");
  return readTdd(tddsRoot, slug);
}
