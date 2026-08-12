const startEl = document.getElementById("start");
const playEl = document.getElementById("play");
const tddSelect = document.getElementById("tddSelect");
const mechanicList = document.getElementById("mechanicList");
const providerSelect = document.getElementById("providerSelect");
const modelSelect = document.getElementById("modelSelect");
const modelCustom = document.getElementById("modelCustom");
const providerHint = document.getElementById("providerHint");
const providerError = document.getElementById("providerError");
const generateBtn = document.getElementById("generateBtn");
const continueBtn = document.getElementById("continueBtn");
const exportBtn = document.getElementById("exportBtn");
const cleanBtn = document.getElementById("cleanBtn");
const tddImport = document.getElementById("tddImport");
const startLog = document.getElementById("startLog");
const canvas = document.getElementById("gameCanvas");
const hudRoot = document.getElementById("hudRoot");
const skyBtn = document.getElementById("skyBtn");
const skyIcon = document.getElementById("skyIcon");
const chatToggle = document.getElementById("chatToggle");
const chatDrawer = document.getElementById("chatDrawer");
const chatClose = document.getElementById("chatClose");
const chatLog = document.getElementById("chatLog");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const syncBtn = document.getElementById("syncBtn");
const exportPlayBtn = document.getElementById("exportPlayBtn");
const reloadBtn = document.getElementById("reloadBtn");
const playStatus = document.getElementById("playStatus");
const workOverlay = document.getElementById("workOverlay");
const workEyebrow = document.getElementById("workEyebrow");
const workTitle = document.getElementById("workTitle");
const workStatus = document.getElementById("workStatus");
const workElapsed = document.getElementById("workElapsed");
const workLog = document.getElementById("workLog");
const workStopBtn = document.getElementById("workStopBtn");

const ICON_SUN = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`;
const ICON_MOON = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z"/></svg>`;
const LAST_SLUG_KEY = "plab.lastSlug";

let sessionId = null;
let gameModule = null;
let tdds = [];
let providerState = { providers: [], active: null, model: null, configured: false };
let activeWorkController = null;
let workTimer = null;
let workStartedAt = 0;
let lastWorkLogLine = "";

function updateGameInputBlock() {
  const block = !chatDrawer.hidden || !workOverlay.hidden;
  document.body.dataset.plabGameInput = block ? "blocked" : "allowed";
  if (block) window.dispatchEvent(new CustomEvent("plab:input-block"));
}

