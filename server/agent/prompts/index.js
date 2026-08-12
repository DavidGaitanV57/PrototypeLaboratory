import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = __dirname;

async function readPrompt(name) {
  return fs.readFile(path.join(PROMPTS_DIR, name), "utf8");
}

export async function loadPromptPack() {
  const [quality, generateFinal, chat, syncTdd] = await Promise.all([
    readPrompt("playable-quality.md"),
    readPrompt("generate-final.md"),
    readPrompt("chat.md"),
    readPrompt("sync-tdd.md"),
  ]);
  return { quality, generateFinal, chat, syncTdd };
}

export function buildGenerateFinalPrompt({ slug, tddText, agentsMd, pack }) {
  return [
    agentsMd,
    "",
    pack.quality,
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

export function buildChatPrompt({ slug, message, agentsMd, pack }) {
  return [
    agentsMd,
    "",
    pack.quality,
    "",
    pack.chat,
    "",
    `TDD slug: ${slug} (read-only this turn)`,
    `User request:\n${message}`,
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
