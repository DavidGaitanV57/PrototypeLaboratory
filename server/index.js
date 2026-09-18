import "dotenv/config";
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { listTdds, readTdd, importTddUpload, importTddText } from "./tdd/parser.js";
import { createSession } from "./agent/session.js";
import { exportBuild } from "./export.js";
import {
  providerStatus,
  initProviderCatalog,
  setActiveProvider,
  getActiveProvider,
} from "./agent/providers/catalog.js";
import { pingProviderModel, pingProviderModels } from "./agent/providers/ping.js";
import { initBenchmarkStore, getBenchmarkState, clearBenchmark, recordBenchmark } from "./agent/benchmarkStore.js";
import { gameplayFingerprint } from "./agent/gameplayEvidence.js";
import { assertSafeSlug, isInsideDir } from "./security/paths.js";
import { purgeChatAttachments, pruneSessionAttachDir } from "./chatAttachCleanup.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const TDDS = path.join(ROOT, "docs", "tdds");
const SESSIONS = path.join(ROOT, "sessions");
const GAMEPLAY = path.join(PUBLIC, "gameplay");
const PORT = Number(process.env.PORT || 3850);
const HOST = process.env.HOST || "127.0.0.1";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const name = String(file.originalname || "").toLowerCase();
    if (!name.endsWith(".md") && file.mimetype !== "text/markdown" && file.mimetype !== "text/plain") {
      cb(new Error("Only Markdown (.md) uploads are allowed"));
      return;
    }
    cb(null, true);
  },
});

const uploadChatImages = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 3 },
  fileFilter(_req, file, cb) {
    if (!/^image\/(png|jpeg|jpg|webp|gif)$/i.test(String(file.mimetype || ""))) {
      cb(new Error("Only PNG/JPEG/WebP/GIF images are allowed"));
      return;
    }
    cb(null, true);
  },
});
const sessions = new Map();
const reloadClients = new Set();

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "8mb" }));

// Who may put this lab inside a frame.
//
// It used to be nobody but itself, which is the right default for a tool you open directly. But
// Forge opens it as a panel of its own workspace, and `X-Frame-Options` cannot name a list of
// origins — so where a list is configured, the CSP form replaces it. Unset, nothing changes.
//
// Space-separated origins, e.g. FRAME_ANCESTORS="'self' http://localhost:3000 https://forge.example"
const FRAME_ANCESTORS = String(process.env.FRAME_ANCESTORS || "").trim();

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (FRAME_ANCESTORS) {
    res.setHeader("Content-Security-Policy", `frame-ancestors ${FRAME_ANCESTORS}`);
  } else {
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
  }
  res.setHeader("Referrer-Policy", "no-referrer");
  // `same-origin` refuses to be loaded by another site at all, which includes the frame Forge
  // draws. Where framing is allowed on purpose, this has to loosen with it.
  res.setHeader("Cross-Origin-Resource-Policy", FRAME_ANCESTORS ? "cross-origin" : "same-origin");
  next();
});

function parseSlug(raw) {
  try {
    return assertSafeSlug(raw);
  } catch {
    return null;
  }
}

/** @param {unknown} raw */
function normalizeChatImages(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw.slice(0, 3)) {
    if (!item || typeof item !== "object") continue;
    const mimeType = String(item.mimeType || item.mime || "").toLowerCase();
    if (!/^image\/(png|jpeg|jpg|webp|gif)$/.test(mimeType)) continue;
    let data = String(item.data || item.dataBase64 || "").replace(/\s+/g, "");
    const dataUrl = String(item.dataUrl || "");
    if (!data && dataUrl.startsWith("data:")) {
      const i = dataUrl.indexOf(",");
      if (i > 0) data = dataUrl.slice(i + 1);
    }
    // Keep inline payloads small — large shots must use /chat-images upload.
    if (!data || data.length > 900_000) continue;
    out.push({
      mimeType: mimeType === "image/jpg" ? "image/jpeg" : mimeType,
      data,
      name: String(item.name || `shot-${out.length + 1}`).slice(0, 80),
      relPath: item.relPath ? String(item.relPath).replace(/\\/g, "/") : "",
    });
  }
  return out;
}

/**
 * Load screenshots previously stored under sessions/chat-attach/<sessionId>/.
 * @param {string} sessionId
 * @param {unknown} ids
 */
