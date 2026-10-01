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
  buildSyncPreviewPrompt,
  buildSyncPrompt,
  loadPromptPack,
} from "./prompts/index.js";
import { readTdd } from "../tdd/parser.js";
import { finalizeTddSync } from "../tdd/sync.js";
import {
  formatSelectedSyncItems,
  buildGameplayChatContext,
  gameplayFingerprint,
  listGameplayFiles,
  mergeChatDigest,
  parseChatPlan,
  parseSyncProposal,
} from "./gameplayEvidence.js";
import {
  advisePlayability,
  formatAdviceForChat,
} from "./playabilityAdvisor.js";
import { buildRuntimeApiIndex } from "./runtimeIndex.js";
import { seedTemplateIfEmpty } from "./templates/index.js";
import { runVisualQa, buildQaFixMessage, qaImagesForChat } from "./visualQa.js";
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
async function emitSoftAdvice({ root, tddsRoot, slug, onEvent, previousDigest = "" }) {
  try {
    const tdd = await readTdd(tddsRoot, slug);
    const report = await advisePlayability({ root, tddText: tdd.text });
    const digest = formatAdviceForChat(report.advice);
    const changed = digest !== previousDigest;
    if (changed) {
      onEvent?.({
        type: "advice",
        genres: report.genres,
        advice: report.advice,
        digest,
        changed: true,
      });
    }
    const warns = report.advice.filter((a) => a.severity === "warn");
    if (warns.length) {
      onEvent?.({
        type: "status",
        message: changed
          ? `Soft check: ${warns.length} hint(s) — playable still opens; fix via chat if needed`
          : "Soft check: unchanged since last turn",
      });
    } else {
      onEvent?.({
        type: "status",
        message: changed
          ? "Soft check: no blocking issues (play-test the loop)"
          : "Soft check: unchanged since last turn",
      });
    }
    return { ...report, digest, changed };
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
  /** @type {{ messages: object[], turn: number, writeMode: string, model: string, mode: string, op: string, at: number } | null} */
  let checkpoint = null;
  /** @type {{ mode: string, op: string }} */
  let runMeta = { mode: "agent", op: "chat" };

  function captureCheckpoint(meta = runMeta) {
    const cp = activeProvider?.getCheckpoint?.();
    if (!cp?.messages?.length || !activeProvider?.supportsCheckpoint) return null;
    let writeMode = "chat";
    if (meta.op === "generate") writeMode = "generate";
    else if (meta.op === "sync") writeMode = "sync";
    else if (meta.mode === "ask" || meta.op === "ask") writeMode = "ask";
    else if (meta.mode === "plan" || meta.op === "plan") writeMode = "plan";
    else if (cp.writeMode) writeMode = cp.writeMode;
    checkpoint = {
      messages: cp.messages,
      turn: cp.turn || 1,
      writeMode,
      model: cp.model,
      mode: meta.mode || "agent",
      op: meta.op || "chat",
      at: cp.at || Date.now(),
    };
    return checkpoint;
  }

  function checkpointInfo() {
    if (!checkpoint?.messages?.length) return { resumable: false };
    return {
      resumable: true,
      turn: checkpoint.turn,
      mode: checkpoint.mode,
      op: checkpoint.op,
      model: checkpoint.model,
      at: checkpoint.at,
    };
  }

  async function runProvider(prompt, { writeMode, op, mode, onEvent, resume, images, picked: prePicked } = {}) {
    const picked = prePicked || (await pickProvider(root, { writeMode, slug }));
    activeProvider = picked.provider;
    handlersStatus(picked, mode, op, onEvent, resume);
    const wrapped = wrapEvents({
      root,
      op: op || (mode === "ask" || mode === "plan" ? mode : "chat"),
      slug,
      picked,
      onEvent,
    });
    if (resume?.messages) {
      return picked.provider.run("", {
        onEvent: wrapped,
        signal: controller.signal,
        resumeMessages: resume.messages,
        resumeTurn: resume.turn,
      });
    }
    return picked.provider.run(prompt, {
      onEvent: wrapped,
      signal: controller.signal,
      images: Array.isArray(images) ? images : [],
    });
  }

  function handlersStatus(picked, mode, op, onEvent, resume) {
    if (resume) {
      onEvent?.({
        type: "status",
        message: `Continue · ${picked.label || picked.id} · ${picked.model} · turn ${(resume.turn || 1) + 1}+`,
      });
      return;
    }
    if (op === "generate") {
      onEvent?.({
        type: "status",
        message: `Provider ${picked.id} · model ${picked.model}`,
      });
      return;
    }
    onEvent?.({
      type: "status",
      message: `${picked.label || picked.id} · ${picked.model} · ${
        mode === "ask" ? "Ask" : mode === "plan" ? "Plan" : "Agent"
      }`,
    });
  }

  const sessionApi = {
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
    getCheckpointInfo() {
      return checkpointInfo();
    },

    // ── The conversation, so it can outlive this process ────────────────────
    //
    // `chatHistory` and `checkpoint` are closures in here, and the sessions that hold them are a
    // `Map` in index.js. That means the whole exchange with the model dies on restart, and this
    // instance restarts on every redeploy and every idle shutdown. `resume` does not bring it
    // back — it opens a fresh session over whatever build survived.
    //
    // These two give Forge something to keep and something to hand back. Nothing else reads them.
    getPersistableState() {
      return { chatHistory, checkpoint };
    },

    /**
     * Put a saved conversation back.
     *
     * Only onto an untouched session: overwriting a session that has already said something would
     * lose the newer exchange and leave a checkpoint that does not match it.
     */
    restorePersistableState(state) {
      if (!state || chatHistory.length || checkpoint) return { restored: false, reason: "session already in use" };
      if (Array.isArray(state.chatHistory)) chatHistory = state.chatHistory;
      if (state.checkpoint?.messages?.length) checkpoint = state.checkpoint;
      return { restored: true, messages: checkpoint?.messages?.length || 0, history: chatHistory.length };
    },
    async generateFinal(handlers = {}) {
      if (busy) throw new Error("Session busy");
      busy = true;
      controller = new AbortController();
      runMeta = { mode: "agent", op: "generate" };
      try {
        const tdd = await readTdd(tddsRoot, slug);
        const picked = await pickProvider(root, { writeMode: "generate", slug });
        const runtimeIndex = await buildRuntimeApiIndex(root).catch(() => "");
        const templateSeed = await seedTemplateIfEmpty(root, tdd.text).catch((err) => ({ seeded: false, skipped: err.message }));
        handlers.onEvent?.({
          type: "status",
          message: templateSeed.seeded
            ? `Starter template: ${templateSeed.id} (${templateSeed.reason})`
            : `Starter template skipped: ${templateSeed.skipped || "n/a"}`,
        });
        if (templateSeed.seeded) handlers.onEvent?.({ type: "template", ...templateSeed });
        const prompt = buildGenerateFinalPrompt({
          templateSeed,
          slug,
          tddText: tdd.text,
          tddRelPath: tdd.relPath,
          agentsMd,
          pack,
          runtime: picked.kind === "cursor" ? "cursor" : "llm",
          runtimeIndex,
        });
        const result = await runProvider(prompt, {
          writeMode: "generate",
          op: "generate",
          mode: "agent",
          onEvent: handlers.onEvent,
          picked,
        });
        if (result?.status === "cancelled" || result?.resumable) {
          captureCheckpoint(runMeta);
          return result;
        }
        checkpoint = null;
        const report = await emitSoftAdvice({
          root,
          tddsRoot,
          slug,
          onEvent: handlers.onEvent,
          previousDigest: lastAdviceDigest,
        });
        if (report?.digest !== undefined) lastAdviceDigest = report.digest;
        return result;
      } catch (err) {
        captureCheckpoint(runMeta);
        throw err;
      } finally {
        if (activeProvider?.getCheckpoint?.()?.messages?.length) {
          captureCheckpoint(runMeta);
        }
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
      const mode =
        handlers.mode === "ask" ? "ask" : handlers.mode === "plan" ? "plan" : "agent";
      const readOnly = mode === "ask" || mode === "plan";
      const images = Array.isArray(handlers.images) ? handlers.images : [];
      runMeta = { mode, op: readOnly ? mode : "chat" };
      if (trimmed) {
        chatHistory.push({
          role: "user",
          message: trimmed,
          mode,
          at: Date.now(),
          images: images.length,
        });
      }
      try {
        let tddText = "";
        try {
          tddText = (await readTdd(tddsRoot, slug)).text;
        } catch {
          /* optional */
        }
        const beforeFp = readOnly ? null : await gameplayFingerprint(root);
        let gameplayContext = "";
        try {
          gameplayContext = await buildGameplayChatContext(root);
        } catch {
          /* optional */
        }
        const writeMode = readOnly ? mode : "chat";
        const picked = await pickProvider(root, { writeMode, slug });
        const runtimeIndex = await buildRuntimeApiIndex(root, { compact: true }).catch(() => "");
        const prompt = buildChatPrompt({
          slug,
          message: trimmed,
          agentsMd,
          pack,
          tddText,
          adviceDigest: lastAdviceDigest,
          gameplayContext,
          mode,
          runtime: picked.kind === "cursor" ? "cursor" : "llm",
          runtimeIndex,
        });
        const assistantChunks = [];
        const onEvent = (ev) => {
          if (mode === "plan" && ev?.type === "assistant" && ev.text) {
            assistantChunks.push(String(ev.text));
          }
          handlers.onEvent?.(ev);
        };
        const result = await runProvider(prompt, {
          writeMode,
          op: readOnly ? mode : "chat",
          mode,
          onEvent,
          images,
          picked,
        });
        if (result?.status === "cancelled" || result?.resumable) {
          captureCheckpoint(runMeta);
          return { result, mode, resumable: true };
        }
        checkpoint = null;
        let gameplayChanged = false;
        if (!readOnly) {
          const afterFp = await gameplayFingerprint(root);
          gameplayChanged = Boolean(
            beforeFp && afterFp && beforeFp.fingerprint !== afterFp.fingerprint,
          );
          if (gameplayChanged) {
            handlers.onEvent?.({
              type: "gameplay-changed",
              fingerprint: afterFp.fingerprint,
              files: afterFp.files.map((f) => f.path),
            });
          }
          const report = await emitSoftAdvice({
            root,
            tddsRoot,
            slug,
            onEvent: handlers.onEvent,
            previousDigest: lastAdviceDigest,
          });
          if (report?.digest !== undefined) lastAdviceDigest = report.digest;
        }
        let plan = null;
        if (mode === "plan") {
          plan = parseChatPlan(assistantChunks.join("\n\n"));
          handlers.onEvent?.({ type: "plan-proposal", ...plan });
        }
        return { result, mode, plan, gameplayChanged };
      } catch (err) {
        captureCheckpoint(runMeta);
        throw err;
      } finally {
        if (activeProvider?.getCheckpoint?.()?.messages?.length) {
          captureCheckpoint(runMeta);
        }
        busy = false;
        controller = null;
        activeProvider = null;
      }
    },
    async continueFromCheckpoint(handlers = {}) {
      if (busy) throw new Error("Session busy");
      if (!checkpoint?.messages?.length) {
        throw new Error("No checkpoint — Stop an LLM run first (Cursor cannot resume mid-run)");
      }
      busy = true;
      controller = new AbortController();
      const cp = checkpoint;
      runMeta = { mode: cp.mode || "agent", op: cp.op || "chat" };
      try {
        const assistantChunks = [];
        const onEvent = (ev) => {
          if (cp.mode === "plan" && ev?.type === "assistant" && ev.text) {
            assistantChunks.push(String(ev.text));
          }
          handlers.onEvent?.(ev);
        };
        const writeMode = cp.writeMode || "chat";
        const readOnly = writeMode === "ask" || writeMode === "plan" || cp.mode === "ask" || cp.mode === "plan";
        const beforeFp = readOnly ? null : await gameplayFingerprint(root);
        const result = await runProvider("", {
          writeMode,
          op: cp.op,
          mode: cp.mode,
          onEvent,
          resume: { messages: cp.messages, turn: cp.turn },
        });
        if (result?.status === "cancelled" || result?.resumable) {
          captureCheckpoint(runMeta);
          return { result, mode: cp.mode, resumable: true, continued: true };
        }
        checkpoint = null;
        activeProvider?.clearCheckpoint?.();
        let gameplayChanged = false;
        if (!readOnly) {
          const afterFp = await gameplayFingerprint(root);
          gameplayChanged = Boolean(
            beforeFp && afterFp && beforeFp.fingerprint !== afterFp.fingerprint,
          );
          if (gameplayChanged) {
            handlers.onEvent?.({
              type: "gameplay-changed",
              fingerprint: afterFp.fingerprint,
              files: afterFp.files.map((f) => f.path),
            });
          }
          const report = await emitSoftAdvice({
            root,
            tddsRoot,
            slug,
            onEvent: handlers.onEvent,
            previousDigest: lastAdviceDigest,
          });
          if (report?.digest !== undefined) lastAdviceDigest = report.digest;
        }
        let plan = null;
        if (cp.mode === "plan") {
          plan = parseChatPlan(assistantChunks.join("\n\n"));
          handlers.onEvent?.({ type: "plan-proposal", ...plan });
        }
        return { result, mode: cp.mode, continued: true, plan, gameplayChanged };
      } catch (err) {
        captureCheckpoint(runMeta);
        throw err;
      } finally {
        if (activeProvider?.getCheckpoint?.()?.messages?.length) {
          captureCheckpoint(runMeta);
        }
        busy = false;
        controller = null;
        activeProvider = null;
      }
    },
    async previewSyncTdd({ summary = "", chatDigest = "" } = {}, handlers = {}) {
      if (busy) throw new Error("Session busy");
      busy = true;
      controller = new AbortController();
      runMeta = { mode: "ask", op: "sync" };
      const assistantChunks = [];
      try {
        const tdd = await readTdd(tddsRoot, slug);
        const gameplayFiles = await listGameplayFiles(root);
        const digest = mergeChatDigest(chatHistory, chatDigest);
        const prompt = buildSyncPreviewPrompt({
          slug,
          tddText: tdd.text,
          tddRelPath: tdd.relPath,
          summary:
            summary ||
            "List TDD updates implied by the current playable vs the spec.",
          chatDigest: digest,
          gameplayFiles,
          root,
          pack,
        });
        const onEvent = (ev) => {
          if (ev?.type === "assistant" && ev.text) assistantChunks.push(String(ev.text));
          handlers.onEvent?.(ev);
        };
        const result = await runProvider(prompt, {
          writeMode: "ask",
          op: "sync",
          mode: "ask",
          onEvent,
        });
        if (result?.status === "cancelled" || result?.resumable) {
          captureCheckpoint(runMeta);
          return { items: [], cancelled: true };
        }
        const proposal = parseSyncProposal(assistantChunks.join("\n\n"));
        handlers.onEvent?.({ type: "sync-proposal", items: proposal.items });
        return proposal;
      } catch (err) {
        captureCheckpoint(runMeta);
        throw err;
      } finally {
        if (activeProvider?.getCheckpoint?.()?.messages?.length) {
          captureCheckpoint(runMeta);
        }
        busy = false;
        controller = null;
        activeProvider = null;
      }
    },
    async syncTdd({ summary = "", chatDigest = "", selectedItems = [] } = {}, handlers = {}) {
      if (busy) throw new Error("Session busy");
      busy = true;
      controller = new AbortController();
      runMeta = { mode: "agent", op: "sync" };
      try {
        const tdd = await readTdd(tddsRoot, slug);
        const gameplayFiles = await listGameplayFiles(root);
        const digest = mergeChatDigest(chatHistory, chatDigest);
        const selected = Array.isArray(selectedItems) ? selectedItems : [];
        const prompt = buildSyncPrompt({
          slug,
          tddText: tdd.text,
          tddRelPath: tdd.relPath,
          summary:
            summary ||
            (digest
              ? "Sync validated chat iterations and prototype behavior into the TDD"
              : "Promote validated prototype behavior into the TDD product spec"),
          chatDigest: digest,
          selectedItems: formatSelectedSyncItems(selected),
          gameplayFiles,
          root,
          agentsMd,
          pack,
        });
        const result = await runProvider(prompt, {
          writeMode: "sync",
          op: "sync",
          mode: "agent",
          onEvent: handlers.onEvent,
        });
        if (result?.status === "cancelled" || result?.resumable) {
          captureCheckpoint(runMeta);
          return result;
        }
        checkpoint = null;
        return await finalizeTddSync(tddsRoot, slug);
      } catch (err) {
        captureCheckpoint(runMeta);
        throw err;
      } finally {
        if (activeProvider?.getCheckpoint?.()?.messages?.length) {
          captureCheckpoint(runMeta);
        }
        busy = false;
        controller = null;
        activeProvider = null;
      }
    },
    cancel() {
      controller?.abort?.();
      activeProvider?.cancel?.();
      captureCheckpoint(runMeta);
      return checkpointInfo();
    },
    /**
     * Visual QA: capture → score → optional auto-polish rounds (Agent chat with the fixes + screenshots).
     * @param {{ baseUrl: string, autofix?: number, minScore?: number, onEvent?: Function }} handlers
     */
    async visualQa(handlers = {}) {
      if (busy) throw new Error("Session busy");
      const onEvent = handlers.onEvent;
      const rounds = Math.max(0, Math.min(3, Number(handlers.autofix ?? process.env.LAB_QA_AUTOFIX ?? 0) || 0));
      const minScore = Number(handlers.minScore ?? process.env.LAB_QA_MIN_SCORE ?? 7);
      let tddText = "";
      try {
        tddText = (await readTdd(tddsRoot, slug)).text;
      } catch {
        /* optional */
      }
      busy = true;
      let report;
      try {
        report = await runVisualQa({ root, baseUrl: handlers.baseUrl, tddText, onEvent });
      } finally {
        busy = false;
      }
      onEvent?.({ type: "qa-report", round: 0, ...slimReport(report) });
      for (let r = 1; r <= rounds; r += 1) {
        if (!report?.judge?.judged || report.judge.overall >= minScore) break;
        onEvent?.({ type: "status", message: `Auto-polish ${r}/${rounds} · ${report.judge.overall}/10 < ${minScore}` });
        const images = await qaImagesForChat(report);
        await sessionApi.chat(buildQaFixMessage(report), { mode: "agent", images, onEvent });
        onEvent?.({ type: "gameplay-changed", reason: "visual-qa" });
        busy = true;
        try {
          report = await runVisualQa({ root, baseUrl: handlers.baseUrl, tddText, onEvent });
        } finally {
          busy = false;
        }
        onEvent?.({ type: "qa-report", round: r, ...slimReport(report) });
      }
      return slimReport(report);
    },
  };
  return sessionApi;
}

function slimReport(report) {
  return {
    digest: report?.digest || "",
    overall: report?.judge?.judged ? report.judge.overall : null,
    scores: report?.judge?.scores || null,
    fixes: report?.judge?.fixes || [],
    technical: report?.technical || [],
    images: report?.images || [],
    captureOk: !!report?.capture?.ok,
    reason: report?.capture?.ok ? report?.judge?.reason || null : report?.capture?.reason || null,
  };
}
