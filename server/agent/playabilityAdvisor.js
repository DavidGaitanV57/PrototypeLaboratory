/**
 * Soft playability advisor — WARN ONLY.
 *
 * Never throws, never blocks Generate Final / Chat / ready.
 * Scans gameplay + TDD text for likely loop gaps so the operator can fix via chat.
 */

import fs from "node:fs/promises";
import path from "node:path";

/**
 * @typedef {{ id: string, severity: "info" | "warn", message: string, chatHint?: string }} Advice
 */

/**
 * @param {string} tddText
 */
export function inferGenreHints(tddText = "") {
  const t = String(tddText).toLowerCase();
  const hints = [];
  const kart =
    /\b(lap|laps|checkpoint|kart|race|drift|item\s*box|mario\s*kart|racing)\b/.test(t);
  const collector =
    /\b(coin|collect|timer|grab|pick\s*up)\b/.test(t) && !kart;
  const arena =
    /\b(arena|combat|wave|enemy|fight|survive|ko)\b/.test(t) && !kart;

  if (kart) {
    hints.push({
      genre: "kart",
      brief:
        "Kart/race loop: lap must increment on finish; race must Finish at totalLaps; HUD lap+position live; items = primitive+label (no image URLs).",
    });
  }
  if (collector) {
    hints.push({
      genre: "collector",
      brief:
        "Collector loop: live count on HUD; win at target / lose on timeout or fall; restart resets state.",
    });
  }
  if (arena) {
    hints.push({
      genre: "arena",
      brief:
        "Arena loop: clear win/lose; NPCs update every frame; rematch without reload.",
    });
  }
  if (!hints.length) {
    hints.push({
      genre: "generic",
      brief:
        "Generic loop: start → core verb → win/lose or round → restart; live HUD; graybox primitives only.",
    });
  }
  return hints;
}

export function buildGenreBrief(tddText = "") {
  const hints = inferGenreHints(tddText);
  return [
    "## Inferred loop brief (from TDD — follow these contracts)",
    ...hints.map((h) => `- **${h.genre}:** ${h.brief}`),
  ].join("\n");
}

async function readGameplayBundle(root) {
  const dir = path.join(root, "public", "gameplay");
  let files = [];
  try {
    files = await fs.readdir(dir);
  } catch {
    return { text: "", files: [], hasMain: false };
  }
  const jsFiles = files.filter((f) => f.endsWith(".js"));
  const chunks = [];
  for (const name of jsFiles) {
    try {
      const body = await fs.readFile(path.join(dir, name), "utf8");
      chunks.push(`\n// —— ${name} ——\n${body}`);
    } catch {
      /* */
    }
  }
  return {
    text: chunks.join("\n"),
    files: jsFiles,
    hasMain: jsFiles.includes("main.js"),
  };
}

/**
 * @param {{ root: string, tddText?: string }} opts
 * @returns {Promise<{ ok: true, advice: Advice[], genres: string[] }>}
 */
