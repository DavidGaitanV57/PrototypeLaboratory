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
      provider: createCursorProvider({
        root,
        apiKey: slot.apiKey,
        model: slot.model,
      }),
    };
  }
  return {
    id: slot.id,
    kind: "llm",
    model: slot.model,
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

export async function createSession({ root, tddsRoot, slug }) {
  await initProviderCatalog(root);
  const agentsMd = await fs.readFile(path.join(root, "AGENTS.md"), "utf8");
  const pack = await loadPromptPack();
  let busy = false;
  let controller = null;
  let activeProvider = null;
  /** @type {{ role: string, message: string, at: number }[]} */
  let chatHistory = [];

  return {
    slug,
    get busy() {
      return busy;
    },
    get providerInfo() {
      const s = getActiveProvider();
      return s ? { id: s.id, model: s.model, label: s.label } : null;
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
        return await picked.provider.run(prompt, {
          onEvent: handlers.onEvent,
          signal: controller.signal,
        });
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
      if (trimmed) chatHistory.push({ role: "user", message: trimmed, at: Date.now() });
      try {
        const picked = await pickProvider(root, { writeMode: "chat", slug });
        activeProvider = picked.provider;
        const prompt = buildChatPrompt({ slug, message, agentsMd, pack });
        return await picked.provider.run(prompt, {
          onEvent: handlers.onEvent,
          signal: controller.signal,
        });
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
          onEvent: handlers.onEvent,
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
