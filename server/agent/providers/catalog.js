/**
 * Discover agent providers from env. At least one API key is required — no local fallback.
 * Cursor uses @cursor/sdk; other slots are OpenAI-compatible chat/completions.
 */

import fs from "node:fs/promises";
import path from "node:path";

const STATE_FILE = ".lab-agent-provider";

export const KNOWN_PROVIDERS = [
  {
    id: "cursor",
    kind: "cursor",
    label: "Cursor",
    keyVars: ["CURSOR_API_KEY"],
    modelVar: "CURSOR_MODEL",
    defaultModel: "auto",
    suggestedModels: ["auto", "composer-2.5", "composer-2", "gpt-5.2", "claude-4.6-sonnet"],
  },
  {
    id: "minimax",
    kind: "llm",
    label: "MiniMax",
    keyVars: ["MINIMAX_API_KEY"],
    urlVar: "MINIMAX_BASE_URL",
    defaultUrl: "https://api.minimax.io/v1",
    modelVar: "MINIMAX_MODEL",
    defaultModel: "MiniMax-M3",
    suggestedModels: ["MiniMax-M3", "MiniMax-M2.5", "MiniMax-Text-01"],
  },
  {
    id: "openai",
    kind: "llm",
    label: "OpenAI",
    keyVars: ["OPENAI_API_KEY"],
    urlVar: "OPENAI_BASE_URL",
    defaultUrl: "https://api.openai.com/v1",
    modelVar: "OPENAI_MODEL",
    defaultModel: "gpt-4.1",
    suggestedModels: ["gpt-4.1", "gpt-4o", "gpt-4o-mini"],
  },
  {
    id: "anthropic",
    kind: "llm",
    label: "Anthropic",
    keyVars: ["ANTHROPIC_API_KEY"],
    urlVar: "ANTHROPIC_BASE_URL",
    defaultUrl: "https://api.anthropic.com/v1",
    modelVar: "ANTHROPIC_MODEL",
    defaultModel: "claude-sonnet-4-6",
    suggestedModels: [
      "claude-sonnet-4-6",
      "claude-opus-4-6",
      "claude-opus-4-7",
      "claude-opus-4-8",
      "claude-sonnet-5",
      "claude-opus-5",
      "claude-fable-5",
    ],
  },
  {
    id: "kimi",
    kind: "llm",
    label: "Kimi",
    keyVars: ["KIMI_API_KEY", "MOONSHOT_API_KEY"],
    urlVar: "KIMI_BASE_URL",
    defaultUrl: "https://api.moonshot.ai/v1",
    modelVar: "KIMI_MODEL",
    defaultModel: "kimi-k2-0905-preview",
    suggestedModels: ["kimi-k2-0905-preview", "moonshot-v1-128k"],
  },
  {
    id: "glm",
    kind: "llm",
    label: "GLM",
    keyVars: ["GLM_API_KEY", "ZHIPU_API_KEY"],
    urlVar: "GLM_BASE_URL",
    defaultUrl: "https://open.bigmodel.cn/api/paas/v4",
    modelVar: "GLM_MODEL",
    defaultModel: "glm-4.5",
    suggestedModels: ["glm-4.5", "glm-4"],
  },
  {
    id: "openrouter",
    kind: "llm",
    label: "OpenRouter",
    keyVars: ["OPENROUTER_API_KEY"],
    urlVar: "OPENROUTER_BASE_URL",
    defaultUrl: "https://openrouter.ai/api/v1",
    modelVar: "OPENROUTER_MODEL",
    defaultModel: "openai/gpt-4.1",
    suggestedModels: ["openai/gpt-4.1", "anthropic/claude-sonnet-4"],
  },
];

const HOST_TO_ID = {
  "api.minimax.io": "minimax",
  "minimax.io": "minimax",
  "api.openai.com": "openai",
  "api.anthropic.com": "anthropic",
  "api.moonshot.ai": "kimi",
  "api.moonshot.cn": "kimi",
  "open.bigmodel.cn": "glm",
  "openrouter.ai": "openrouter",
};

/** @type {{ id: string, model?: string } | null} */
let override = null;
/** @type {string | null} */
let stateRoot = null;

function envSet(env, name) {
  const v = env[name];
  if (v == null) return "";
  const s = String(v).trim();
  if (!s || s.includes("...")) return "";
  return s;
}

