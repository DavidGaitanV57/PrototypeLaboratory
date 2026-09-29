/**
 * Visual QA — the agent finally sees its game.
 *
 * 1. capture: headless browser opens /qa.html (autoplay bot + forced high quality), records screenshots at fixed
 *    beats (intro, early play, mid play, late play), console errors, fps and `window.__plab` state/info.
 * 2. judge: a vision-capable provider scores the shots against a presentation rubric and returns concrete,
 *    file-targeted fixes (JSON).
 * 3. The session can feed those fixes (+ screenshots) back into an Agent chat turn ("auto-polish").
 *
 * Advisory only — never blocks delivery. Needs `playwright-core` (optional dependency) and a local
 * Edge/Chrome (or LAB_QA_BROWSER=<path to chrome.exe>). Judge needs an OpenAI-compatible vision provider.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { discoverProviders } from "./providers/catalog.js";
import { summarizeTddForPrompt } from "./prompts/index.js";

export const QA_BEATS = [
  { at: 1500, label: "intro" },
  { at: 7000, label: "early play" },
  { at: 16000, label: "mid play" },
  { at: 28000, label: "late play" },
];

const RUBRIC = [
  ["readability", "Fantasy + player + goal readable at a glance (silhouettes, contrast, focal point)"],
  ["lighting_mood", "Lighting, fog, grade and bloom create the TDD mood (not flat/unlit/washed out)"],
  ["palette_cohesion", "Deliberate palette; accents guide the eye; no muddy or clashing colors"],
  ["world_dressing", "World reads as a place: landmarks, set dressing, depth/backdrop — not an empty plane"],
  ["characters_motion", "Characters/vehicles/NPCs have personality and visible animation/motion"],
  ["hud_clarity", "HUD is readable, themed, shows live game state, does not cover the action"],
  ["feedback_juice", "Visible feedback: particles, flashes, trails, float text, camera energy"],
  ["tdd_fidelity", "Matches what the TDD describes (fiction, art direction, core loop evidence)"],
];

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

async function loadPlaywright() {
  for (const name of ["playwright-core", "playwright"]) {
    try {
      const mod = await import(name);
      return mod.chromium || mod.default?.chromium;
    } catch {
      /* try next */
    }
  }
  return null;
}

