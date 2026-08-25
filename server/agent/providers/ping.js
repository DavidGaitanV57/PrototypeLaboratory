/**
 * Cheap reachability check for agent providers/models.
 * LLM slots: one tiny chat completion. Cursor: Agent.create only (no send).
 */

import { Agent } from "@cursor/sdk";
import { discoverProviders, getActiveProvider } from "./catalog.js";

const PING_TIMEOUT_MS = 25_000;

function truncateErr(err, max = 240) {
  const msg = String(err?.message || err || "unknown error")
    .replace(/\s+/g, " ")
    .trim();
  return msg.length > max ? `${msg.slice(0, max - 1)}…` : msg;
}

function isAnthropicUrl(url) {
  try {
    return /anthropic\.com$/i.test(new URL(url).hostname.replace(/^www\./, ""));
  } catch {
    return /anthropic\.com/i.test(String(url || ""));
  }
}

/**
 * @param {{ apiKey: string, baseUrl: string, model: string }} opts
 */
async function pingLlmSlot({ apiKey, baseUrl, model }) {
  const root = String(baseUrl || "").replace(/\/$/, "");
  if (!root) throw new Error("Missing base URL");
  if (!apiKey) throw new Error("Missing API key");
  if (!model) throw new Error("Missing model id");

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), PING_TIMEOUT_MS);
  const started = Date.now();

  try {
    if (isAnthropicUrl(root)) {
      const endpoint = `${root}/messages`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 8,
          messages: [{ role: "user", content: "Reply with exactly: pong" }],
        }),
        signal: ac.signal,
      });
      const text = await res.text();
      const ms = Date.now() - started;
      if (!res.ok) {
        let detail = text.slice(0, 200);
        try {
          const j = JSON.parse(text);
          detail = j?.error?.message || j?.message || detail;
        } catch {
          /* keep text */
        }
        return { ok: false, ms, status: res.status, error: truncateErr(detail) };
      }
      return { ok: true, ms, status: res.status };
    }

    const endpoint = `${root}/chat/completions`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        // Omit temperature — Kimi Code models (e.g. kimi-for-coding) only allow 1.
        max_tokens: 8,
        messages: [{ role: "user", content: "Reply with exactly: pong" }],
      }),
      signal: ac.signal,
    });
    const text = await res.text();
    const ms = Date.now() - started;
    if (!res.ok) {
      let detail = text.slice(0, 200);
      try {
        const j = JSON.parse(text);
        detail = j?.error?.message || j?.message || detail;
      } catch {
        /* keep text */
      }
      return { ok: false, ms, status: res.status, error: truncateErr(detail) };
    }
    return { ok: true, ms, status: res.status };
  } catch (err) {
    const ms = Date.now() - started;
    if (err?.name === "AbortError") {
      return { ok: false, ms, error: `Timed out after ${PING_TIMEOUT_MS}ms` };
    }
    return { ok: false, ms, error: truncateErr(err) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {{ apiKey: string, model: string, root: string }} opts
 */
async function pingCursorSlot({ apiKey, model, root }) {
  const started = Date.now();
  try {
    if (!apiKey) throw new Error("Missing CURSOR_API_KEY");
    const agent = await Agent.create({
      apiKey,
      model: { id: model || "auto" },
      local: { cwd: root },
    });
    try {
      await agent?.[Symbol.asyncDispose]?.();
    } catch {
      /* optional cleanup */
    }
    return { ok: true, ms: Date.now() - started, note: "SDK agent created" };
  } catch (err) {
    return { ok: false, ms: Date.now() - started, error: truncateErr(err) };
  }
}

function resolveSlot(id, env) {
  const list = discoverProviders(env);
  const wanted = String(id || "").toLowerCase().trim();
  if (wanted) {
    const match = list.find((p) => p.id === wanted);
    if (!match) throw new Error(`Unknown or unconfigured provider: ${id}`);
    return match;
  }
  const active = getActiveProvider(env);
  if (!active) throw new Error("No provider configured");
  return active;
}

/**
 * @param {{ id?: string, model?: string, root: string }} opts
 * @param {NodeJS.ProcessEnv} [env]
 */
export async function pingProviderModel({ id, model, root }, env = process.env) {
  const slot = resolveSlot(id, env);
  const modelId = String(model || slot.model || "").trim();
  if (!modelId) throw new Error("model required");

  const base = {
    provider: slot.id,
    label: slot.label,
    kind: slot.kind,
    model: modelId,
  };

  if (slot.kind === "cursor") {
    const result = await pingCursorSlot({
      apiKey: slot.apiKey,
      model: modelId,
      root,
    });
    return { ...base, ...result };
  }

  const result = await pingLlmSlot({
    apiKey: slot.apiKey,
    baseUrl: slot.baseUrl,
    model: modelId,
  });
  return { ...base, ...result };
}

/**
 * Ping the provider default + suggested models (deduped).
 * @param {{ id?: string, root: string, models?: string[] }} opts
 */
export async function pingProviderModels({ id, root, models }, env = process.env) {
  const slot = resolveSlot(id, env);
  const set = new Set();
  const list = [];
  const push = (m) => {
    const idm = String(m || "").trim();
    if (!idm || set.has(idm)) return;
    set.add(idm);
    list.push(idm);
  };
  if (Array.isArray(models) && models.length) {
    for (const m of models) push(m);
  } else {
    push(slot.model);
    for (const m of slot.suggestedModels || []) push(m);
  }
  const results = [];
  for (const modelId of list.slice(0, 12)) {
    results.push(await pingProviderModel({ id: slot.id, model: modelId, root }, env));
  }
  return {
    provider: slot.id,
    label: slot.label,
    results,
    okCount: results.filter((r) => r.ok).length,
    failCount: results.filter((r) => !r.ok).length,
  };
}
