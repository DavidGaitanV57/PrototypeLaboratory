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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const TDDS = path.join(ROOT, "docs", "tdds");
const SESSIONS = path.join(ROOT, "sessions");
const GAMEPLAY = path.join(PUBLIC, "gameplay");
const PORT = Number(process.env.PORT || 3850);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const sessions = new Map();
const reloadClients = new Set();

const app = express();
app.use(express.json({ limit: "2mb" }));

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
  try {
    const tdd = await readTdd(TDDS, req.params.slug);
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
    res.status(500).json({ error: err.message });
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
    const slug = req.body?.slug;
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
  const slug = req.body?.slug;
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

    send({ type: "ready", entry: "/gameplay/main.js" });
    broadcastReload("generate");
    send({ type: "done", sessionId });
  } catch (err) {
    send({ type: "error", message: err.message || String(err) });
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
    await session.chat(message, { onEvent: (ev) => send(ev) });
    broadcastReload("chat");
    send({ type: "done" });
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
    const summary = String(req.body?.summary || "").trim();
    const chatDigest = String(req.body?.chatDigest || "").trim();
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

app.post("/api/sessions/:id/cancel", async (req, res) => {
  const session = sessions.get(req.params.id);
  session?.cancel?.();
  res.json({ ok: true });
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

app.post("/api/tdds/:slug/export", async (req, res) => {
  try {
    const slug = req.params.slug;
    const destination = req.body?.destination;
    const result = await exportBuild({
      root: ROOT,
      publicRoot: PUBLIC,
      tddsRoot: TDDS,
      slug,
      destination,
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
await initProviderCatalog(ROOT);

const bootProviders = providerStatus();
if (!bootProviders.configured) {
  console.warn(
    "[agent] No API keys found. Add CURSOR_API_KEY and/or LLM_API_KEY to .env before Generate Final.",
  );
} else {
  const a = getActiveProvider();
  console.log(`[agent] ${a.label} · model ${a.model}`);
}

app.listen(PORT, () => {
  console.log(`Prototype Laboratory → http://127.0.0.1:${PORT}`);
});
