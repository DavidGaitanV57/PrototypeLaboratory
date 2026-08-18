import fs from "node:fs/promises";
import path from "node:path";

/**
 * List relative paths under public/gameplay/ for sync evidence prompts.
 * @param {string} root
 * @returns {Promise<string[]>}
 */
export async function listGameplayFiles(root) {
  const gameplayDir = path.join(root, "public", "gameplay");
  const out = [];
  async function walk(dir, prefix = "public/gameplay") {
    let entries = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (ent.name.startsWith(".")) continue;
      const rel = `${prefix}/${ent.name}`;
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) await walk(abs, rel);
      else if (ent.isFile() && /\.(js|json|yaml|yml|md)$/i.test(ent.name)) out.push(rel);
    }
  }
  await walk(gameplayDir);
  return out.sort();
}

/**
 * @param {{ role: string, message: string }[]} history
 * @param {string} [clientDigest]
 * @param {number} [limit]
 */
export function mergeChatDigest(history = [], clientDigest = "", limit = 16) {
  const serverLines = history
    .slice(-limit)
    .map((h) => {
      const text = String(h.message || "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 320);
      return text ? `${h.role || "user"}: ${text}` : "";
    })
    .filter(Boolean);

  const client = String(clientDigest || "").trim();
  if (serverLines.length && client) {
    return `${client}\n\n--- session history ---\n${serverLines.join("\n")}`;
  }
  if (client) return client;
  if (serverLines.length) return serverLines.join("\n");
  return "";
}

const SYNC_KINDS = new Set(["mechanic", "number", "input", "camera", "hud", "loop", "other"]);

function tryParseJsonBlob(raw) {
  const t = String(raw || "").trim();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    /* fall through */
  }
  const startObj = t.indexOf("{");
  const startArr = t.indexOf("[");
  let start = -1;
  if (startObj >= 0 && (startArr < 0 || startObj < startArr)) start = startObj;
  else if (startArr >= 0) start = startArr;
  if (start < 0) return null;
  const endObj = t.lastIndexOf("}");
  const endArr = t.lastIndexOf("]");
  const end = Math.max(endObj, endArr);
  if (end <= start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeSyncItem(it, index) {
  if (!it || typeof it !== "object") return null;
  const title = String(it.title || it.name || "").trim().slice(0, 160);
  if (!title) return null;
  const kindRaw = String(it.kind || "other").toLowerCase().trim();
  const kind = SYNC_KINDS.has(kindRaw) ? kindRaw : "other";
  return {
    id: String(it.id || `change-${index + 1}`)
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80) || `change-${index + 1}`,
    kind,
    title,
    section: String(it.section || "").trim().slice(0, 80),
    detail: String(it.detail || it.summary || it.description || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 600),
  };
}

/**
 * Parse model output into a Sync TDD checklist.
 * @param {string} raw
 * @returns {{ items: { id: string, kind: string, title: string, section: string, detail: string }[] }}
 */
export function parseSyncProposal(raw) {
  const text = String(raw || "");
  const fenced = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((m) => m[1]);
  const candidates = [...fenced, text];
  for (let i = candidates.length - 1; i >= 0; i--) {
    const parsed = tryParseJsonBlob(candidates[i]);
    if (!parsed) continue;
    const list = Array.isArray(parsed) ? parsed : parsed.items;
    if (!Array.isArray(list)) continue;
    const items = list
      .slice(0, 40)
      .map((it, idx) => normalizeSyncItem(it, idx))
      .filter(Boolean);
    const seen = new Set();
    const unique = [];
    for (const it of items) {
      let id = it.id;
      let n = 2;
      while (seen.has(id)) {
        id = `${it.id}-${n++}`;
      }
      seen.add(id);
      unique.push({ ...it, id });
    }
    return { items: unique };
  }
  return { items: [] };
}

/**
 * @param {{ id?: string, title?: string, kind?: string, section?: string, detail?: string }[]} items
 */
export function formatSelectedSyncItems(items = []) {
  if (!items.length) return "";
  return items
    .map((it, i) => {
      const title = String(it.title || it.id || `Item ${i + 1}`).trim();
      const bits = [
        `${i + 1}. ${title}`,
        it.kind ? `   kind: ${it.kind}` : "",
        it.section ? `   section: ${it.section}` : "",
        it.detail ? `   ${String(it.detail).trim()}` : "",
      ].filter(Boolean);
      return bits.join("\n");
    })
    .join("\n");
}
