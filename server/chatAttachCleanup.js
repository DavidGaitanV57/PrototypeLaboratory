import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_TTL_MS = 48 * 60 * 60 * 1000;
const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;
const DEFAULT_MAX_PER_SESSION = 6;

function ttlMsFromEnv(env = process.env) {
  const hours = Number(env.CHAT_ATTACH_TTL_HOURS);
  if (Number.isFinite(hours) && hours > 0) return hours * 60 * 60 * 1000;
  return DEFAULT_TTL_MS;
}

function maxBytesFromEnv(env = process.env) {
  const mb = Number(env.CHAT_ATTACH_MAX_MB);
  if (Number.isFinite(mb) && mb > 0) return Math.floor(mb * 1024 * 1024);
  return DEFAULT_MAX_BYTES;
}

function maxPerSessionFromEnv(env = process.env) {
  const n = Number(env.CHAT_ATTACH_MAX_PER_SESSION);
  if (Number.isFinite(n) && n >= 1) return Math.floor(n);
  return DEFAULT_MAX_PER_SESSION;
}

/**
 * Collect every file under sessions/chat-attach (one level of session folders).
 * @param {string} attachRoot
 */
async function listAttachFiles(attachRoot) {
  /** @type {{ abs: string, dir: string, mtimeMs: number, size: number }[]} */
  const files = [];
  let dirs;
  try {
    dirs = await fs.readdir(attachRoot, { withFileTypes: true });
  } catch (err) {
    if (err && err.code === "ENOENT") return { files, emptyDirs: [] };
    throw err;
  }

  /** @type {string[]} */
  const emptyDirs = [];

  for (const ent of dirs) {
    if (!ent.isDirectory()) continue;
    const dir = path.join(attachRoot, ent.name);
    let children;
    try {
      children = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    let fileCount = 0;
    for (const child of children) {
      if (!child.isFile()) continue;
      const abs = path.join(dir, child.name);
      try {
        const st = await fs.stat(abs);
        files.push({ abs, dir, mtimeMs: st.mtimeMs, size: st.size });
        fileCount += 1;
      } catch {
        /* skip */
      }
    }
    if (fileCount === 0) emptyDirs.push(dir);
  }

  return { files, emptyDirs };
}

async function rmQuiet(abs) {
  try {
    await fs.rm(abs, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

/**
 * Soft purge for chat screenshots: TTL + total size cap. Does not touch other session data.
 * @param {string} sessionsRoot absolute path to sessions/
 * @param {{ ttlMs?: number, maxBytes?: number, env?: NodeJS.ProcessEnv }} [opts]
 */
export async function purgeChatAttachments(sessionsRoot, opts = {}) {
  const env = opts.env || process.env;
  const ttlMs = opts.ttlMs ?? ttlMsFromEnv(env);
  const maxBytes = opts.maxBytes ?? maxBytesFromEnv(env);
  const attachRoot = path.join(sessionsRoot, "chat-attach");
  const now = Date.now();
  const cutoff = now - ttlMs;

  await fs.mkdir(attachRoot, { recursive: true });
  const { files, emptyDirs } = await listAttachFiles(attachRoot);

  let removedFiles = 0;
  let removedBytes = 0;
  const kept = [];

  for (const f of files) {
    if (f.mtimeMs < cutoff) {
      await rmQuiet(f.abs);
      removedFiles += 1;
      removedBytes += f.size;
    } else {
      kept.push(f);
    }
  }

  for (const dir of emptyDirs) await rmQuiet(dir);

  // Drop empty dirs left after TTL deletes.
  const dirsLeft = new Set(kept.map((f) => f.dir));
  for (const dir of dirsLeft) {
    try {
      const left = await fs.readdir(dir);
      if (!left.length) await rmQuiet(dir);
    } catch {
      /* */
    }
  }

  kept.sort((a, b) => a.mtimeMs - b.mtimeMs);
  let total = kept.reduce((sum, f) => sum + f.size, 0);
  while (total > maxBytes && kept.length) {
    const oldest = kept.shift();
    if (!oldest) break;
    await rmQuiet(oldest.abs);
    removedFiles += 1;
    removedBytes += oldest.size;
    total -= oldest.size;
    try {
      const left = await fs.readdir(oldest.dir);
      if (!left.length) await rmQuiet(oldest.dir);
    } catch {
      /* */
    }
  }

  return {
    removedFiles,
    removedBytes,
    keptFiles: kept.length,
    keptBytes: total,
    ttlMs,
    maxBytes,
  };
}

/**
 * Keep only the newest N images in one session attach folder (after a new upload).
 * @param {string} sessionAttachDir
 * @param {{ maxFiles?: number, env?: NodeJS.ProcessEnv }} [opts]
 */
export async function pruneSessionAttachDir(sessionAttachDir, opts = {}) {
  const maxFiles = opts.maxFiles ?? maxPerSessionFromEnv(opts.env || process.env);
  let ents;
  try {
    ents = await fs.readdir(sessionAttachDir, { withFileTypes: true });
  } catch {
    return { removed: 0 };
  }

  /** @type {{ abs: string, mtimeMs: number }[]} */
  const files = [];
  for (const ent of ents) {
    if (!ent.isFile()) continue;
    const abs = path.join(sessionAttachDir, ent.name);
    try {
      const st = await fs.stat(abs);
      files.push({ abs, mtimeMs: st.mtimeMs });
    } catch {
      /* */
    }
  }
  if (files.length <= maxFiles) return { removed: 0 };

  files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const drop = files.slice(maxFiles);
  for (const f of drop) await rmQuiet(f.abs);
  return { removed: drop.length };
}
