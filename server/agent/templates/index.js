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
import { inferGenreHints } from "../playabilityAdvisor.js";

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

/** Declared genre from the TDD (YAML `genre:` or the `Genre / sub-genre` table row). */
export function declaredGenre(tddText = "") {
  const t = String(tddText);
  const yaml = t.match(/^genre:\s*["']?([^"'\n]+)/im);
  if (yaml) return yaml[1].trim();
  const table = t.match(/\|\s*\*\*Genre\s*\/\s*sub-genre\*\*\s*\|\s*([^|\n]+)\|/i);
  return table ? table[1].trim() : "";
}

// Order matters: the first family whose pattern hits wins ("rhythm-action platformer" → platformer, not arena).
const FAMILIES = [
  ["kart", /\b(kart|racing|racer|race)\b/i],
  ["platformer", /\b(platformer|platforming|platform game|metroidvania|runner|jump\s*'?n'?\s*run|collectathon|collector|vertical ascent|endless (?:climber|vertical))\b/i],
  ["firstperson", /\b(first[-\s]?person|fps shooter|first-person shooter|horror|backrooms|liminal|stealth|infiltration|walking sim\w*|immersive sim)\b/i],
  ["arena", /\b(arena|twin[-\s]?stick|shoot(?:er|\s*'?em\s*up)|brawler|beat\s*'?em\s*up|hack\s*(?:and|&|'n')\s*slash|wave survival|survivor(?:s|-like)?|roguelite|roguelike|action)\b/i],
];

// Genres no starter fits — seeding one would push the agent toward the wrong game.
const NO_STARTER = /\b(pinball|puzzle|match[-\s]?3|card|deck[-\s]?builder|strategy|tower defen[cs]e|city[-\s]?builder|management|tycoon|visual novel|rhythm game|music game|golf|billiards|pool|sports|fighting game|board game|idle|clicker|trivia|word game)\b/i;

function familyOf(text) {
  for (const [id, re] of FAMILIES) if (re.test(text)) return id;
  return null;
}

/**
 * Pick the closest template for a TDD, or `{ id: null }` when none fits.
 * The declared genre decides; body text is only a fallback. Technical text such as "60 fps",
 * "FPS target" or "diegetic HUD" must never pick a genre.
 * @returns {{ id: string|null, reason: string, genre?: string }}
 */
export function pickTemplate(tddText = "") {
  const t = String(tddText);
  const genre = declaredGenre(t);
  if (genre) {
    const fam = familyOf(genre);
    if (fam) return { id: fam, genre, reason: `declared genre "${genre}"` };
    if (NO_STARTER.test(genre)) return { id: null, genre, reason: `no starter fits declared genre "${genre}"` };
    return { id: null, genre, reason: `declared genre "${genre}" does not match a starter` };
  }
  // No declared genre: look only at the high-concept / core-gameplay sections, not budgets or gates.
  const head = (t.match(/#\s*1\s*[·.][\s\S]*?(?=\n#\s*4\b)/i) || [t.slice(0, 6000)])[0];
  if (NO_STARTER.test(head)) return { id: null, reason: "high concept names a genre with no starter" };
  const hints = inferGenreHints(head).map((h) => h.genre);
  if (hints.includes("kart")) return { id: "kart", reason: "high concept reads as a kart/race loop" };
  const fam = familyOf(head);
  if (fam) return { id: fam, reason: `high concept reads as ${fam}` };
  if (hints.includes("platformer") || hints.includes("collector")) return { id: "platformer", reason: "high concept reads as a platformer / collector" };
  if (hints.includes("arena")) return { id: "arena", reason: "high concept reads as arena / combat" };
  return { id: null, reason: "no clear genre — generating without a starter" };
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
  if (!id) return { seeded: false, skipped: reason };
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
    "3. Camera, movement space (2D / 2.5D side-view / 3D) and control mode come from TDD §11.5 — replace the starter's camera and controller when they differ (e.g. lock a side-scroller to the X/Y plane with a side follow camera).",
    "4. Rename and reshape mechanics, entities, level layout and HUD labels to the TDD's fiction and §B mechanics. Delete what the TDD does not want; add what it needs as new modules.",
    "5. Keep the wiring that already works: mount/unmount, LookKit, HudKit title/countdown/result, feedback events in juice.js, `window.__plab` + `window.__PLAB_AUTOPLAY` hooks (visual QA drives the game with them).",
    "6. The result must not look like the starter with a new name — silhouettes, palette, layout and verbs must be the TDD's.",
    `Files: ${seed.files.map((f) => `\`${f}\``).join(", ")}`,
  ].join("\n");
}
