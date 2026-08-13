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
  const [quality, generateFinal, chat, chatAsk, syncTdd, genreLoop] = await Promise.all([
    readPrompt("playable-quality.md"),
    readPrompt("generate-final.md"),
    readPrompt("chat.md"),
    readPrompt("chat-ask.md"),
    readPrompt("sync-tdd.md"),
    readPrompt("genre-loop.md"),
  ]);
  return { quality, generateFinal, chat, chatAsk, syncTdd, genreLoop };
}

export function buildGenerateFinalPrompt({ slug, tddText, agentsMd, pack }) {
  const genreBrief = buildGenreBrief(tddText);
  return [
    agentsMd,
    "",
    pack.quality,
    "",
    pack.genreLoop,
    "",
    genreBrief,
    "",
    pack.generateFinal,
    "",
    `## Active TDD slug: ${slug}`,
    `Path: docs/tdds/${slug}/TDD.md`,
    "",
    "## TDD contents",
    tddText,
  ].join("\n");
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
  const chatRules = ask ? pack.chatAsk : pack.chat;

  // Ask: keep context light so the model answers the question, not a full design audit.
  if (ask) {
    return [
      chatRules,
      "",
      `## Mode: ASK (read-only)`,
      `Do not write or modify any files. TDD slug: ${slug}.`,
      "Read gameplay/TDD only as needed to answer. Match reply length to the question.",
      adviceDigest
        ? `\n## Soft playability notes (only if relevant to their question)\n${adviceDigest}\n`
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
    pack.genreLoop,
    "",
    genreBrief,
    "",
    chatRules,
    "",
    `## Mode: AGENT (edit gameplay)`,
    `TDD slug: ${slug} (TDD file is read-only this turn)`,
    adviceDigest
      ? `\n## Soft playability notes from last check (fix if the user is addressing them)\n${adviceDigest}\n`
      : "",
    `User request:\n${message}`,
  ]
    .filter((s) => s !== "")
    .join("\n");
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
}) {
  const evidenceList =
    gameplayFiles.length > 0
      ? gameplayFiles.map((f) => `- ${f}`).join("\n")
      : "- public/gameplay/main.js\n- public/gameplay/config.js\n- public/gameplay/hud.js";

  return [
    agentsMd,
    "",
    pack.syncTdd,
    "",
    `Project root: ${root || "."}`,
    `TDD path: docs/tdds/${slug}/TDD.md`,
    "",
    "## Operator summary",
    summary || "Promote validated prototype changes into the TDD product spec.",
    "",
    "## Validated change digest (chat + iteration the operator approved)",
    chatDigest || "(Read gameplay evidence and infer deltas vs the TDD below.)",
    "",
    "## Gameplay evidence — read ALL of these before editing the TDD",
    evidenceList,
    "",
    "Do not copy file paths or web stack names into the TDD. Extract product rules only.",
    "",
    "## Current TDD",
    tddText,
    "",
    "Edit ONLY docs/tdds/" + slug + "/TDD.md now.",
  ].join("\n");
}
