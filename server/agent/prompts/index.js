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
    presentation,
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
    readPrompt("presentation.md"),
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
    presentation,
  };
}

/** Compact rules — replaces pasting AGENTS + full quality/vertical/genre/presentation packs. */
const GENERATE_COMPACT_CONTRACTS = `## Compact contracts (do not re-read whole prompt packs)

Write **only** \`public/gameplay/**\`. Never edit \`public/runtime/**\`, lab UI, \`server/**\`, or the TDD.

Entry: \`main.js\` exports \`mount(canvas, { hudRoot })\` + \`unmount()\`. Prefer return \`{ sceneKit }\`.

Required: \`hud.js\` (HudKit), \`juice.js\` (JuiceKit). Full loop: start → verb → win/lose → restart (no F5). Delta-time movement. HUD off bottom-right.

Graybox meshes (primitives). Raise look when TDD defines fog/grain/vignette/palette via PresentationKit. Theme HudKit (\`arcade\`/\`party\` vs \`liminal\`/\`muted\`/\`stealth\` or \`themeFromPalette\`) from TDD mood.

Kits (import, do **not** read full runtime sources): \`/runtime/Engine.js\`, SceneKit, Input, Primitives, CameraRig, HudKit, JuiceKit, PathKit, MinimapKit, PresentationKit.

- Hud: \`createHud(root, { theme })\` — panels, stats, toast, showResult.
- Juice: \`createJuice({ camera, canvas })\` — shake/flash/hit-stop.
- Look: \`createPresentation({ canvas })\` — applyFog, setGrain/Vignette/Vhs/Wash, trails/curbs when TDD asks.

Kart: PathKit laps must increment; finish at totalLaps. Collector/arena/platformer: live HUD + win/lose + restart.`;

/**
 * Short TDD digest for Generate Final — enough fantasy/loop/mechanics list without the full doc.
 * Model should read_file the TDD path for quantified numbers.
 */
