/**
 * Section index for long TDDs.
 *
 * A V57 TDD is far bigger than any sane per-turn budget, and the mechanics that
 * matter most (§B) sit at the end. Head-truncating a read would silently drop them,
 * so agents get an outline plus targeted section reads instead.
 */

const HEADING_RE = /^(#{1,4})\s+(.+?)\s*$/gm;

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[§·•]/g, " ")
    .replace(/[^\w.]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * @param {string} text
 * @returns {{ level: number, title: string, start: number, bodyStart: number, end: number, chars: number }[]}
 */
export function buildTddOutline(text) {
  const src = String(text || "");
  const heads = [];
  let m;
  HEADING_RE.lastIndex = 0;
  while ((m = HEADING_RE.exec(src))) {
    heads.push({
      level: m[1].length,
      title: m[2].replace(/\s*\{#.*\}$/, "").trim(),
      start: m.index,
      bodyStart: m.index + m[0].length,
    });
  }
  return heads.map((h, i) => {
    let end = src.length;
    for (let j = i + 1; j < heads.length; j += 1) {
      if (heads[j].level <= h.level) {
        end = heads[j].start;
        break;
      }
    }
    return { ...h, end, chars: end - h.start };
  });
}

/**
 * Compact map an agent can scan before deciding what to open.
 * Every top-level and §-level heading survives; repeated boilerplate sub-headings
 * ("Rules (quantified)" under each mechanic) are dropped so the list stays scannable.
 */
export function formatTddOutline(sections, { maxEntries = 120 } = {}) {
  const repeats = new Map();
  for (const s of sections) {
    if (s.level >= 3) repeats.set(s.title, (repeats.get(s.title) || 0) + 1);
  }
  const rows = sections
    .filter((s) => s.level <= 2 || (s.level === 3 && (repeats.get(s.title) || 0) <= 2))
    .slice(0, maxEntries)
    .map((s) => `${"  ".repeat(Math.max(0, s.level - 1))}- ${s.title} (${s.chars} chars)`);
  return rows.join("\n");
}

/**
 * Best-matching section for a free-form query ("§B", "11.3", "Mechanic: Sanity System").
 * @returns {{ title: string, content: string } | null}
 */
export function extractTddSection(text, query) {
  const src = String(text || "");
  const sections = buildTddOutline(src);
  if (!sections.length) return null;
  const q = normalize(query);
  if (!q) return null;

  const scored = sections
    .map((s) => {
      const title = normalize(s.title);
      let score = 0;
      if (title === q) score = 100;
      else if (title.startsWith(q) || q.startsWith(title)) score = 80;
      else if (title.includes(q)) score = 60;
      else if (q.includes(title) && title.length > 3) score = 50;
      else {
        const words = q.split(" ").filter((w) => w.length > 2);
        const hits = words.filter((w) => title.includes(w)).length;
        if (hits) score = 20 + hits * 5;
      }
      // Prefer the tighter heading when several match (e.g. "Mechanic: X" over "§B").
      if (score) score += Math.max(0, 4 - s.level);
      return { s, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.s.chars - b.s.chars);

  if (!scored.length) return null;
  const best = scored[0].s;
  return { title: best.title, content: src.slice(best.start, best.end) };
}

/**
 * What a `read_file` on a long TDD returns: orientation, not a blind head dump.
 * @param {string} rel
 * @param {string} text
 * @param {{ headChars?: number }} [opts]
 */
export function buildTddBrief(rel, text, { headChars = 6000 } = {}) {
  const src = String(text || "");
  const sections = buildTddOutline(src);
  const outline = formatTddOutline(sections);
  return [
    `# TDD map — ${rel} (${src.length} chars, too large to send whole)`,
    "",
    "## Sections",
    outline || "(no headings found)",
    "",
    `Call read_section({ path: "${rel}", section: "<title above>" }) for the blocks you need`,
    "(e.g. a specific `Mechanic: …`, `11.3 Input map`, or the art/atmosphere section).",
    "Do not request every section — open only what the build needs.",
    "",
    "## Opening",
    src.slice(0, headChars),
  ].join("\n");
}
