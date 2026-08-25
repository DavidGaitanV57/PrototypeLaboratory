import { canonicalizeRel } from "../security/paths.js";

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
 * @param {"generate"|"chat"|"ask"|"plan"|"sync"} mode
 * @param {{ slug?: string }} [opts]
 */
export function assertAgentWriteAllowed(rel, mode = "generate", opts = {}) {
  // Collapse .. segments so public/gameplay/../../server/x cannot bypass checks
  const r = canonicalizeRel(rel);
  if (mode === "ask" || mode === "plan") {
    throw new Error(
      mode === "plan"
        ? "Plan mode is read-only — switch to Agent mode to apply the plan"
        : "Ask mode is read-only — switch to Agent mode to edit gameplay files",
    );
  }
  if (mode === "sync") {
    const slug = opts.slug || "";
    if (!slug || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(slug)) {
      throw new Error("Sync requires a valid slug");
    }
    const ok = r === `docs/tdds/${slug}/TDD.md`;
    if (!ok) throw new Error(`Sync may only write docs/tdds/<slug>/TDD.md (got ${r})`);
    return;
  }
  if (isKernelPath(r)) throw new Error(`Write not allowed (runtime/lab): ${r}`);
  if (!r.startsWith("public/gameplay/")) {
    throw new Error(`Write not allowed in ${mode} mode: ${r}`);
  }
}