async function launchBrowser(chromium, env = process.env) {
  const args = ["--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=default", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"];
  const headless = String(env.LAB_QA_HEADFUL || "").toLowerCase() !== "on";
  const attempts = [];
  if (env.LAB_QA_BROWSER) attempts.push({ executablePath: env.LAB_QA_BROWSER });
  attempts.push({ channel: "msedge" }, { channel: "chrome" }, {});
  let lastErr = null;
  for (const a of attempts) {
    try {
      return await chromium.launch({ headless, args, ...a });
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(
    `No browser for visual QA (${String(lastErr?.message || lastErr).split("\n")[0]}). Install Edge/Chrome or set LAB_QA_BROWSER.`,
  );
}

/**
 * Capture screenshots of the current public/gameplay build.
 * @returns {Promise<{ ok: boolean, reason?: string, dir?: string, shots?: object[], errors?: string[], fps?: number, stateTrail?: string[] }>}
 */
export async function captureGameplay({ root, baseUrl, beats = QA_BEATS, viewport = { width: 1280, height: 720 }, onEvent } = {}) {
  const chromium = await loadPlaywright();
  if (!chromium) return { ok: false, reason: "Visual QA needs `playwright-core` — run `npm install` in the lab." };
  const stamp = nowStamp();
  const dir = path.join(root, "sessions", "qa", stamp);
  await fs.mkdir(dir, { recursive: true });
  let browser;
  const errors = [];
  const shots = [];
  try {
    browser = await launchBrowser(chromium);
    const page = await browser.newPage({ viewport });
    page.on("console", (m) => {
      // Resource failures are reported with their URL by the response hook below.
      if (m.type() === "error" && !/^Failed to load resource/i.test(m.text())) errors.push(m.text().slice(0, 300));
    });
    page.on("response", (r) => {
      const u = r.url();
      if (r.status() >= 400 && !/favicon/i.test(u)) errors.push(`HTTP ${r.status()} ${u.replace(baseUrl, "")}`);
    });
    page.on("pageerror", (e) => errors.push(`pageerror: ${String(e.message).slice(0, 300)}`));
    onEvent?.({ type: "status", message: "Visual QA · opening the playable headless" });
    await page.goto(`${baseUrl}/qa.html?quality=high&auto=1&t=${Date.now()}`, { waitUntil: "load", timeout: 30_000 });
    await page.waitForFunction(() => window.__qaMounted || window.__qaError, null, { timeout: 30_000 });
    const mountErr = await page.evaluate(() => window.__qaError || null);
    if (mountErr) {
      return { ok: false, reason: `Playable failed to mount: ${mountErr}`, dir, errors };
    }
    // Games exposing window.__plab drive themselves via __PLAB_AUTOPLAY. Others get generic input:
    // click in, hold forward, hop, sweep the mouse.
    const hasHooks = await page.evaluate(() => !!window.__plab);
    const generic = !hasHooks;
    const started = Date.now();
    let beat = 0;
    let hopT = 0;
    if (generic) {
      await page.mouse.click(viewport.width / 2, viewport.height / 2);
      await page.keyboard.down("w");
    }
    while (beat < beats.length) {
      const elapsed = Date.now() - started;
      if (elapsed >= beats[beat].at) {
        const file = path.join(dir, `shot-${beat + 1}.jpg`);
        await page.screenshot({ path: file, type: "jpeg", quality: 82 });
        const meta = await page.evaluate(() => {
          let info = null;
          try {
            info = window.__plab?.info ?? null;
          } catch {
            info = null;
          }
          return { state: window.__plab?.state ?? null, info, fps: window.__qaFps ?? null };
        });
        shots.push({ ...beats[beat], file, rel: path.relative(root, file).replace(/\\/g, "/"), ...meta });
        onEvent?.({ type: "status", message: `Visual QA · captured ${beats[beat].label}` });
        beat += 1;
        continue;
      }
      if (generic && elapsed - hopT > 1300) {
        hopT = elapsed;
        await page.keyboard.press(" ");
        await page.mouse.move(viewport.width * (0.3 + Math.random() * 0.4), viewport.height * (0.35 + Math.random() * 0.3), { steps: 6 });
      }
      await page.waitForTimeout(120);
    }
    if (generic) await page.keyboard.up("w");
    const fps = await page.evaluate(() => window.__qaFps ?? null);
    return {
      ok: true,
      dir,
      shots,
      errors: [...new Set(errors)].slice(0, 12),
      fps: fps ? Math.round(fps) : null,
      stateTrail: shots.map((s) => s.state),
    };
  } catch (err) {
    return { ok: false, reason: String(err.message || err).split("\n")[0], dir, shots, errors };
  } finally {
    await browser?.close().catch(() => {});
  }
}

/** Pick a vision-capable OpenAI-compatible provider. Cursor SDK cannot take images. */
export function pickVisionProvider(env = process.env) {
  const list = discoverProviders(env).filter((p) => p.kind === "llm");
  if (!list.length) return null;
  const wanted = String(env.LAB_QA_PROVIDER || "").toLowerCase();
  const order = wanted ? [wanted] : ["anthropic", "openai", "openrouter", "llm", "minimax", "kimi", "glm"];
  for (const id of order) {
    const hit = list.find((p) => p.id === id);
    if (hit) return { ...hit, model: env.LAB_QA_MODEL || hit.model };
  }
  return { ...list[0], model: env.LAB_QA_MODEL || list[0].model };
}

function extractJson(text) {
  const s = String(text || "");
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1] : s;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function readIfExists(p, max = 3000) {
  try {
    return (await fs.readFile(p, "utf8")).slice(0, max);
  } catch {
    return "";
  }
}

/**
 * Score the capture with a vision model.
 */
export async function judgeCapture({ root, capture, tddText = "", env = process.env, signal } = {}) {
  const provider = pickVisionProvider(env);
  if (!provider) return { judged: false, reason: "No OpenAI-compatible vision provider configured (Cursor cannot view images). Set OPENAI_API_KEY / ANTHROPIC_API_KEY / OPENROUTER_API_KEY or LAB_QA_PROVIDER." };
  const look = await readIfExists(path.join(root, "public", "gameplay", "look.js"), 2500);
  const tdd = summarizeTddForPrompt(tddText, { maxChars: 3500 });
  const rubric = RUBRIC.map(([k, d]) => `- ${k}: ${d}`).join("\n");
  const shotsMeta = capture.shots
    .map((s, i) => `Shot ${i + 1} (${s.label}, t=${(s.at / 1000).toFixed(1)}s) state=${s.state ?? "?"} info=${JSON.stringify(s.info ?? {})}`)
    .join("\n");
  const text = [
    "You are a senior art director and game-feel reviewer. These screenshots come from a browser vertical-slice prototype built from primitive geometry with a stylized presentation layer (LookKit tone mapping/bloom/grade, WorldKit set dressing, FxKit particles, HudKit HUD).",
    "Judge ONLY what is visible. Be demanding: 10 = would impress on a store page; 5 = competent but plain; 2 = debug sandbox.",
    "",
    "## Rubric (0-10 each)",
    rubric,
    "",
    "## TDD digest",
    tdd,
    "",
    look ? `## Current look.js (Look Bible)\n\`\`\`js\n${look}\n\`\`\`` : "## look.js missing",
    "",
    "## Capture",
    shotsMeta,
    `Console errors: ${capture.errors?.length ? capture.errors.join(" | ") : "none"}`,
    `FPS during capture: ${capture.fps ?? "unknown"} (headless; low fps is not the game's fault unless extreme)`,
    "",
    "## Answer with ONLY this JSON",
    '{"scores":{"readability":0,"lighting_mood":0,"palette_cohesion":0,"world_dressing":0,"characters_motion":0,"hud_clarity":0,"feedback_juice":0,"tdd_fidelity":0},"overall":0,"verdict":"one sentence","strengths":["…"],"fixes":[{"priority":1,"file":"public/gameplay/look.js","change":"concrete change using the runtime kits (LookKit preset/overrides, WorldKit scatter, FxKit, makeHero…)","why":"what it fixes in the shots"}]}',
    "Max 6 fixes, highest impact first, each doable in one edit. No generic advice.",
  ].join("\n");

  const content = [{ type: "text", text }];
  for (const s of capture.shots) {
    const b64 = (await fs.readFile(s.file)).toString("base64");
    content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } });
  }
  const url = `${String(provider.baseUrl).replace(/\/$/, "")}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}`, ...(provider.id === "anthropic" ? { "x-api-key": provider.apiKey, "anthropic-version": "2023-06-01" } : {}) },
    body: JSON.stringify({ model: provider.model, temperature: 0.2, max_tokens: 1600, messages: [{ role: "user", content }] }),
  });
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 300);
    return { judged: false, reason: `Vision judge HTTP ${res.status}: ${body}`, provider: provider.id, model: provider.model };
  }
  const data = await res.json();
  const reply = data?.choices?.[0]?.message?.content;
  const raw = Array.isArray(reply) ? reply.map((p) => p.text || "").join("\n") : String(reply || "");
  const parsed = extractJson(raw);
  if (!parsed) return { judged: false, reason: "Vision judge returned no JSON", raw: raw.slice(0, 600), provider: provider.id, model: provider.model };
  const scores = parsed.scores || {};
  const vals = Object.values(scores).map(Number).filter(Number.isFinite);
  const overall = Number.isFinite(Number(parsed.overall)) ? Number(parsed.overall) : vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  return {
    judged: true,
    provider: provider.id,
    model: provider.model,
    scores,
    overall: Math.round(overall * 10) / 10,
    verdict: String(parsed.verdict || ""),
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 4) : [],
    fixes: (Array.isArray(parsed.fixes) ? parsed.fixes : []).slice(0, 6),
  };
}

