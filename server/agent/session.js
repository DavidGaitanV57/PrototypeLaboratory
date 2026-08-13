import {
  getActiveProvider,
  initProviderCatalog,
  requireActiveProvider,
} from "./providers/catalog.js";
import { createCursorProvider } from "./providers/cursor.js";
import { createLlmProvider } from "./providers/llm.js";
import {
  buildChatPrompt,
  buildGenerateFinalPrompt,
  buildSyncPrompt,
  loadPromptPack,
} from "./prompts/index.js";
import { readTdd } from "../tdd/parser.js";
import { finalizeTddSync } from "../tdd/sync.js";
import { listGameplayFiles, mergeChatDigest } from "./gameplayEvidence.js";
import {
  advisePlayability,
  formatAdviceForChat,
} from "./playabilityAdvisor.js";
import { recordBenchmark } from "./benchmarkStore.js";
import fs from "node:fs/promises";
import path from "node:path";

export async function pickProvider(root, { writeMode = "generate", slug } = {}) {
  await initProviderCatalog(root);
  const slot = requireActiveProvider();
  if (slot.kind === "cursor") {
    return {
      id: slot.id,
      kind: "cursor",
      model: slot.model,
      label: slot.label,
      provider: createCursorProvider({
        root,
        apiKey: slot.apiKey,
        model: slot.model,
        writeMode,
      }),
    };
  }
  return {
    id: slot.id,
    kind: "llm",
    model: slot.model,
    label: slot.label,
    provider: createLlmProvider({
      root,
      apiKey: slot.apiKey,
      baseUrl: slot.baseUrl,
      model: slot.model,
      writeMode,
      slug,
    }),
  };
}

function wrapEvents({ root, op, slug, picked, onEvent }) {
  return async (ev) => {
    if (ev?.type === "benchmark") {
      const enriched = await recordBenchmark(root, {
        ...ev,
        op,
        slug,
        providerId: picked.id,
        providerLabel: picked.label || picked.id,
        model: ev.model || picked.model,
      });
      onEvent?.(enriched);
      return;
    }
    onEvent?.(ev);
  };
}

/**
 * Soft advisor after LLM writes — never throws into the happy path.
 */
async function emitSoftAdvice({ root, tddsRoot, slug, onEvent }) {
  try {
    const tdd = await readTdd(tddsRoot, slug);
    const report = await advisePlayability({ root, tddText: tdd.text });
    const digest = formatAdviceForChat(report.advice);
    onEvent?.({
      type: "advice",
      genres: report.genres,
      advice: report.advice,
      digest,
    });
    const warns = report.advice.filter((a) => a.severity === "warn");
    if (warns.length) {
      onEvent?.({
        type: "status",
        message: `Soft check: ${warns.length} hint(s) — playable still opens; fix via chat if needed`,
      });
    } else {
      onEvent?.({ type: "status", message: "Soft check: no blocking issues (play-test the loop)" });
    }
    return report;
  } catch (err) {
    onEvent?.({
      type: "status",
      message: `Soft check skipped: ${err.message || err}`,
    });
    return null;
  }
}