function shortPath(p) {
  return String(p || "")
    .replace(/\\/g, "/")
    .replace(/^public\//, "")
    .replace(/^\.\//, "");
}

/** Strip model chain-of-thought / think tags before showing in UI. */
function sanitizeAgentText(text) {
  return String(text || "")
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, "")
    .replace(/<\/?think\b[^>]*>/gi, "")
    .replace(/^\s*(thinking|reasoning)\s*:\s*/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function describeAgentStep(ev) {
  if (!ev || !ev.type) return null;
  if (ev.type === "status" && ev.message) {
    const cleaned = sanitizeAgentText(ev.message).replace(/\s+/g, " ");
    // Drop status lines that were only internal think blocks
    if (!cleaned || cleaned.length < 4) return null;
    if (/^<think/i.test(ev.message) && cleaned.length < 8) return null;
    return cleaned;
  }
  if (ev.type === "tool") {
    const path = shortPath(ev.path);
    const name = ev.name || "tool";
    if (name === "read_file" || /read/i.test(name)) {
      return path ? `Reading ${path}` : "Reading project files…";
    }
    if (name === "write_file" || /write|edit|patch/i.test(name)) {
      return path ? `Writing ${path}` : "Writing gameplay files…";
    }
    if (name === "list_dir" || /list|glob|search/i.test(name)) {
      return path ? `Listing ${path}` : "Scanning project tree…";
    }
    return path ? `${name} → ${path}` : `${name}…`;
  }
  if (ev.type === "file" && ev.path) return `Saved ${shortPath(ev.path)}`;
  if (ev.type === "assistant" && ev.text) {
    const t = sanitizeAgentText(ev.text).replace(/\s+/g, " ");
    if (t.length >= 8 && t.length <= 140 && !t.includes("```")) return t;
    return null;
  }
  if (ev.type === "error" && ev.message) return ev.message;
  if (ev.type === "synced") return `Synced${ev.version ? ` v${ev.version}` : ""}`;
  if (ev.type === "ready") return "Playable ready";
  if (ev.type === "done") return "Done";
  return null;
}

function showScreen(name) {
  const start = name === "start";
  startEl.hidden = !start;
  playEl.hidden = start;
  if (start) setChatOpen(false);
}

function setChatOpen(open) {
  chatDrawer.hidden = !open;
  chatToggle.setAttribute("aria-expanded", open ? "true" : "false");
  updateGameInputBlock();
  if (open) {
    requestAnimationFrame(() => chatInput?.focus?.());
  } else if (!playEl.hidden) {
    requestAnimationFrame(() => canvas?.focus?.());
  }
}

function logStart(line) {
  startLog.hidden = false;
  startLog.textContent += `${line}\n`;
  startLog.scrollTop = startLog.scrollHeight;
}

function setPlayStatus(text, show = true) {
  playStatus.hidden = !show;
  playStatus.textContent = text || "";
}

function appendChat(role, text) {
  if (!text) return;
  const div = document.createElement("div");
  div.className = `chat-msg chat-msg--${role}`;
  div.textContent = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function createChatRunCollector() {
  const assistantChunks = [];
  const writtenFiles = new Set();

  return {
    ingest(ev) {
      if (!ev) return;
      if (ev.type === "assistant" && ev.text) {
        const t = sanitizeAgentText(ev.text);
        if (t) assistantChunks.push(t);
      }
      if (ev.type === "file" && ev.path) writtenFiles.add(shortPath(ev.path));
      if (
        ev.type === "tool" &&
        ev.path &&
        (ev.name === "write_file" || /write|edit|patch/i.test(ev.name || ""))
      ) {
        writtenFiles.add(shortPath(ev.path));
      }
    },
    buildReply() {
      let text = "";
      for (let i = assistantChunks.length - 1; i >= 0; i--) {
        const chunk = assistantChunks[i];
        if (chunk.length >= 16) {
          text = chunk;
          break;
        }
      }
      if (!text && assistantChunks.length) text = assistantChunks[assistantChunks.length - 1];

      const files = [...writtenFiles].filter(Boolean).sort();
      const parts = [];
      if (text) parts.push(text.trim());
      if (files.length) {
        const list = files.map((f) => `• ${f}`).join("\n");
        parts.push(files.length === 1 ? `File updated:\n${list}` : `Files updated:\n${list}`);
      }
      if (!parts.length) {
        return "Finished this turn — no gameplay files were written. Try rephrasing or be more specific.";
      }
      return parts.join("\n\n");
    },
  };
}

/** Surface concise work signals — tool paths, short planner lines, never raw dumps. */
function summarizeAgentEvent(ev) {
  if (!ev || !ev.type) return null;
  if (ev.type === "session") return null;
  const text = describeAgentStep(ev);
  if (!text) return null;
  if (ev.type === "error") return { kind: "error", text };
  if (ev.type === "done") return { kind: "done", text };
  return { kind: "status", text };
}

function showWorkOverlay({ title, eyebrow = "Working", status = "Starting…" } = {}) {
  workEyebrow.textContent = eyebrow;
  workTitle.textContent = title || "Processing…";
  workStatus.textContent = status;
  workLog.innerHTML = "";
  lastWorkLogLine = "";
  workStopBtn.disabled = false;
  workOverlay.hidden = false;
  updateGameInputBlock();
  workStartedAt = performance.now();
  if (workTimer) clearInterval(workTimer);
  workTimer = setInterval(() => {
    const s = ((performance.now() - workStartedAt) / 1000).toFixed(1);
    workElapsed.textContent = `${s}s`;
  }, 100);
}

function setWorkStatus(message) {
  if (message) workStatus.textContent = message;
}

function appendWorkLog(line) {
  if (!line || line === lastWorkLogLine) return;
  lastWorkLogLine = line;
  const li = document.createElement("li");
  li.textContent = line;
  workLog.appendChild(li);
  workLog.scrollTop = workLog.scrollHeight;
  while (workLog.children.length > 40) workLog.removeChild(workLog.firstChild);
}

function hideWorkOverlay() {
  workOverlay.hidden = true;
  updateGameInputBlock();
  if (workTimer) {
    clearInterval(workTimer);
    workTimer = null;
  }
}

async function cancelActiveWork() {
  const controller = activeWorkController;
  const id = sessionId;
  workStopBtn.disabled = true;
  setWorkStatus("Stopping…");
  if (controller) controller.abort();
  if (id) {
    try {
      await fetch(`/api/sessions/${encodeURIComponent(id)}/cancel`, { method: "POST" });
    } catch {
      /* client abort is enough */
    }
  }
  appendWorkLog("Stopped by user");
  setTimeout(hideWorkOverlay, 200);
}

async function readSSE(url, options, onEvent) {
  const controller = new AbortController();
  activeWorkController = controller;
  const opts = {
    ...options,
    signal: controller.signal,
  };
  try {
    const res = await fetch(url, opts);
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || res.statusText);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() || "";
      for (const part of parts) {
        const line = part.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;
        try {
          const ev = JSON.parse(line.slice(6));
          onEvent?.(ev);
        } catch {
          /* */
        }
      }
    }
  } finally {
    if (activeWorkController === controller) activeWorkController = null;
  }
}

function handleWorkEvent(ev, { chat = false } = {}) {
  if (ev.type === "session" && ev.sessionId) sessionId = ev.sessionId;
  const summary = summarizeAgentEvent(ev);
  if (!summary) return;
  if (summary.kind === "error") {
    setWorkStatus(summary.text);
    appendWorkLog(summary.text);
    if (chat) appendChat("sys", summary.text);
    return;
  }
  if (summary.kind === "status") {
    setWorkStatus(summary.text);
    appendWorkLog(summary.text);
  }
}

async function loadTdds(selectSlug) {
  const res = await fetch("/api/tdds");
  const data = await res.json();
  tdds = data.tdds || [];
  tddSelect.innerHTML = "";
  for (const t of tdds) {
    const opt = document.createElement("option");
    opt.value = t.slug;
    opt.textContent = `${t.projectName} (${t.slug})`;
    tddSelect.appendChild(opt);
  }
  const preferred = selectSlug || localStorage.getItem(LAST_SLUG_KEY);
  if (preferred && [...tddSelect.options].some((o) => o.value === preferred)) {
    tddSelect.value = preferred;
  }
  renderMechanics();
}

function renderMechanics() {
  const t = tdds.find((x) => x.slug === tddSelect.value);
  mechanicList.innerHTML = "";
  if (!t) return;
  for (const m of t.mechanics || []) {
    const li = document.createElement("li");
    li.innerHTML = `<div>${m.title || m.id}</div><div class="id">${m.id}${m.type ? " · " + m.type : ""}</div>`;
    mechanicList.appendChild(li);
  }
}

async function loadProviders() {
  const res = await fetch("/api/agent/providers");
  const data = await res.json();
  providerState = data;
  providerSelect.innerHTML = "";
  providerError.hidden = true;

  if (!data.configured || !(data.providers || []).length) {
    providerError.hidden = false;
    providerError.textContent =
      data.missingHint ||
      "No API key configured. Add CURSOR_API_KEY and/or LLM_API_KEY to .env and restart.";
    generateBtn.disabled = true;
    modelSelect.innerHTML = "";
    providerHint.textContent = "";
    return;
  }

  generateBtn.disabled = false;
  for (const p of data.providers || []) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.label;
    providerSelect.appendChild(opt);
  }
  providerSelect.value = data.active || data.providers[0].id;
  fillModelSelect(data.model);
  updateProviderHint();
}

function currentProvider() {
  return (providerState.providers || []).find((p) => p.id === providerSelect.value);
}

function fillModelSelect(selectedModel) {
  const p = currentProvider();
  const models = [...(p?.suggestedModels || [])];
  const current = selectedModel || p?.model || "";
  if (current && !models.includes(current)) models.unshift(current);
  modelSelect.innerHTML = "";
  for (const m of models) {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m === "auto" ? "auto (server picks)" : m;
    modelSelect.appendChild(opt);
  }
  const customOpt = document.createElement("option");
  customOpt.value = "__custom__";
  customOpt.textContent = "Custom…";
  modelSelect.appendChild(customOpt);

  if (current && models.includes(current)) {
    modelSelect.value = current;
    modelCustom.hidden = true;
  } else if (current) {
    modelSelect.value = "__custom__";
    modelCustom.hidden = false;
    modelCustom.value = current;
  } else if (models.length) {
    modelSelect.value = models[0];
    modelCustom.hidden = true;
  }
}

function selectedModelValue() {
  if (modelSelect.value === "__custom__") return modelCustom.value.trim();
  return modelSelect.value;
}

function updateProviderHint() {
  const p = currentProvider();
  if (!p) {
    providerHint.textContent = "";
    return;
  }
  if (p.id === "cursor") {
    providerHint.textContent =
      "Cursor SDK · pick model (auto lets Cursor choose). Requires CURSOR_API_KEY.";
  } else {
    providerHint.textContent = `${p.label} · OpenAI-compatible tools. Model from .env or selector.`;
  }
}

async function persistProviderSelection() {
  const id = providerSelect.value;
  const model = selectedModelValue();
  if (!id || !model) return;
  const res = await fetch("/api/agent/provider", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, model }),
  });
  const data = await res.json();
  if (!res.ok) {
    providerError.hidden = false;
    providerError.textContent = data.error || "Could not set provider";
    return;
  }
  providerError.hidden = true;
  providerState = {
    ...providerState,
    ...data,
    providers: data.providers || providerState.providers,
    configured: true,
  };
  updateProviderHint();
}