function firstSet(env, names) {
  for (const n of names || []) {
    const v = envSet(env, n);
    if (v) return { name: n, value: v };
  }
  return null;
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function inferIdFromUrl(url) {
  const host = hostOf(url);
  if (!host) return null;
  if (HOST_TO_ID[host]) return HOST_TO_ID[host];
  for (const [suffix, id] of Object.entries(HOST_TO_ID)) {
    if (host === suffix || host.endsWith(`.${suffix}`)) return id;
  }
  return null;
}

function knownById(id) {
  return KNOWN_PROVIDERS.find((p) => p.id === id) || null;
}

/**
 * Only providers with a real API key.
 */
export function discoverProviders(env = process.env) {
  /** @type {Map<string, object>} */
  const found = new Map();

  for (const spec of KNOWN_PROVIDERS) {
    const key = firstSet(env, spec.keyVars);
    if (!key) continue;
    found.set(spec.id, {
      id: spec.id,
      kind: spec.kind,
      label: spec.label,
      model: envSet(env, spec.modelVar) || spec.defaultModel || "",
      apiKey: key.value,
      baseUrl: spec.kind === "llm" ? envSet(env, spec.urlVar) || spec.defaultUrl || "" : null,
      keyVar: key.name,
      suggestedModels: [...(spec.suggestedModels || [])],
    });
  }

  // Generic LLM_* slot (as used by tdd-prototype-lab .env)
  const llmKey = envSet(env, "LLM_API_KEY");
  if (llmKey) {
    const url = envSet(env, "LLM_BASE_URL") || "https://api.openai.com/v1";
    const model = envSet(env, "LLM_MODEL") || "gpt-4.1";
    const inferred = inferIdFromUrl(url);
    if (inferred && found.has(inferred)) {
      /* already covered */
    } else if (inferred && knownById(inferred) && !found.has(inferred)) {
      const spec = knownById(inferred);
      found.set(inferred, {
        id: inferred,
        kind: "llm",
        label: spec.label,
        model: envSet(env, spec.modelVar) || model || spec.defaultModel,
        apiKey: llmKey,
        baseUrl: url,
        keyVar: "LLM_API_KEY",
        suggestedModels: [...(spec.suggestedModels || [])],
      });
    } else if (!found.has("llm")) {
      const host = hostOf(url);
      const label = host ? host.replace(/^api\./, "").split(".")[0] : "LLM";
      found.set("llm", {
        id: "llm",
        kind: "llm",
        label: label.charAt(0).toUpperCase() + label.slice(1),
        model,
        apiKey: llmKey,
        baseUrl: url,
        keyVar: "LLM_API_KEY",
        suggestedModels: [model].filter(Boolean),
      });
    }
  }

  return [...found.values()];
}

export function resolveActiveProvider(env = process.env, preferredId = override?.id) {
  const list = discoverProviders(env);
  if (!list.length) return null;
  const wanted = String(preferredId || env.AGENT_PROVIDER || "")
    .toLowerCase()
    .trim();
  if (wanted === "local") {
    // Explicitly rejected — never use a local/deterministic provider.
  } else if (wanted === "llm") {
    const fromLlm = list.find((p) => p.keyVar === "LLM_API_KEY") || list.find((p) => p.kind === "llm");
    if (fromLlm) return withModelOverride(fromLlm);
  } else if (wanted) {
    const match = list.find((p) => p.id === wanted);
    if (match) return withModelOverride(match);
  }
  // Prefer Cursor when present (matches typical lab setup)
  const cursor = list.find((p) => p.id === "cursor");
  return withModelOverride(cursor || list[0]);
}

function withModelOverride(slot) {
  if (!slot) return null;
  const model = (override?.model && String(override.model).trim()) || slot.model;
  return { ...slot, model };
}

export async function initProviderCatalog(root) {
  stateRoot = root;
  try {
    const raw = await fs.readFile(path.join(root, STATE_FILE), "utf8");
    const trimmed = raw.trim();
    if (trimmed.startsWith("{")) {
      const parsed = JSON.parse(trimmed);
      override = {
        id: parsed?.id ? String(parsed.id) : null,
        model: parsed?.model ? String(parsed.model) : undefined,
      };
    } else if (trimmed) {
      override = { id: trimmed };
    }
  } catch {
    override = null;
  }
}

export async function persistProviderState() {
  if (!stateRoot || !override?.id) return;
  await fs.writeFile(
    path.join(stateRoot, STATE_FILE),
    JSON.stringify({ id: override.id, model: override.model || null }, null, 2),
    "utf8",
  );
}

export async function setActiveProvider(id, model, env = process.env) {
  const list = discoverProviders(env);
  if (!list.length) {
    throw new Error(
      "No agent API key configured. Add CURSOR_API_KEY and/or LLM_API_KEY (or named *_API_KEY) to .env.",
    );
  }
  const match = list.find((p) => p.id === String(id || "").toLowerCase());
  if (!match) throw new Error(`Unknown or unconfigured provider: ${id}`);
  const nextModel = model != null && String(model).trim() ? String(model).trim() : match.model;
  override = { id: match.id, model: nextModel };
  await persistProviderState();
  return withModelOverride(match);
}

export function getActiveProvider(env = process.env) {
  return resolveActiveProvider(env, override?.id);
}

export function requireActiveProvider(env = process.env) {
  const slot = getActiveProvider(env);
  if (!slot) {
    throw new Error(
      "No agent API key configured. Add CURSOR_API_KEY and/or LLM_API_KEY (or named *_API_KEY) to .env and restart.",
    );
  }
  return slot;
}

export function providerStatus(env = process.env) {
  const active = getActiveProvider(env);
  const list = discoverProviders(env);
  return {
    requireKey: true,
    configured: list.length > 0,
    active: active?.id || null,
    model: active?.model || null,
    providers: list.map((p) => ({
      id: p.id,
      kind: p.kind,
      label: p.label,
      ready: true,
      model: p.id === active?.id ? active.model : p.model,
      suggestedModels: mergeModelSuggestions(p, active),
    })),
    missingHint:
      list.length === 0
        ? "Add CURSOR_API_KEY and/or LLM_API_KEY to .env (copied from tdd-prototype-lab), then restart."
        : null,
  };
}

function mergeModelSuggestions(p, active) {
  const set = new Set([...(p.suggestedModels || [])]);
  if (p.model) set.add(p.model);
  if (active?.id === p.id && active.model) set.add(active.model);
  // Keep auto first for Cursor
  const arr = [...set];
  if (p.id === "cursor") {
    arr.sort((a, b) => (a === "auto" ? -1 : b === "auto" ? 1 : a.localeCompare(b)));
  }
  return arr;
}

/** @deprecated use setActiveProvider */
export async function writeActiveProvider(root, id) {
  stateRoot = root;
  return setActiveProvider(id);
}

/** @deprecated use getActiveProvider */
export async function readActiveProvider(root, env = process.env) {
  await initProviderCatalog(root);
  return getActiveProvider(env)?.id || null;
}