export async function createSession({ root, tddsRoot, slug }) {
  await initProviderCatalog(root);
  const agentsMd = await fs.readFile(path.join(root, "AGENTS.md"), "utf8");
  const pack = await loadPromptPack();
  let busy = false;
  let controller = null;
  let activeProvider = null;
  /** @type {{ role: string, message: string, at: number }[]} */
  let chatHistory = [];
  /** @type {string} */
  let lastAdviceDigest = "";

  return {
    slug,
    get busy() {
      return busy;
    },
    get providerInfo() {
      const s = getActiveProvider();
      return s ? { id: s.id, model: s.model, label: s.label } : null;
    },
    get lastAdviceDigest() {
      return lastAdviceDigest;
    },
    async generateFinal(handlers = {}) {
      if (busy) throw new Error("Session busy");
      busy = true;
      controller = new AbortController();
      try {
        const tdd = await readTdd(tddsRoot, slug);
        const picked = await pickProvider(root, { writeMode: "generate", slug });
        activeProvider = picked.provider;
        handlers.onEvent?.({
          type: "status",
          message: `Provider ${picked.id} · model ${picked.model}`,
        });
        const prompt = buildGenerateFinalPrompt({
          slug,
          tddText: tdd.text,
          agentsMd,
          pack,
        });
        const onEvent = wrapEvents({
          root,
          op: "generate",
          slug,
          picked,
          onEvent: handlers.onEvent,
        });
        const result = await picked.provider.run(prompt, {
          onEvent,
          signal: controller.signal,
        });
        // Soft advice AFTER write — never blocks ready
        const report = await emitSoftAdvice({
          root,
          tddsRoot,
          slug,
          onEvent: handlers.onEvent,
        });
        lastAdviceDigest = formatAdviceForChat(report?.advice || []);
        return result;
      } finally {
        busy = false;
        controller = null;
        activeProvider = null;
      }
    },
    async chat(message, handlers = {}) {
      if (busy) throw new Error("Session busy");
      busy = true;
      controller = new AbortController();
      const trimmed = String(message || "").trim();
      const mode = handlers.mode === "ask" ? "ask" : "agent";
      if (trimmed) {
        chatHistory.push({
          role: "user",
          message: trimmed,
          mode,
          at: Date.now(),
        });
      }
      try {
        let tddText = "";
        try {
          tddText = (await readTdd(tddsRoot, slug)).text;
        } catch {
          /* optional */
        }
        const writeMode = mode === "ask" ? "ask" : "chat";
        const picked = await pickProvider(root, { writeMode, slug });
        activeProvider = picked.provider;
        handlers.onEvent?.({
          type: "status",
          message: `${picked.label || picked.id} · ${picked.model} · ${mode === "ask" ? "Ask" : "Agent"}`,
        });
        const prompt = buildChatPrompt({
          slug,
          message: trimmed,
          agentsMd,
          pack,
          tddText,
          adviceDigest: lastAdviceDigest,
          mode,
        });
        const onEvent = wrapEvents({
          root,
          op: mode === "ask" ? "ask" : "chat",
          slug,
          picked,
          onEvent: handlers.onEvent,
        });
        const result = await picked.provider.run(prompt, {
          onEvent,
          signal: controller.signal,
        });
        if (mode !== "ask") {
          const report = await emitSoftAdvice({
            root,
            tddsRoot,
            slug,
            onEvent: handlers.onEvent,
          });
          lastAdviceDigest = formatAdviceForChat(report?.advice || []);
        }
        return { result, mode };
      } finally {
        busy = false;
        controller = null;
        activeProvider = null;
      }
    },
    async syncTdd({ summary = "", chatDigest = "" } = {}, handlers = {}) {
      if (busy) throw new Error("Session busy");
      busy = true;
      controller = new AbortController();
      try {
        const tdd = await readTdd(tddsRoot, slug);
        const gameplayFiles = await listGameplayFiles(root);
        const digest = mergeChatDigest(chatHistory, chatDigest);
        const picked = await pickProvider(root, { writeMode: "sync", slug });
        activeProvider = picked.provider;
        const prompt = buildSyncPrompt({
          slug,
          tddText: tdd.text,
          summary:
            summary ||
            (digest
              ? "Sync validated chat iterations and prototype behavior into the TDD"
              : "Promote validated prototype behavior into the TDD product spec"),
          chatDigest: digest,
          gameplayFiles,
          root,
          agentsMd,
          pack,
        });
        await picked.provider.run(prompt, {
          onEvent: wrapEvents({
            root,
            op: "sync",
            slug,
            picked,
            onEvent: handlers.onEvent,
          }),
          signal: controller.signal,
        });
        return await finalizeTddSync(tddsRoot, slug);
      } finally {
        busy = false;
        controller = null;
        activeProvider = null;
      }
    },
    cancel() {
      controller?.abort?.();
      activeProvider?.cancel?.();
    },
  };
}