export function summarizeTddForPrompt(tddText = "", { maxChars = 10_000 } = {}) {
  const text = String(tddText || "");
  if (!text.trim()) return "(TDD empty — read the file at Path below.)";
  if (text.length <= maxChars) return text;

  const chunks = [];
  const grab = (re, label, lim = 1800) => {
    const m = text.match(re);
    if (!m) return;
    chunks.push(`### ${label}\n${m[0].slice(0, lim).trim()}`);
  };

  grab(/#\s*1\s*[·.].*?(?=\n#\s*2\b)/is, "High concept", 1200);
  grab(/#\s*3\s*[·.].*?(?=\n#\s*4\b)/is, "Core gameplay / loop", 2000);
  grab(/#\s*8\s*[·.].*?(?=\n#\s*9\b)/is, "Art / atmosphere", 2200);
  grab(/#\s*9\s*[·.].*?(?=\n#\s*10\b)/is, "UI / UX", 900);
  grab(/##\s*11\.3\b[\s\S]*?(?=\n##\s*11\.\d|\n#\s*12\b)/i, "Input map", 1200);
  grab(/##\s*11\.5\b[\s\S]*?(?=\n##\s*11\.\d|\n#\s*12\b)/i, "Camera / movement", 900);

  const mechanics = [...text.matchAll(/^#{2,3}\s*Mechanic:[^\n]+/gim)].map((m) => m[0].replace(/^#+\s*/, ""));
  if (mechanics.length) {
    chunks.push(`### Mechanics (§B titles — read file for rules)\n${mechanics.map((m) => `- ${m}`).join("\n")}`);
  }

  let out = chunks.join("\n\n").trim();
  if (!out) out = text.slice(0, maxChars);
  if (out.length > maxChars) out = `${out.slice(0, maxChars - 80).trim()}\n\n…(digest truncated)`;
  out += `\n\n_(Full TDD is longer — use read_file on the path for complete §B numbers/rules. Do not re-dump the whole TDD into chat.)_`;
  return out;
}

/**
 * Generate Final prompt.
 * Default is **slim** (chat-web spend): compact contracts + TDD digest + read_file for details.
 * Pass `verbose: true` only for debugging (pastes AGENTS + full packs + full TDD — burns quota).
 */
export function buildGenerateFinalPrompt({
  slug,
  tddText,
  agentsMd,
  pack,
  tddRelPath,
  runtime = "llm",
  verbose = false,
}) {
  const genreBrief = buildGenreBrief(tddText);
  const tddPath = tddRelPath || `docs/tdds/${slug}/TDD.md`;

  if (verbose) {
    return [
      agentsMd,
      "",
      pack.quality,
      "",
      pack.verticalSlice,
      "",
      pack.presentation,
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

  // Cursor can open files itself; LLM uses read_file — same slim user message either way.
  void runtime;
  return [
    pack.generateFinal,
    "",
    GENERATE_COMPACT_CONTRACTS,
    "",
    genreBrief,
    "",
    `## Active TDD slug: ${slug}`,
    `Path: ${tddPath}`,
    "",
    "## First actions (quota-aware)",
    "1. read_file the TDD path once for §B / §3 / art / input numbers you need — then **write** `main.js`, `hud.js`, `juice.js` immediately.",
    "2. Do **not** read every file under `public/runtime/` — import kits; truncated runtime reads are intentional.",
    "3. Do not paste AGENTS.md or prompt packs into tools; contracts above are enough.",
    "",
    "## TDD digest",
    summarizeTddForPrompt(tddText),
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
  gameplayContext = "",
  mode = "agent",
  /** Cursor SDK already has cwd tools — keep prompts short to avoid key-exchange / transport failures. */
  runtime = "llm",
}) {
  const ask = mode === "ask";
  const plan = mode === "plan";
  const lang = replyLanguageDirective(message);
  const scopeBlock = gameplayContext
    ? `\n${gameplayContext}\n`
    : "\n## Playable scope\nStay in `public/gameplay/**`. Do not scan the rest of the lab.\n";

  if (ask || plan) {
    const chatRules = plan ? pack.chatPlan : pack.chatAsk;
    return [
      chatRules,
      "",
      plan
        ? `## Mode: PLAN (read-only)\nDo not write files. End with the JSON plan object only (no code). TDD slug: ${slug}.`
        : `## Mode: ASK (read-only)\nDo not write or modify any files. TDD slug: ${slug}.\nRead gameplay/TDD only as needed to answer. Match reply length to the question.`,
      lang,
      scopeBlock,
      adviceDigest
        ? `\n## Soft playability notes (only if relevant)\n${adviceDigest}\n`
        : "",
      `User request:\n${message}`,
    ]
      .filter((s) => s !== "")
      .join("\n");
  }

  // Cursor local agent can read the repo itself — do not paste AGENTS.md + genre packs
  // (multi‑100KB prompts correlate with SDK "API key exchange endpoint: fetch failed").
  if (runtime === "cursor") {
    return [
      "## Mode: AGENT (edit gameplay via Cursor)",
      `TDD slug: ${slug}. Prefer reading docs/tdds/${slug}/TDD.md and public/gameplay/** yourself.`,
      "Write only under public/gameplay/**. Do not edit public/runtime/**, public/app.js, server/**, or AGENTS.md.",
      "Keep mount/unmount, HudKit/JuiceKit, full loop (win/lose/restart), graybox primitives.",
      "If TDD defines fog/grain/vignette/palette/atmosphere, raise look with PresentationKit.",
      "Match the user language. Keep the reply short after edits.",
      lang,
      scopeBlock,
      adviceDigest
        ? `\n## Soft playability notes (fix if relevant)\n${adviceDigest}\n`
        : "",
      `User request:\n${message}`,
    ]
      .filter((s) => s !== "")
      .join("\n");
  }

  // Chat Agent must stay light — Ask works for "Hi" because it is small; the old Agent
  // path pasted AGENTS.md + quality + genre packs on every turn and blew up provider fetch.
  return [
    pack.chat,
    "",
    "## Mode: AGENT (edit gameplay)",
    `TDD slug: ${slug} (TDD file is read-only this turn).`,
    "Write only `public/gameplay/**`. Keep mount/unmount, HudKit, JuiceKit, full loop, graybox.",
    "If TDD defines fog/grain/vignette/palette/atmosphere, use PresentationKit.",
    "Do not edit `public/runtime/**`, lab UI, `server/**`, or `AGENTS.md`.",
    "If you need TDD numbers/rules, read `docs/tdds/<slug>/TDD.md` with tools — do not wait for a pasted dump.",
    lang,
    scopeBlock,
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
