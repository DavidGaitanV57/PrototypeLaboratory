import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildGenreBrief } from "../playabilityAdvisor.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = __dirname;

async function readPrompt(name) {
  return fs.readFile(path.join(PROMPTS_DIR, name), "utf8");
}

export async function loadPromptPack() {
  const [
    quality,
    generateFinal,
    chat,
    chatAsk,
    chatPlan,
    syncTdd,
    syncPreview,
    genreLoop,
    verticalSlice,
  ] = await Promise.all([
    readPrompt("playable-quality.md"),
    readPrompt("generate-final.md"),
    readPrompt("chat.md"),
    readPrompt("chat-ask.md"),
    readPrompt("chat-plan.md"),
    readPrompt("sync-tdd.md"),
    readPrompt("sync-preview.md"),
    readPrompt("genre-loop.md"),
    readPrompt("vertical-slice.md"),
  ]);
  return {
    quality,
    generateFinal,
    chat,
    chatAsk,
    chatPlan,
    syncTdd,
    syncPreview,
    genreLoop,
    verticalSlice,
  };
}

export function buildGenerateFinalPrompt({ slug, tddText, agentsMd, pack, tddRelPath }) {
  const genreBrief = buildGenreBrief(tddText);
  const tddPath = tddRelPath || `docs/tdds/${slug}/TDD.md`;
  return [
    agentsMd,
    "",
    pack.quality,
    "",
    pack.verticalSlice,
    "",
    pack.genreLoop,
    "",
    genreBrief,
    "",
    pack.generateFinal,
    "",
    `## Active TDD slug: ${slug}`,
    `Path: ${tddPath}`,
    "",
    "## TDD contents",
    tddText,
  ].join("\n");
}

/** Nudge the model to stay in one language when the TDD/gameplay are English. */
function replyLanguageDirective(message = "") {
  const m = String(message || "").trim();
  if (!m) return "";
  const esScore = (
    m.match(
      /\b(de|del|el|la|los|las|un|una|qué|que|cómo|como|por|para|con|es|está|esta|están|juego|archivo|resumir|explica|arregla|velocidad|salto|timer|porqué|porque|también|más|cuál|cuando|dónde|donde|haz|sube|solo|sólo|ayuda|funciona|rompe|roto|gracias|cuéntame|cuentame|dime|hablame|háblame)\b/gi,
    ) || []
  ).length;
  const enScore = (
    m.match(
      /\b(the|what|how|why|fix|speed|jump|game|file|explain|summarize|broken|works|help|thanks|please|can you|could you|should|would|is|are|was|were|don't|doesn't|it's|that's|with|for|from|this|that|when|where|which|who|tell me|describe)\b/gi,
    ) || []
  ).length;
  if (esScore >= 2 && esScore > enScore) {
    return "\n## Reply language\nRespond **entirely in Spanish** for the full answer. The TDD may be in English — translate concepts, do not paste English paragraphs. Proper nouns (Biolum Ascent, Doodle Jump) may stay in English.\n";
  }
  if (enScore >= 2 && enScore > esScore) {
    return "\n## Reply language\nRespond **entirely in English**. Do not mix in Spanish unless quoting the user.\n";
  }
  return "\n## Reply language\nUse the **same language as the user's message** for the entire reply — do not mix Spanish and English in one answer.\n";
}

export function buildChatPrompt({
  slug,
  message,
  agentsMd,
  pack,
  tddText = "",
  adviceDigest = "",
  mode = "agent",
}) {
  const ask = mode === "ask";
  const plan = mode === "plan";
  const lang = replyLanguageDirective(message);

  if (ask || plan) {
    const chatRules = plan ? pack.chatPlan : pack.chatAsk;
    return [
      chatRules,
      "",
      plan
        ? `## Mode: PLAN (read-only)\nDo not write files. End with the JSON plan object only (no code). TDD slug: ${slug}.`
        : `## Mode: ASK (read-only)\nDo not write or modify any files. TDD slug: ${slug}.\nRead gameplay/TDD only as needed to answer. Match reply length to the question.`,
      lang,
      adviceDigest
        ? `\n## Soft playability notes (only if relevant)\n${adviceDigest}\n`
        : "",
      `User request:\n${message}`,
    ]
      .filter((s) => s !== "")
      .join("\n");
  }

  const genreBrief = tddText ? buildGenreBrief(tddText) : "";
  return [
    agentsMd,
    "",
    pack.quality,
    "",
    pack.verticalSlice,
    "",
    pack.genreLoop,
    "",
    genreBrief,
    "",
    pack.chat,
    "",
    `## Mode: AGENT (edit gameplay)`,
    `TDD slug: ${slug} (TDD file is read-only this turn)`,
    lang,
    adviceDigest
      ? `\n## Soft playability notes from last check (fix if the user is addressing them)\n${adviceDigest}\n`
      : "",
    `User request:\n${message}`,
  ]
    .filter((s) => s !== "")
    .join("\n");
}

function evidenceList(gameplayFiles = []) {
  return gameplayFiles.length > 0
    ? gameplayFiles.map((f) => `- ${f}`).join("\n")
    : "- public/gameplay/main.js\n- public/gameplay/config.js\n- public/gameplay/hud.js";
}

export function buildSyncPreviewPrompt({
  slug,
  tddText,
  summary,
  chatDigest,
  gameplayFiles = [],
  root,
  pack,
  tddRelPath,
}) {
  const tddPath = tddRelPath || `docs/tdds/${slug}/TDD.md`;
  return [
    pack.syncPreview,
    "",
    `Project root: ${root || "."}`,
    `TDD path: ${tddPath}`,
    "",
    "## Operator summary",
    summary || "List TDD updates implied by the current playable.",
    "",
    "## Chat / iteration digest",
    chatDigest || "(Infer deltas from gameplay vs the TDD.)",
    "",
    "## Gameplay evidence — read these before proposing",
    evidenceList(gameplayFiles),
    "",
    "## Current TDD",
    tddText,
    "",
    "Do not write files. End with the JSON object only.",
  ].join("\n");
}

export function buildSyncPrompt({
  slug,
  tddText,
  summary,
  chatDigest,
  gameplayFiles = [],
  root,
  agentsMd,
  pack,
  selectedItems = "",
  tddRelPath,
}) {
  const tddPath = tddRelPath || `docs/tdds/${slug}/TDD.md`;
  return [
    agentsMd,
    "",
    pack.syncTdd,
    "",
    `Project root: ${root || "."}`,
    `TDD path: ${tddPath}`,
    "",
    "## Operator summary",
    summary || "Promote validated prototype changes into the TDD product spec.",
    "",
    "## Operator-approved checklist — apply ONLY these items",
    selectedItems ||
      "(No checklist provided — infer from digest + gameplay, but prefer chat-validated features.)",
    "",
    "## Validated change digest (chat + iteration the operator approved)",
    chatDigest || "(Read gameplay evidence and infer deltas vs the TDD below.)",
    "",
    "## Gameplay evidence — read ALL of these before editing the TDD",
    evidenceList(gameplayFiles),
    "",
    "Do not copy file paths or web stack names into the TDD. Extract product rules only.",
    "",
    "## Current TDD",
    tddText,
    "",
    `Edit ONLY ${tddPath} now.`,
  ].join("\n");
}