async function refreshContinueBtn() {
  try {
    const st = await fetch("/api/gameplay/status").then((r) => r.json());
    continueBtn.hidden = !st.ready;
    exportBtn.hidden = !st.ready;
    exportPlayBtn.hidden = !st.ready;
  } catch {
    continueBtn.hidden = true;
    exportBtn.hidden = true;
    exportPlayBtn.hidden = true;
  }
}

function collectChatDigest(limit = 16) {
  if (!chatLog) return "";
  const msgs = [...chatLog.querySelectorAll(".chat-msg")].slice(-limit);
  if (!msgs.length) return "";
  return msgs
    .map((el) => {
      const role = el.classList.contains("chat-msg--user")
        ? "user"
        : el.classList.contains("chat-msg--assistant")
          ? "assistant"
          : el.classList.contains("chat-msg--sys")
            ? "system"
            : "system";
      const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 320);
      return text ? `${role}: ${text}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

async function apiJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    if (!res.ok) {
      if (res.status === 404 && url.includes("/export")) {
        throw new Error(
          "Export API not found — restart the lab server (npm start) so it loads the latest routes.",
        );
      }
      throw new Error(text?.slice(0, 200) || res.statusText || "Request failed");
    }
  }
  if (!res.ok) throw new Error(data.error || res.statusText || "Request failed");
  return data;
}

async function runExportBuild() {
  const slug = tddSelect.value;
  if (!slug) return alert("Select a TDD first");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const suggested = `exports/${slug}-${stamp}`;
  let destination = null;
  try {
    destination = window.prompt("Export destination (leave blank for default):", suggested);
  } catch {
    destination = null;
  }
  if (destination === null) return;

  showWorkOverlay({
    title: "Export playable",
    eyebrow: "Save",
    status: destination || suggested,
  });
  appendWorkLog(`target: ${destination || suggested}`);
  try {
    const body = destination ? { destination } : {};
    const result = await apiJson(`/api/tdds/${encodeURIComponent(slug)}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    appendWorkLog(`copied ${result.filesCopied} files`);
    appendWorkLog(`destination: ${result.destination}`);
    appendWorkLog("cd into that folder and run: node server.mjs");
    appendWorkLog("then open http://127.0.0.1:8080/");
    setWorkStatus(`Playable → ${result.destination}`);
    setTimeout(hideWorkOverlay, 1800);
  } catch (err) {
    appendWorkLog(String(err.message || err));
    setWorkStatus(String(err.message || err));
    setTimeout(hideWorkOverlay, 1200);
  }
}