export async function advisePlayability({ root, tddText = "" }) {
  /** @type {Advice[]} */
  const advice = [];
  const genres = inferGenreHints(tddText).map((h) => h.genre);
  const bundle = await readGameplayBundle(root);

  if (!bundle.hasMain) {
    advice.push({
      id: "no-main",
      severity: "warn",
      message: "No public/gameplay/main.js yet — Generate Final may still be writing.",
      chatHint: "Ensure mount/unmount exist in public/gameplay/main.js",
    });
    return { ok: true, advice, genres };
  }

  const src = bundle.text;
  if (!/\bexport\s+async\s+function\s+mount\b/.test(src) && !/\bexport\s+function\s+mount\b/.test(src)) {
    advice.push({
      id: "mount-export",
      severity: "warn",
      message: "Gameplay may be missing export mount(canvas, { hudRoot }).",
      chatHint: "Add export async function mount(canvas, { hudRoot }) in main.js",
    });
  }
  if (!/\bexport\s+async\s+function\s+unmount\b/.test(src) && !/\bexport\s+function\s+unmount\b/.test(src)) {
    advice.push({
      id: "unmount-export",
      severity: "warn",
      message: "Gameplay may be missing export unmount().",
      chatHint: "Add export async function unmount() that disposes the loop",
    });
  }

  const hasRestart =
    /\brestart\b/i.test(src) ||
    /justPressed\([\"']r[\"']\)/.test(src) ||
    /key\([\"']r[\"']\)/.test(src);
  if (!hasRestart) {
    advice.push({
      id: "restart",
      severity: "info",
      message: "No obvious restart binding (often R) — confirm round can restart without reload.",
      chatHint: "Add restart on R that resets race/round state without page reload",
    });
  }

  if (genres.includes("kart")) {
    const lapInc =
      /\.lap\s*\+\+/.test(src) ||
      /\.lap\s*=\s*.*\+\s*1/.test(src) ||
      /lap\s*\+=\s*1/.test(src) ||
      /currentLap\s*\+\+/.test(src);
    const finish =
      /Finished|race:result|race:finished|finished\s*=\s*true|state\s*=\s*[\"']Finished[\"']/i.test(
        src,
      );
    const lapHud =
      /lap/i.test(src) && (/Lap\s*\$\{|Lap\s+\d|setLap|lapBox|lap:/i.test(src) || /position:changed/.test(src));

    if (!lapInc) {
      advice.push({
        id: "kart-lap-inc",
        severity: "warn",
        message:
          "Kart TDD: source may not increment lap on finish — race can feel endless (Sonnet-style miss).",
        chatHint:
          "Fix lap progression: when player completes a lap, increment lap and finish the race at totalLaps",
      });
    }
    if (!finish) {
      advice.push({
        id: "kart-finish",
        severity: "warn",
        message: "Kart TDD: no clear Finished / race:result path found in gameplay sources.",
        chatHint:
          "When lap reaches totalLaps, set race Finished, show result UI, allow R to restart",
      });
    }
    if (!lapHud) {
      advice.push({
        id: "kart-lap-hud",
        severity: "info",
        message: "Kart TDD: confirm HUD shows live lap current/total while racing.",
        chatHint: "Wire HUD lap label to live lap state (not a static 1/3)",
      });
    }
  }

  if (genres.includes("collector")) {
    const score =
      /coin|score|collected|collectCount/i.test(src) &&
      /(\+\+|score\s*\+|collected\s*\+)/.test(src);
    if (!score) {
      advice.push({
        id: "collector-count",
        severity: "warn",
        message: "Collector TDD: collect counter may not increment in code.",
        chatHint: "On pickup, increment count and update HUD; win at target count",
      });
    }
  }

  // Presentation license — soft nudge only
  if (/https?:\/\/.+\.(png|jpg|jpeg|webp|gif)/i.test(src) || /new\s+Image\s*\(/.test(src)) {
    advice.push({
      id: "remote-art",
      severity: "info",
      message:
        "Gameplay references image URLs or Image() — prefer graybox primitive + label for items.",
      chatHint: "Replace item icons with colored primitives or emoji/text labels (no remote images)",
    });
  }

  if (!advice.length) {
    advice.push({
      id: "looks-ok",
      severity: "info",
      message: "Soft check: mount contract and genre heuristics look OK — still play-test the loop.",
    });
  }

  return { ok: true, advice, genres };
}

/**
 * One chat-ready paragraph from advice list.
 * @param {Advice[]} advice
 */
export function formatAdviceForChat(advice = []) {
  const warns = advice.filter((a) => a.severity === "warn");
  const infos = advice.filter((a) => a.severity === "info" && a.id !== "looks-ok");
  if (!warns.length && !infos.length) {
    return "";
  }
  const lines = [];
  if (warns.length) {
    lines.push("Playability hints (does not block play — fix via chat if needed):");
    for (const w of warns) {
      lines.push(`• ${w.message}`);
      if (w.chatHint) lines.push(`  → Try: ${w.chatHint}`);
    }
  } else {
    lines.push("Soft notes:");
    for (const i of infos.slice(0, 3)) lines.push(`• ${i.message}`);
  }
  return lines.join("\n");
}