/** Technical checks that need no model. */
function technicalFindings(capture) {
  const out = [];
  if (capture.errors?.length) out.push(`Console errors (${capture.errors.length}): ${capture.errors[0]}`);
  if (capture.fps != null && capture.fps < 12) {
    out.push(`Capture ran at ~${capture.fps} fps (software rendering?) — game time advanced slowly, so state/progress checks were skipped. Set LAB_QA_HEADFUL=on or LAB_QA_BROWSER to a GPU browser.`);
    return out;
  }
  const states = (capture.stateTrail || []).filter(Boolean);
  if (!states.length) out.push("`window.__plab` not exposed — QA cannot see game state (add { state, info, restart }).");
  else if (new Set(states).size === 1) out.push(`Game state never changed during capture (${states[0]}) — intro may never end or autoplay missing.`);
  const infos = (capture.shots || []).map((s) => JSON.stringify(s.info ?? null));
  if (infos.length > 1 && new Set(infos).size === 1 && infos[0] !== "null") out.push("HUD/game info identical across shots — autoplay may not move the player.");
  return out;
}

export function formatQaDigest(report) {
  const lines = ["Visual QA"];
  if (!report.capture?.ok) {
    lines.push(`- Capture failed: ${report.capture?.reason || "unknown"}`);
    return lines.join("\n");
  }
  if (report.judge?.judged) {
    lines[0] = `Visual QA · ${report.judge.overall}/10 — ${report.judge.verdict}`;
    const sc = Object.entries(report.judge.scores || {})
      .map(([k, v]) => `${k.replace(/_/g, " ")} ${v}`)
      .join(" · ");
    if (sc) lines.push(sc);
    for (const f of report.judge.fixes || []) lines.push(`${f.priority ?? "•"}. ${f.file ? `[${f.file}] ` : ""}${f.change}${f.why ? ` — ${f.why}` : ""}`);
  } else {
    lines.push(`- Not scored: ${report.judge?.reason || "no vision provider"}`);
  }
  for (const t of report.technical || []) lines.push(`- ${t}`);
  return lines.join("\n");
}