async function unmountGame() {
  try {
    await gameModule?.unmount?.();
  } catch {
    /* */
  }
  gameModule = null;
  hudRoot.innerHTML = "";
}

async function mountGame() {
  await unmountGame();
  const bust = Date.now();
  const mod = await import(`/gameplay/main.js?t=${bust}`);
  gameModule = mod;
  await mod.mount(canvas, { hudRoot });
  syncSkyIcon();
}

async function syncSkyIcon() {
  const { getActiveSceneKit, readSkyMode } = await import("/runtime/SceneKit.js");
  const kit = getActiveSceneKit();
  const mode = kit?.getMode?.() || readSkyMode();
  skyIcon.innerHTML = mode === "day" ? ICON_SUN : ICON_MOON;
}

async function openPlayable({ slug, resume = false } = {}) {
  const useSlug = slug || tddSelect.value;
  if (!useSlug) throw new Error("Select a TDD");
  localStorage.setItem(LAST_SLUG_KEY, useSlug);

  if (resume || !sessionId) {
    const res = await fetch("/api/sessions/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: useSlug }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Resume failed");
    sessionId = data.sessionId;
  }

  showScreen("play");
  setChatOpen(false);
  setPlayStatus("Mounting…");
  await mountGame();
  setPlayStatus("", false);
}

