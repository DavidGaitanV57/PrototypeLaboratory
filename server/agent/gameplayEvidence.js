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
