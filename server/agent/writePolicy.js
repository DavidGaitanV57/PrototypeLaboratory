const KERNEL_PREFIXES = [
  "public/runtime/",
  "public/index.html",
  "public/app.js",
  "public/styles.css",
  "server/",
  "AGENTS.md",
  "PRODUCT.md",
  "DESIGN.md",
  "package.json",
];

export function normalizeRel(p) {
  return String(p || "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "");
}

export function isKernelPath(rel) {
  const r = normalizeRel(rel);
  return KERNEL_PREFIXES.some((p) => r === p || r.startsWith(p));
}

/**
 * @param {string} rel
 * @param {"generate"|"chat"|"sync"} mode
 * @param {{ slug?: string }} [opts]
 */
export function assertAgentWriteAllowed(rel, mode = "generate", opts = {}) {
  const r = normalizeRel(rel);
  if (mode === "sync") {
    const ok = new RegExp(`^docs/tdds/${opts.slug || "[^/]+"}/TDD\\.md$`).test(r);
    if (!ok) throw new Error(`Sync may only write docs/tdds/<slug>/TDD.md (got ${r})`);
    return;
  }
  if (isKernelPath(r)) throw new Error(`Write not allowed (runtime/lab): ${r}`);
  if (!r.startsWith("public/gameplay/")) {
    throw new Error(`Write not allowed in ${mode} mode: ${r}`);
  }
}