tddSelect.addEventListener("change", () => {
  renderMechanics();
  localStorage.setItem(LAST_SLUG_KEY, tddSelect.value);
});
providerSelect.addEventListener("change", async () => {
  fillModelSelect(currentProvider()?.model);
  await persistProviderSelection();
});
modelSelect.addEventListener("change", async () => {
  modelCustom.hidden = modelSelect.value !== "__custom__";
  if (modelSelect.value !== "__custom__") await persistProviderSelection();
});
modelCustom.addEventListener("change", () => persistProviderSelection());
modelCustom.addEventListener("blur", () => persistProviderSelection());

tddImport.addEventListener("change", async () => {
  const file = tddImport.files?.[0];
  if (!file) return;
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/tdds/import", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) return alert(data.error || "Import failed");
  await loadTdds(data.slug);
});

cleanBtn.addEventListener("click", async () => {
  if (!confirm("Remove generated gameplay and sessions? TDDs and lab UI stay.")) return;
  await unmountGame();
  await fetch("/api/workspace/clean", { method: "POST" });
  sessionId = null;
  startLog.textContent = "";
  startLog.hidden = true;
  continueBtn.hidden = true;
  exportBtn.hidden = true;
  exportPlayBtn.hidden = true;
  showScreen("start");
});

continueBtn.addEventListener("click", async () => {
  continueBtn.disabled = true;
  showWorkOverlay({ title: "Opening playable", eyebrow: "Continue", status: tddSelect.value });
  try {
    await openPlayable({ slug: tddSelect.value, resume: true });
    hideWorkOverlay();
  } catch (err) {
    setWorkStatus(String(err.message || err));
    appendWorkLog(String(err.message || err));
    alert(err.message || err);
    hideWorkOverlay();
  } finally {
    continueBtn.disabled = false;
  }
});

generateBtn.addEventListener("click", async () => {
  const slug = tddSelect.value;
  if (!slug) return alert("Select a TDD");
  if (!providerState.configured) {
    return alert("Configure CURSOR_API_KEY or LLM_API_KEY in .env first.");
  }
  await persistProviderSelection();
  generateBtn.disabled = true;
  startLog.hidden = true;
  startLog.textContent = "";
  localStorage.setItem(LAST_SLUG_KEY, slug);
  showWorkOverlay({
    title: "Generate Final",
    eyebrow: "Building",
    status: `${slug} · ${providerSelect.value} / ${selectedModelValue()}`,
  });
  try {
    await readSSE(
      "/api/sessions/generate-final",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      },
      (ev) => handleWorkEvent(ev),
    );
    hideWorkOverlay();
    await openPlayable({ slug, resume: false });
    await refreshContinueBtn();
  } catch (err) {
    if (err.name === "AbortError") {
      appendWorkLog("Stopped");
      return;
    }
    setWorkStatus(String(err.message || err));
    appendWorkLog(String(err.message || err));
    alert(err.message || err);
    hideWorkOverlay();
  } finally {
    generateBtn.disabled = !providerState.configured;
  }
});

