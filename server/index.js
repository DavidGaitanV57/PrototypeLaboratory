import "dotenv/config";
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { listTdds, readTdd, importTddUpload } from "./tdd/parser.js";
import { createSession } from "./agent/session.js";
import { exportBuild } from "./export.js";
import {
  providerStatus,
  initProviderCatalog,
  setActiveProvider,
  getActiveProvider,
} from "./agent/providers/catalog.js";
import { initBenchmarkStore, getBenchmarkState, clearBenchmark, recordBenchmark } from "./agent/benchmarkStore.js";
import { assertSafeSlug } from "./security/paths.js";

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
const sessions = new Map();
const reloadClients = new Set();

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  next();
});

function parseSlug(raw) {
  try {
    return assertSafeSlug(raw);
  } catch {
    return null;
  }
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
    const mode = req.body?.mode === "ask" ? "ask" : "agent";
    const outcome = await session.chat(message, {
      mode,
      onEvent: (ev) => send(ev),
    });
    if (mode !== "ask" && !outcome?.resumable) broadcastReload("chat");
    send({
      type: "done",
      mode: outcome?.mode || mode,
      resumable: !!outcome?.resumable,
      ...(session.getCheckpointInfo?.() || {}),
    });
  } catch (err) {
    send({ type: "error", message: err.message || String(err) });
  } finally {
    res.end();
  }
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
    if (mode !== "ask" && !outcome?.resumable) broadcastReload("chat");
    send({
      type: "done",
      mode,
      continued: true,
      resumable: !!outcome?.resumable,
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
    const result = await session.syncTdd({ summary, chatDigest }, {
      onEvent: (ev) => send(ev),
    });
    send({ type: "synced", ...result });
    send({ type: "done" });
  } catch (err) {
    send({ type: "error", message: err.message || String(err) });
  } finally {
    res.end();
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
  try {
    await fs.access(path.join(GAMEPLAY, "main.js"));
    res.json({ ready: true, entry: "/gameplay/main.js" });
  } catch {
    res.json({ ready: false });
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