async function loadChatImagesById(sessionId, ids) {
  if (!Array.isArray(ids) || !ids.length) return [];
  const safeSession = String(sessionId || "").replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeSession) return [];
  const dir = path.join(SESSIONS, "chat-attach", safeSession);
  const out = [];
  for (const rawId of ids.slice(0, 3)) {
    const id = String(rawId || "").replace(/[^a-zA-Z0-9_-]/g, "");
    if (!id) continue;
    for (const ext of ["jpg", "jpeg", "png", "webp", "gif"]) {
      const abs = path.join(dir, `${id}.${ext}`);
      try {
        const buf = await fs.readFile(abs);
        const mimeType =
          ext === "png"
            ? "image/png"
            : ext === "webp"
              ? "image/webp"
              : ext === "gif"
                ? "image/gif"
                : "image/jpeg";
        out.push({
          mimeType,
          data: buf.toString("base64"),
          name: `${id}.${ext}`,
          relPath: `sessions/chat-attach/${safeSession}/${id}.${ext}`,
        });
        break;
      } catch {
        /* try next ext */
      }
    }
  }
  return out;
}

// Vendor three from node_modules
app.use(
  "/vendor/three",
  express.static(path.join(ROOT, "node_modules", "three"), {
    setHeaders(res, filePath) {
      if (filePath.endsWith(".js")) res.setHeader("Content-Type", "application/javascript");
    },
  }),
);

// Cache-bust gameplay
app.use("/gameplay", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

app.use(express.static(PUBLIC));

function sseInit(res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  const send = (obj) => {
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
  };
  return send;
}

function broadcastReload(reason = "files") {
  const payload = `data: ${JSON.stringify({ type: "reload", reason })}\n\n`;
  for (const res of reloadClients) {
    try {
      res.write(payload);
    } catch {
      /* */
    }
  }
}

async function clearGameplay() {
  await fs.rm(GAMEPLAY, { recursive: true, force: true });
  await fs.mkdir(GAMEPLAY, { recursive: true });
  await fs.writeFile(path.join(GAMEPLAY, ".gitkeep"), "", "utf8");
}

// ── One workspace per project ────────────────────────────────────────────────
//
// The generated game always lives in public/gameplay: the agent's write policy allows that path
// and nothing else, the prompts name it, the advisor scans it and the player imports from it. So
// isolating projects by moving the game somewhere else would mean touching all of those, prompts
// included.
//
// Instead the folder stays where everything expects it, and the lab parks the current one aside
// when a different project opens. Opening project B saves A's build under workspaces/A and brings
// B's back — nobody sees somebody else's prototype, and no prompt changes.
//
// This is sequential isolation: one project at a time, which is how the lab is used. Two people
// working at once still share the machine.
const WORKSPACES = path.join(ROOT, "workspaces");
const ACTIVO = path.join(WORKSPACES, ".active");

async function slugActivo() {
  try { return (await fs.readFile(ACTIVO, "utf8")).trim() || null; } catch { return null; }
}

async function activarWorkspace(slug) {
  const safe = assertSafeSlug(slug);
  const actual = await slugActivo();
  if (actual === safe) return { slug: safe, changed: false, previous: actual };

  await fs.mkdir(WORKSPACES, { recursive: true });

  // Park what is on the bench, if it belongs to someone.
  if (actual) {
    const destino = path.join(WORKSPACES, actual);
    await fs.rm(destino, { recursive: true, force: true });
    await fs.rename(GAMEPLAY, destino).catch(() => {});
  } else {
    await fs.rm(GAMEPLAY, { recursive: true, force: true });
  }

  // Bring this project's bench back, or start it empty.
  const guardado = path.join(WORKSPACES, safe);
  const existe = await fs.access(guardado).then(() => true).catch(() => false);
  if (existe) await fs.rename(guardado, GAMEPLAY);
  else await clearGameplay();
  await fs.mkdir(GAMEPLAY, { recursive: true });

  await fs.writeFile(ACTIVO, safe, "utf8");
  return { slug: safe, changed: true, previous: actual };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "prototype-laboratory", port: PORT });
});

