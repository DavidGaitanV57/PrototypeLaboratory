import fs from "node:fs/promises";
import path from "node:path";

const FILE = ".lab-last-benchmark.json";
const MAX_HISTORY = 12;

/** @type {{ last: object | null, history: object[] }} */
let cache = { last: null, history: [] };

export async function initBenchmarkStore(root) {
  try {
    const raw = await fs.readFile(path.join(root, FILE), "utf8");
    const parsed = JSON.parse(raw);
    cache = {
      last: parsed.last || null,
      history: Array.isArray(parsed.history) ? parsed.history.slice(0, MAX_HISTORY) : [],
    };
  } catch {
    cache = { last: null, history: [] };
  }
  return cache;
}

export function getBenchmarkState() {
  return cache;
}

export async function recordBenchmark(root, entry) {
  if (!entry || entry.type !== "benchmark") return entry;
  const row = { ...entry };
  delete row.type;
  cache.last = row;
  cache.history = [row, ...cache.history.filter((h) => h.at !== row.at)].slice(0, MAX_HISTORY);
  try {
    await fs.writeFile(path.join(root, FILE), JSON.stringify(cache, null, 2), "utf8");
  } catch {
    /* non-fatal */
  }
  return { type: "benchmark", ...row };
}

export async function clearBenchmark(root) {
  cache = { last: null, history: [] };
  try {
    await fs.unlink(path.join(root, FILE));
  } catch {
    try {
      await fs.writeFile(path.join(root, FILE), JSON.stringify(cache, null, 2), "utf8");
    } catch {
      /* non-fatal */
    }
  }
  return cache;
}
