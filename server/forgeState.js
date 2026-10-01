// ─── Where this Laboratory's work actually lives ─────────────────────────────
//
// This service runs on an instance whose disk is EPHEMERAL. Every redeploy, and every idle
// shutdown, takes with it:
//
//   public/gameplay/     the generated playable   (gitignored)
//   docs/tdds/           the pushed TDDs          (not in the repo at all)
//   workspaces/<slug>/   each project's bench     (gitignored)
//
// And the worst one never even reaches the disk: the chat. `sessions` is a `Map` in index.js and
// `chatHistory` / `checkpoint` are closures in agent/session.js, so the whole conversation with the
// model — which is where the prototyping judgement lives — dies with the process.
// `/api/sessions/resume` does not bring it back; it opens a fresh session over whatever build
// survived.
//
// So Forge keeps it and this stays what it is: the workshop. Forge holds one state per project —
// the current prototype, not a history — and hands it back when a bench is activated.
//
// EVERYTHING HERE FAILS SOFT. If Forge is unreachable, misconfigured, or slow, the Laboratory must
// keep working exactly as before. Losing the backup is bad; refusing to generate because the
// backup failed would be worse.

import fs from "node:fs/promises";
import path from "node:path";

const FORGE = () => String(process.env.FORGE_URL || "").replace(/\/$/, "");
const SECRET = () => process.env.LAB_SHARED_SECRET || "";

/** Configured only when both halves are there: a URL without the key just yields 401s. */
export function persistenceConfigured() {
  return Boolean(FORGE() && SECRET());
}

// What travels. Same list Forge filters on — kept in both places on purpose, so neither side
// depends on the other being right about it.
//
// Not included: `exports/` (1.6 MB each and rebuilt by a button), `sessions/qa` (one run's
// screenshots), the benchmark and the chosen provider (service preferences, not project data).
const FOLDERS = ["public/gameplay", "docs/tdds"];
const KEEP = /\.(js|mjs|json|ya?ml|md|txt)$/i;

/** Every persistable file under ROOT, with its path RELATIVE to ROOT — the same one used to restore. */
async function collectFiles(root) {
  const out = [];
  for (const folder of FOLDERS) {
    const base = path.join(root, ...folder.split("/"));
    async function walk(dir, prefix) {
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
        if (ent.isDirectory()) {
          await walk(abs, rel);
          continue;
        }
        if (!ent.isFile() || !KEEP.test(ent.name)) continue;
        try {
          out.push({ ruta: rel, texto: await fs.readFile(abs, "utf8") });
        } catch {
          /* unreadable file: skipped, never guessed */
        }
      }
    }
    await walk(base, folder);
  }
  return out;
}

/**
 * Hand the current bench to Forge. Called AFTER anything that changes it — generate, chat, sync —
 * because those are the three moments the disk stops matching what is saved.
 *
 * `chat` is the conversation plus its checkpoint, straight out of the session.
 */
export async function saveToForge({ root, slug, chat = null, origin = null } = {}) {
  if (!persistenceConfigured() || !slug) return { saved: false, reason: "not configured" };
  try {
    const archivos = await collectFiles(root);
    const res = await fetch(`${FORGE()}/api/lab/estado`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-lab-secret": SECRET() },
      body: JSON.stringify({ slug, archivos, chat, origen: origin }),
      // Generous but finite: Forge sleeps on the free tier and its cold start is ~7 s. Without a
      // limit a hung request would keep a generation's `finally` block open.
      signal: AbortSignal.timeout(60_000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn(`[forge-state] save refused (${res.status}): ${body.error || ""}`);
      return { saved: false, reason: body.error || `HTTP ${res.status}` };
    }
    console.log(`[forge-state] saved "${slug}" · ${body.archivos} file(s) · chat ${body.chat_mensajes} message(s)`);
    return { saved: true, ...body };
  } catch (err) {
    // Deliberately a warning: the Laboratory keeps working without its backup.
    console.warn(`[forge-state] could not save "${slug}": ${err.message}`);
    return { saved: false, reason: err.message };
  }
}

/** What Forge has for a bench. `withFiles: false` answers "is there anything?" without the bytes. */
export async function loadFromForge({ slug, withFiles = true } = {}) {
  if (!persistenceConfigured() || !slug) return { hay: false, reason: "not configured" };
  try {
    const url = `${FORGE()}/api/lab/estado/${encodeURIComponent(slug)}${withFiles ? "" : "?archivos=0"}`;
    const res = await fetch(url, {
      headers: { "x-lab-secret": SECRET() },
      signal: AbortSignal.timeout(60_000),
    });
    if (res.status === 404) return { hay: false, reason: "no project for that slug" };
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn(`[forge-state] load refused (${res.status}): ${body.error || ""}`);
      return { hay: false, reason: body.error || `HTTP ${res.status}` };
    }
    return body;
  } catch (err) {
    console.warn(`[forge-state] could not load "${slug}": ${err.message}`);
    return { hay: false, reason: err.message };
  }
}

/**
 * Write a saved bench back onto the disk.
 *
 * Paths are checked against ROOT before writing. They arrive over the network, and a `..` in one of
 * them would be a write anywhere on the box — the one thing this function must not allow.
 */
export async function restoreFiles({ root, archivos = [] } = {}) {
  let written = 0;
  const rejected = [];
  for (const a of archivos) {
    const rel = String(a?.ruta || "");
    const abs = path.resolve(root, rel);
    const inside = abs === root || abs.startsWith(root + path.sep);
    const allowed = FOLDERS.some((f) => rel.startsWith(`${f}/`));
    if (!inside || !allowed) {
      rejected.push(rel);
      continue;
    }
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, String(a.texto ?? ""), "utf8");
    written++;
  }
  if (rejected.length) console.warn(`[forge-state] ${rejected.length} path(s) refused: ${rejected.slice(0, 3).join(", ")}`);
  return { written, rejected: rejected.length };
}

/**
 * Bring a bench back if this disk has nothing for it. Called when a workspace is activated.
 *
 * It only restores onto an EMPTY bench. Overwriting a bench that already has files would throw away
 * work this instance did since its last save, which is the opposite of the point.
 */
export async function restoreBench({ root, slug } = {}) {
  if (!persistenceConfigured() || !slug) return { restored: false, reason: "not configured" };
  const gameplay = path.join(root, "public", "gameplay");
  let current = [];
  try {
    current = (await fs.readdir(gameplay)).filter((n) => !n.startsWith("."));
  } catch {
    /* no folder yet: counts as empty */
  }
  if (current.length) return { restored: false, reason: "bench is not empty" };

  const saved = await loadFromForge({ slug });
  if (!saved.hay) return { restored: false, reason: saved.reason || "nothing saved" };

  const { written, rejected } = await restoreFiles({ root, archivos: saved.archivos || [] });
  console.log(`[forge-state] restored "${slug}" · ${written} file(s)` + (rejected ? ` · ${rejected} refused` : ""));
  return { restored: written > 0, written, chat: saved.chat || null, savedAt: saved.guardado_en || null };
}
