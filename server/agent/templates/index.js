/**
 * Genre starter templates — known-good playable skeletons (LookKit, HudKit, JuiceKit, FxKit, AudioKit already wired).
 *
 * On Generate Final with an empty `public/gameplay/`, the lab seeds the closest template so the agent
 * adapts a working game to the TDD instead of rebuilding engine plumbing from zero.
 * Disable with LAB_TEMPLATES=off.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inferGenreHints, tddAsksQuietHud } from "../playabilityAdvisor.js";

const TEMPLATES_DIR = path.dirname(fileURLToPath(import.meta.url));

export const TEMPLATES = {
  kart: {
    label: "Kart / race",
    files: ["main.js", "config.js", "look.js", "track.js", "kart.js", "hud.js", "juice.js"],
    summary:
      "Spline track with curbs/arch/scenery, arcade karts (drift → mini-turbo), rubber-band AI, laps via PathKit progress, item boxes (turbo/shock), boost pads, minimap, intro orbit + 3-2-1-GO, finish slow-mo + result.",
  },
  platformer: {
    label: "3D platformer / collector",
    files: ["main.js", "config.js", "look.js", "level.js", "player.js", "hud.js", "juice.js"],
    summary:
      "Floating islands (AABB colliders), moving platforms, bounce pads, spinner hazards, stars + goal beacon, coyote time / jump buffer / double jump, lives + timer, intro orbit, win/lose + restart.",
  },
  firstperson: {
    label: "First-person explore / horror / stealth",
    files: ["main.js", "config.js", "look.js", "maze.js", "stalker.js", "hud.js", "juice.js"],
    summary:
      "Seeded grid maze with lamp pools + flashlight shadows, keycards + exit door, stamina sprint, stalker AI (vision cone + LOS + BFS chase), heartbeat/ambience audio, escape/caught + restart.",
  },
  arena: {
    label: "Arena / twin-stick / waves",
    files: ["main.js", "config.js", "look.js", "arena.js", "combat.js", "hud.js", "juice.js"],
    summary:
      "Neon ring arena with cover pillars + portals, hero move/dash/aim/shoot, pooled bullets, 3 enemy archetypes, waves, combo scoring, heal drops, intro orbit, win/lose + restart.",
  },
};

/**
 * Pick the closest template for a TDD.
 * @returns {{ id: string, reason: string }}
 */
export function pickTemplate(tddText = "") {
  const t = String(tddText);
  const genres = inferGenreHints(t).map((h) => h.genre);
  const firstPerson = /\b(first[-\s]?person|fps|backrooms|liminal|horror|stealth|infiltrat\w*|walking\s+sim\w*|explor\w+\s+(?:game|horror)|noclip)\b/i.test(t);
  if (genres.includes("kart")) return { id: "kart", reason: "TDD reads as a kart/race loop" };
  if (firstPerson || tddAsksQuietHud(t)) return { id: "firstperson", reason: "TDD implies first-person / horror / stealth" };
  if (genres.includes("platformer")) return { id: "platformer", reason: "TDD reads as a platformer / collector" };
  if (genres.includes("collector")) return { id: "platformer", reason: "Collector loop — platformer starter has collectibles + goal" };
  return { id: "arena", reason: "Action / arena / generic loop" };
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Seed `public/gameplay/` from a template when there is no playable yet.
 * @returns {Promise<{ seeded: boolean, id?: string, reason?: string, files?: string[], skipped?: string }>}
 */
export async function seedTemplateIfEmpty(root, tddText, { env = process.env } = {}) {
  if (String(env.LAB_TEMPLATES || "").toLowerCase() === "off") return { seeded: false, skipped: "LAB_TEMPLATES=off" };
  const gameplay = path.join(root, "public", "gameplay");
  if (await exists(path.join(gameplay, "main.js"))) return { seeded: false, skipped: "existing build kept (Clean project to start from a genre starter)" };
  const { id, reason } = pickTemplate(tddText);
  const tpl = TEMPLATES[id];
  await fs.mkdir(gameplay, { recursive: true });
  const written = [];
  for (const f of tpl.files) {
    await fs.copyFile(path.join(TEMPLATES_DIR, id, f), path.join(gameplay, f));
    written.push(`public/gameplay/${f}`);
  }
  return { seeded: true, id, reason, files: written };
}

/** Prompt section describing the seeded starter. */
export function templateBrief(seed) {
  if (!seed?.seeded) return "";
  const tpl = TEMPLATES[seed.id];
  return [
    `## Starter template already in public/gameplay/ — ${tpl.label}`,
    `Seeded because: ${seed.reason}. It is a complete, working, good-looking game: ${tpl.summary}`,
    "",
    "**Your job is to transform it into THIS TDD's game, not to start over:**",
    "1. `look.js` FIRST — rewrite the Look Bible from TDD art/atmosphere/UI/audio (LookKit preset + overrides, palette, HUD theme, music/ambience, intro, wow moment).",
    "2. `config.js` — META title/subtitle and every quantified TDD number (speeds, timers, counts, win/lose thresholds).",
    "3. Rename and reshape mechanics, entities, level layout and HUD labels to the TDD's fiction and §B mechanics. Delete what the TDD does not want; add what it needs as new modules.",
    "4. Keep the wiring that already works: mount/unmount, LookKit, HudKit title/countdown/result, feedback events in juice.js, `window.__plab` + `window.__PLAB_AUTOPLAY` hooks (visual QA drives the game with them).",
    "5. The result must not look like the starter with a new name — silhouettes, palette, layout and verbs must be the TDD's.",
    `Files: ${seed.files.map((f) => `\`${f}\``).join(", ")}`,
  ].join("\n");
}
