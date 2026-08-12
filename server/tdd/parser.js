import fs from "node:fs/promises";
import path from "node:path";
import { assertSafeSlug, SAFE_SLUG_RE } from "../security/paths.js";

export function parseMechanics(markdown) {
  const lines = String(markdown || "").split(/\r?\n/);
  const mechanics = [];
  let current = null;

  for (const line of lines) {
    const m =
      line.match(/^##\s+Mechanic:\s*(.+?)\s*$/i) ||
      line.match(/^##\s+\*\*Mechanic:\s*(.+?)\*\*\s*$/i);
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
    markdown.match(/\|\s*\*\*Game title\*\*\s*\|\s*([^|]+)\|/i);
  return (m?.[1] || "Untitled").trim();
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
    const tddPath = path.join(tddsRoot, ent.name, "TDD.md");
    try {
      const text = await fs.readFile(tddPath, "utf8");
      out.push({
        slug: ent.name,
        projectName: parseProjectName(text),
        mechanics: parseMechanics(text).map((m) => ({ id: m.id, title: m.title, type: m.type })),
      });
    } catch {
      /* skip */
    }
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

export async function readTdd(tddsRoot, slug) {
  const safe = assertSafeSlug(slug);
  const tddPath = path.join(tddsRoot, safe, "TDD.md");
  const text = await fs.readFile(tddPath, "utf8");
  return {
    slug: safe,
    path: tddPath,
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