workStopBtn.addEventListener("click", () => cancelActiveWork());

skyBtn.addEventListener("click", async () => {
  const { getActiveSceneKit, toggleSkyMode, writeSkyMode, readSkyMode } = await import(
    "/runtime/SceneKit.js"
  );
  const kit = getActiveSceneKit();
  if (kit) {
    toggleSkyMode(kit);
  } else {
    const next = readSkyMode() === "day" ? "night" : "day";
    writeSkyMode(next);
  }
  await syncSkyIcon();
});

window.addEventListener("plab:sky", () => {
  syncSkyIcon();
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !chatDrawer.hidden) {
    setChatOpen(false);
    return;
  }
  if (e.key === "n" || e.key === "N") {
    if (document.activeElement === chatInput) return;
    if (!chatDrawer.hidden) return;
    skyBtn.click();
  }
});

chatToggle.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  const opening = chatDrawer.hidden;
  setChatOpen(opening);
  if (opening) chatInput?.focus?.();
});

chatClose.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  setChatOpen(false);
});

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!sessionId) return appendChat("sys", "Generate Final or Continue first.");
  const message = chatInput.value.trim();
  if (!message) return;
  chatInput.value = "";
  appendChat("user", message);
  const runNotes = createChatRunCollector();
  showWorkOverlay({ title: "Chat iteration", eyebrow: "Working", status: "Sending…" });
  try {
    await readSSE(
      `/api/sessions/${sessionId}/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      },
      (ev) => {
        runNotes.ingest(ev);
        handleWorkEvent(ev, { chat: true });
      },
    );
    hideWorkOverlay();
    await mountGame();
    appendChat("assistant", runNotes.buildReply());
  } catch (err) {
    if (err.name === "AbortError") {
      appendChat("sys", "Stopped");
      return;
    }
    appendChat("sys", String(err.message || err));
    hideWorkOverlay();
  }
});

syncBtn.addEventListener("click", async () => {
  if (!sessionId) return alert("Generate Final or Continue first");
  const chatDigest = collectChatDigest();
  const summary = chatDigest
    ? "Sync validated chat iterations and prototype behavior into the TDD"
    : "Promote validated prototype behavior into the TDD product spec";
  showWorkOverlay({ title: "Sync TDD", eyebrow: "Writing", status: "Reading gameplay + updating TDD…" });
  if (chatDigest) appendWorkLog("Including chat digest from this session");
  try {
    await readSSE(
      `/api/sessions/${sessionId}/sync-tdd`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary, chatDigest }),
      },
      (ev) => handleWorkEvent(ev),
    );
    setWorkStatus("Synced");
    setTimeout(hideWorkOverlay, 400);
  } catch (err) {
    if (err.name === "AbortError") return;
    setWorkStatus(String(err.message || err));
    appendWorkLog(String(err.message || err));
    setTimeout(hideWorkOverlay, 800);
  }
});

exportBtn.addEventListener("click", () => runExportBuild());
exportPlayBtn.addEventListener("click", () => runExportBuild());

reloadBtn.addEventListener("click", () => mountGame());

try {
  const es = new EventSource("/api/events");
  es.onmessage = async (msg) => {
    try {
      const ev = JSON.parse(msg.data);
      if (ev.type === "reload" && !playEl.hidden && workOverlay.hidden) await mountGame();
    } catch {
      /* */
    }
  };
} catch {
  /* */
}

await loadTdds();
await loadProviders();
await refreshContinueBtn();
skyIcon.innerHTML = ICON_SUN;
setChatOpen(false);