/** Agent message for the auto-polish pass. */
export function buildQaFixMessage(report) {
  const fixes = (report.judge?.fixes || []).map((f, i) => `${i + 1}. ${f.file ? `${f.file}: ` : ""}${f.change}${f.why ? ` (why: ${f.why})` : ""}`);
  return [
    `Visual QA scored the current build ${report.judge?.overall ?? "?"}/10 (${report.judge?.verdict || ""}).`,
    "Apply these presentation fixes. Keep the loop, controls, TDD numbers and window.__plab/__PLAB_AUTOPLAY hooks working; do not rewrite unrelated systems.",
    ...fixes,
    ...(report.technical || []).map((t) => `- Also: ${t}`),
    "Screenshots from the capture are attached (intro → late play).",
  ].join("\n");
}

/**
 * Full pass: capture → technical checks → judge. Writes report.json next to the shots.
 */
export async function runVisualQa({ root, baseUrl, tddText = "", onEvent, signal } = {}) {
  const capture = await captureGameplay({ root, baseUrl, onEvent });
  const report = { at: new Date().toISOString(), capture, technical: [], judge: null };
  if (capture.ok) {
    report.technical = technicalFindings(capture);
    onEvent?.({ type: "status", message: "Visual QA · scoring screenshots" });
    try {
      report.judge = await judgeCapture({ root, capture, tddText, signal });
    } catch (err) {
      report.judge = { judged: false, reason: String(err.message || err) };
    }
  }
  report.digest = formatQaDigest(report);
  report.images = (capture.shots || []).map((s) => ({ url: `/api/qa-shots/${s.rel.replace(/^sessions\/qa\//, "")}`, label: s.label }));
  if (capture.dir) {
    await fs.writeFile(path.join(capture.dir, "report.json"), JSON.stringify(report, null, 2), "utf8").catch(() => {});
  }
  return report;
}

/** Screenshots as chat image attachments (first + last beat). */
export async function qaImagesForChat(report) {
  const shots = report.capture?.shots || [];
  const pick = shots.length > 2 ? [shots[1], shots[shots.length - 1]] : shots;
  const out = [];
  for (const s of pick) {
    try {
      out.push({ mimeType: "image/jpeg", data: (await fs.readFile(s.file)).toString("base64"), name: path.basename(s.file), relPath: s.rel });
    } catch {
      /* skip */
    }
  }
  return out;
}