app.get("/api/tdds", async (_req, res) => {
  try {
    res.json({ tdds: await listTdds(TDDS) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/tdds/:slug", async (req, res) => {
  const slug = parseSlug(req.params.slug);
  if (!slug) return res.status(400).json({ error: "Invalid slug" });
  try {
    const tdd = await readTdd(TDDS, slug);
    res.json({
      slug: tdd.slug,
      projectName: tdd.projectName,
      mechanics: tdd.mechanics.map((m) => ({ id: m.id, title: m.title, type: m.type })),
    });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Push a TDD in from somewhere else, by URL or by text, under a slug the caller owns.
//
// This is how Forge hands the lab the document of a project: the person never picks a TDD, they
// press a button in Forge and land here with that one already loaded. The slug is the caller's so
// that opening the same project twice refreshes the document instead of leaving a second copy.
// The same ceiling the JSON body parser already imposes, so both ways in behave alike. A TDD runs
// to some hundred thousand characters; this leaves room to spare.
const TOPE_TDD = 2 * 1024 * 1024;

app.post("/api/tdds/push", async (req, res) => {
  try {
    const slug = parseSlug(req.body?.slug);
    if (!slug) return res.status(400).json({ error: "slug required" });

    let text = typeof req.body?.text === "string" ? req.body.text : null;
    if (!text) {
      const url = String(req.body?.url || "");
      // Only https, and only a URL: this fetches from the server, so a caller must not be able to
      // aim it at something on this machine's network.
      if (!/^https:\/\//i.test(url)) return res.status(400).json({ error: "text or https url required" });
      const upstream = await fetch(url, { redirect: "follow" });
      if (!upstream.ok) return res.status(400).json({ error: `Could not fetch the TDD: HTTP ${upstream.status}` });
      const size = Number(upstream.headers.get("content-length") || 0);
      if (size > TOPE_TDD) return res.status(400).json({ error: `TDD too large: ${size} bytes` });
      text = await upstream.text();
      if (text.length > TOPE_TDD) return res.status(400).json({ error: "TDD too large" });
    }

    const tdd = await importTddText(TDDS, { slug, text });
    res.json({
      slug: tdd.slug,
      projectName: tdd.projectName,
      mechanics: tdd.mechanics.map((m) => ({ id: m.id, title: m.title, type: m.type })),
      // What the lab could actually read out of it. A TDD with no mechanics parses fine and then
      // has nothing to build from, so the caller is told rather than left to find out on an empty
      // screen.
      usable: tdd.mechanics.length > 0,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/tdds/import", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "file required" });
    const tdd = await importTddUpload(TDDS, req.file.originalname, req.file.buffer.toString("utf8"));
    res.json({
      slug: tdd.slug,
      projectName: tdd.projectName,
      mechanics: tdd.mechanics.map((m) => ({ id: m.id, title: m.title })),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/agent/providers", async (_req, res) => {
  await initProviderCatalog(ROOT);
  const status = providerStatus();
  res.json(status);
});

app.post("/api/agent/provider", async (req, res) => {
  try {
    await initProviderCatalog(ROOT);
    const id = req.body?.id;
    const model = req.body?.model;
    const slot = await setActiveProvider(id, model);
    res.json({
      active: slot.id,
      model: slot.model,
      ...providerStatus(),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/agent/ping", async (req, res) => {
  try {
    await initProviderCatalog(ROOT);
    const id = req.body?.id;
    const model = req.body?.model;
    const result = await pingProviderModel({ id, model, root: ROOT });
    res.json(result);
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

app.post("/api/agent/ping-models", async (req, res) => {
  try {
    await initProviderCatalog(ROOT);
    const id = req.body?.id;
    const models = Array.isArray(req.body?.models) ? req.body.models : undefined;
    const result = await pingProviderModels({ id, models, root: ROOT });
    res.json(result);
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

app.get("/api/events", (req, res) => {
  sseInit(res);
  reloadClients.add(res);
  req.on("close", () => reloadClients.delete(res));
});

app.post("/api/sessions/resume", async (req, res) => {
  try {
    const slug = parseSlug(req.body?.slug);
    if (!slug) return res.status(400).json({ error: "slug required" });
    await fs.access(path.join(GAMEPLAY, "main.js"));
    const sessionId = randomUUID();
    const session = await createSession({ root: ROOT, tddsRoot: TDDS, slug });
    sessions.set(sessionId, session);
    res.json({ sessionId, slug, entry: "/gameplay/main.js" });
  } catch {
    res.status(404).json({ error: "No playable build on disk — Generate Final first" });
  }
});

app.post("/api/sessions/generate-final", async (req, res) => {
  const slug = parseSlug(req.body?.slug);
  if (!slug) return res.status(400).json({ error: "slug required" });

  const send = sseInit(res);
  const sessionId = randomUUID();
  try {
    await fs.mkdir(SESSIONS, { recursive: true });
    const session = await createSession({ root: ROOT, tddsRoot: TDDS, slug });
    sessions.set(sessionId, session);
    send({ type: "session", sessionId, slug });
    send({ type: "status", message: "Generate Final started" });

    await session.generateFinal({
      onEvent: (ev) => send(ev),
    });

    try {
      await fs.access(path.join(GAMEPLAY, "main.js"));
    } catch {
      send({
        type: "error",
        message:
          "Generate finished but public/gameplay/main.js is missing (agent hit turn limit or stopped early). Run Generate Final again, or Chat: \"write main.js mount/unmount\".",
      });
      return;
    }

    send({ type: "ready", entry: "/gameplay/main.js" });
    broadcastReload("generate");
    send({ type: "done", sessionId });
  } catch (err) {
    const message = err.message || String(err);
    try {
      const state = getBenchmarkState();
      if (state?.last && state.last.status === "error" && !state.last.errorMessage) {
        await recordBenchmark(ROOT, {
          type: "benchmark",
          ...state.last,
          errorMessage: message.slice(0, 800),
        });
      }
    } catch {
      /* */
    }
    send({ type: "error", message });
  } finally {
    res.end();
  }
});

app.post("/api/sessions/:id/chat", async (req, res) => {
  const session = sessions.get(req.params.id);
  const send = sseInit(res);
  if (!session) {
    send({ type: "error", message: "Unknown session — Generate Final first" });
    return res.end();
  }
  try {
    const message = String(req.body?.message || "").trim();
    if (!message) throw new Error("message required");
    if (message.length > 20000) throw new Error("message too long");
    const rawMode =
      req.body?.mode === "ask" ? "ask" : req.body?.mode === "plan" ? "plan" : "agent";
    // Plan mode UI is disabled for now — coerce legacy clients to Ask.
    const mode = rawMode === "plan" ? "ask" : rawMode;
    if (rawMode === "plan") {
      send({ type: "status", message: "Plan mode is disabled — running as Ask (read-only)." });
    }
    const uploaded = await loadChatImagesById(req.params.id, req.body?.imageIds);
    const inline = normalizeChatImages(req.body?.images);
    const images = [...uploaded, ...inline].slice(0, 3);
    const outcome = await session.chat(message, {
      mode,
      images,
      onEvent: (ev) => send(ev),
    });
    if (mode === "agent" && !outcome?.resumable) broadcastReload("chat");
    send({
      type: "done",
      mode: outcome?.mode || mode,
      resumable: !!outcome?.resumable,
      gameplayChanged: !!outcome?.gameplayChanged,
      ...(outcome?.plan ? { plan: outcome.plan } : {}),
      ...(session.getCheckpointInfo?.() || {}),
    });
  } catch (err) {
    send({ type: "error", message: err.message || String(err) });
  } finally {
    res.end();
  }
});

app.post("/api/sessions/:id/chat-images", (req, res) => {
  uploadChatImages.array("images", 3)(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || "Upload failed" });
    const session = sessions.get(req.params.id);
    if (!session) return res.status(404).json({ error: "Unknown session" });
    try {
      const safeSession = String(req.params.id || "").replace(/[^a-zA-Z0-9_-]/g, "");
      const dir = path.join(SESSIONS, "chat-attach", safeSession);
      await fs.mkdir(dir, { recursive: true });
      const out = [];
      for (const file of req.files || []) {
        const id = randomUUID().replace(/-/g, "").slice(0, 16);
        const ext = /png/i.test(file.mimetype)
          ? "png"
          : /webp/i.test(file.mimetype)
            ? "webp"
            : /gif/i.test(file.mimetype)
              ? "gif"
              : "jpg";
        const filename = `${id}.${ext}`;
        await fs.writeFile(path.join(dir, filename), file.buffer);
        out.push({
          id,
          name: file.originalname || filename,
          mimeType: file.mimetype,
          relPath: `sessions/chat-attach/${safeSession}/${filename}`,
        });
      }
      await pruneSessionAttachDir(dir);
      res.json({ images: out });
    } catch (e) {
      res.status(500).json({ error: e.message || String(e) });
    }
  });
});

app.post("/api/sessions/:id/continue", async (req, res) => {
  const session = sessions.get(req.params.id);
  const send = sseInit(res);
  if (!session) {
    send({ type: "error", message: "Unknown session" });
    return res.end();
  }
  try {
    const outcome = await session.continueFromCheckpoint({
      onEvent: (ev) => send(ev),
    });
    const mode = outcome?.mode || "agent";
    if (mode === "agent" && !outcome?.resumable) broadcastReload("chat");
    send({
      type: "done",
      mode,
      continued: true,
      resumable: !!outcome?.resumable,
      gameplayChanged: !!outcome?.gameplayChanged,
      ...(outcome?.plan ? { plan: outcome.plan } : {}),
      ...(session.getCheckpointInfo?.() || {}),
    });
  } catch (err) {
    send({ type: "error", message: err.message || String(err) });
  } finally {
    res.end();
  }
});

app.get("/api/sessions/:id/checkpoint", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ resumable: false, error: "Unknown session" });
  res.json(session.getCheckpointInfo?.() || { resumable: false });
});

app.post("/api/sessions/:id/cancel", async (req, res) => {
  const session = sessions.get(req.params.id);
  const info = session?.cancel?.() || { resumable: false };
  // Give the provider a tick to seal the snapshot after abort
  await new Promise((r) => setTimeout(r, 80));
  const latest = session?.getCheckpointInfo?.() || info;
  res.json({ ok: true, ...latest });
});

app.post("/api/sessions/:id/sync-tdd/preview", async (req, res) => {
  const session = sessions.get(req.params.id);
  const send = sseInit(res);
  if (!session) {
    send({ type: "error", message: "Unknown session" });
    return res.end();
  }
  try {
    const summary = String(req.body?.summary || "").trim().slice(0, 8000);
    const chatDigest = String(req.body?.chatDigest || "").trim().slice(0, 20000);
    const proposal = await session.previewSyncTdd(
      { summary, chatDigest },
      { onEvent: (ev) => send(ev) },
    );
    send({ type: "sync-proposal", items: proposal?.items || [] });
    send({ type: "done", preview: true, cancelled: !!proposal?.cancelled });
  } catch (err) {
    send({ type: "error", message: err.message || String(err) });
  } finally {
    res.end();
  }
});

app.post("/api/sessions/:id/sync-tdd", async (req, res) => {
  const session = sessions.get(req.params.id);
  const send = sseInit(res);
  if (!session) {
    send({ type: "error", message: "Unknown session" });
    return res.end();
  }
  try {
    const summary = String(req.body?.summary || "").trim().slice(0, 8000);
    const chatDigest = String(req.body?.chatDigest || "").trim().slice(0, 20000);
    const selectedItems = Array.isArray(req.body?.selectedItems)
      ? req.body.selectedItems.slice(0, 40).map((it) => ({
          id: String(it?.id || "").slice(0, 80),
          kind: String(it?.kind || "").slice(0, 32),
          title: String(it?.title || "").slice(0, 160),
          section: String(it?.section || "").slice(0, 80),
          detail: String(it?.detail || "").slice(0, 600),
        }))
      : [];
    if (!selectedItems.length) {
      throw new Error("Select at least one TDD change to apply");
    }
    const result = await session.syncTdd(
      { summary, chatDigest, selectedItems },
      { onEvent: (ev) => send(ev) },
    );
    send({ type: "synced", ...result });
    send({ type: "done" });
  } catch (err) {
    send({ type: "error", message: err.message || String(err) });
  } finally {
    res.end();
  }
});

// Switch the bench to a project. Called by whoever opens the lab for that project — Forge does it
// right before pushing its TDD — so the build on screen always belongs to the project you opened.
app.post("/api/workspace/activate", async (req, res) => {
  try {
    const r = await activarWorkspace(req.body?.slug);
    if (r.changed) {
      for (const s of sessions.values()) s.cancel?.();
      sessions.clear();
      broadcastReload("workspace");
    }
    const ready = await fs.access(path.join(GAMEPLAY, "main.js")).then(() => true).catch(() => false);
    res.json({ ok: true, ...r, ready });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/workspace/clean", async (_req, res) => {
  try {
    for (const s of sessions.values()) s.cancel?.();
    sessions.clear();
    await clearGameplay();
    await fs.rm(SESSIONS, { recursive: true, force: true });
    await fs.mkdir(SESSIONS, { recursive: true });
    broadcastReload("clean");
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/gameplay/status", async (_req, res) => {
  // `project` says whose build is on the bench. Without it a caller cannot tell a missing build
  // from somebody else's, which is the confusion this endpoint used to feed.
  const project = await slugActivo();
  try {
    const fp = await gameplayFingerprint(ROOT);
    res.json({
      ready: fp.ready,
      entry: "/gameplay/main.js",
      fingerprint: fp.fingerprint,
      files: fp.files,
      project,
    });
  } catch {
    res.json({ ready: false, fingerprint: "", files: [], project });
  }
});

app.get("/api/benchmark", (_req, res) => {
  const state = getBenchmarkState();
  res.json(state);
});

app.delete("/api/benchmark", async (_req, res) => {
  try {
    const state = await clearBenchmark(ROOT);
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ── Handing a finished build to whoever asked for it ────────────────────────
//
// `export` writes a playable build to this machine's `exports/`, which is where it stops being
// useful: this disk does not survive a redeploy, and nobody else can read it. These two let the
// tool that opened the lab collect the build and put it somewhere it can be played from.
//
// It is a file list plus one file at a time, and not an archive, on purpose: zipping would mean a
// dependency this project does not have, and the other side has to walk the files anyway — a zip
// in object storage is not a playable link.
const EXPORTS = path.join(ROOT, "exports");

async function listarArchivos(dir, base = dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    // Los que empiezan por punto quedan fuera. `.gitkeep` sólo existe para que git conserve una
    // carpeta vacía, no aporta nada a una build publicada — y `sendFile` los rechaza de todos
    // modos, así que listarlos sería prometer un archivo que después da 404.
    if (entry.name.startsWith(".")) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listarArchivos(abs, base)));
    else if (entry.isFile()) {
      const { size } = await fs.stat(abs);
      out.push({ path: path.relative(base, abs).split(path.sep).join("/"), bytes: size });
    }
  }
  return out;
}

app.post("/api/tdds/:slug/publish", async (req, res) => {
  try {
    const slug = parseSlug(req.params.slug);
    if (!slug) return res.status(400).json({ error: "Invalid slug" });
    const result = await exportBuild({ root: ROOT, publicRoot: PUBLIC, tddsRoot: TDDS, slug });
    if (!result.ok) return res.status(400).json({ error: result.reason });

    const nombre = path.basename(result.destination);
    const files = await listarArchivos(result.destination);
    res.json({
      export: nombre,
      files,
      bytes: files.reduce((t, f) => t + f.bytes, 0),
      entry: "index.html",
    });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.get("/api/exports/:name/*", async (req, res) => {
  const nombre = parseSlug(req.params.name);
  if (!nombre) return res.status(400).json({ error: "Invalid export" });
  const rel = req.params[0] || "";
  const abs = path.resolve(EXPORTS, nombre, rel);
  // Never serve outside the exports folder, whatever the path says.
  if (!isInsideDir(path.join(EXPORTS, nombre), abs)) return res.status(400).json({ error: "Invalid path" });
  try {
    await fs.access(abs);
  } catch {
    return res.status(404).json({ error: "Not found" });
  }
  res.sendFile(abs);
});

app.post("/api/tdds/:slug/export", async (req, res) => {
  try {
    const slug = parseSlug(req.params.slug);
    if (!slug) return res.status(400).json({ error: "Invalid slug" });
    const destination = req.body?.destination;
    const result = await exportBuild({
      root: ROOT,
      publicRoot: PUBLIC,
      tddsRoot: TDDS,
      slug,
      destination: destination ? String(destination) : undefined,
    });
    if (!result.ok) return res.status(400).json({ error: result.reason });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

await fs.mkdir(TDDS, { recursive: true });
await fs.mkdir(SESSIONS, { recursive: true });
await fs.mkdir(GAMEPLAY, { recursive: true });
await fs.mkdir(path.join(ROOT, "exports"), { recursive: true });
await initProviderCatalog(ROOT);
await initBenchmarkStore(ROOT);

try {
  const purged = await purgeChatAttachments(SESSIONS);
  if (purged.removedFiles > 0) {
    const mb = (purged.removedBytes / (1024 * 1024)).toFixed(2);
    console.log(
      `[chat-attach] purged ${purged.removedFiles} file(s) (${mb} MB) · kept ${purged.keptFiles}`,
    );
  }
} catch (err) {
  console.warn(`[chat-attach] purge skipped: ${err?.message || err}`);
}

const bootProviders = providerStatus();
if (!bootProviders.configured) {
  console.warn(
    "[agent] No API keys found. Add CURSOR_API_KEY and/or LLM_API_KEY to .env before Generate Final.",
  );
} else {
  const a = getActiveProvider();
  console.log(`[agent] ${a.label} · model ${a.model}`);
}

app.listen(PORT, HOST, () => {
  console.log(`Prototype Laboratory → http://${HOST}:${PORT}`);
});
