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
const chatContinueBtn = document.getElementById("chatContinueBtn");
const chatProviderSelect = document.getElementById("chatProviderSelect");
const chatModelSelect = document.getElementById("chatModelSelect");
const chatModelCustom = document.getElementById("chatModelCustom");
const chatModeAgent = document.getElementById("chatModeAgent");
const chatModeAsk = document.getElementById("chatModeAsk");
const chatModeTrigger = document.getElementById("chatModeTrigger");
const chatModeTriggerText = document.getElementById("chatModeTriggerText");
const chatModePopover = document.getElementById("chatModePopover");
const chatModeBlurb = document.getElementById("chatModeBlurb");
const startPicker = document.getElementById("startPicker");
const startPickerTrigger = document.getElementById("startPickerTrigger");
const startPickerTriggerText = document.getElementById("startPickerTriggerText");
const startPickerPopover = document.getElementById("startPickerPopover");
const startPickerBlurb = document.getElementById("startPickerBlurb");
const chatPicker = document.getElementById("chatPicker");
const chatPickerTrigger = document.getElementById("chatPickerTrigger");
const chatPickerTriggerText = document.getElementById("chatPickerTriggerText");
const chatPickerPopover = document.getElementById("chatPickerPopover");
const chatPickerBlurb = document.getElementById("chatPickerBlurb");
const syncBtn = document.getElementById("syncBtn");
const exportPlayBtn = document.getElementById("exportPlayBtn");
const reloadBtn = document.getElementById("reloadBtn");
const playStatus = document.getElementById("playStatus");
const workOverlay = document.getElementById("workOverlay");
const benchmarkBtn = document.getElementById("benchmarkBtn");
const benchmarkOverlay = document.getElementById("benchmarkOverlay");
const benchmarkClose = document.getElementById("benchmarkClose");
const benchmarkClearBtn = document.getElementById("benchmarkClearBtn");
const benchmarkEmpty = document.getElementById("benchmarkEmpty");
const benchmarkBody = document.getElementById("benchmarkBody");
const benchmarkStats = document.getElementById("benchmarkStats");
const benchmarkHistory = document.getElementById("benchmarkHistory");
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
/** @type {"agent" | "ask"} */
let chatMode = "agent";
const CHAT_MODE_KEY = "plab.chatMode";
const PLAYABLE_RESUME_KEY = "plab.resumePlayable";

function updateGameInputBlock() {
  const block = !chatDrawer.hidden || !workOverlay.hidden || !benchmarkOverlay.hidden;
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
  if (ev.type === "benchmark") {
    const dur = formatDurationMs(ev.durationMs);
    if (ev.status === "error") {
      const err = ev.errorMessage ? String(ev.errorMessage).slice(0, 160) : "error";
      return `Benchmark · FAILED · ${dur} · ${err}`;
    }
    const tok = ev.tokensKnown
      ? `${formatTokenCount(ev.totalTokens)} tok`
      : "tokens n/a";
    return `Benchmark · ${ev.status || "done"} · ${dur} · ${tok}`;
  }
  if (ev.type === "advice") {
    const warns = (ev.advice || []).filter((a) => a.severity === "warn").length;
    if (warns) return `Soft check · ${warns} hint(s) (play still opens)`;
    return "Soft check · OK";
  }
  if (ev.type === "done") return "Done";
  return null;
}

function formatDurationMs(ms) {
  const s = Math.max(0, Number(ms) || 0) / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = s - m * 60;
  return `${m}m ${rem.toFixed(0)}s`;
}

function formatTokenCount(n) {
  const v = Math.round(Number(n) || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 10_000) return `${(v / 1000).toFixed(1)}k`;
  return String(v);
}

function opLabel(op) {
  if (op === "generate") return "Generate";
  if (op === "chat") return "Chat";
  if (op === "ask") return "Ask";
  if (op === "sync") return "Sync";
  return op || "Run";
}

function renderBenchmark(state) {
  const last = state?.last;
  const history = state?.history || [];
  const hasData = Boolean(last) || history.length > 0;
  if (benchmarkClearBtn) benchmarkClearBtn.disabled = !hasData;

  if (!last) {
    benchmarkEmpty.hidden = false;
    benchmarkEmpty.textContent = "No agent runs yet";
    benchmarkBody.hidden = true;
    return;
  }
  benchmarkEmpty.hidden = true;
  benchmarkBody.hidden = false;

  const tokensValue = last.tokensKnown
    ? `${formatTokenCount(last.totalTokens)} (in ${formatTokenCount(last.promptTokens)} / out ${formatTokenCount(last.completionTokens)})`
    : "Not reported by provider";

  const rows = [
    ["Operation", opLabel(last.op)],
    ["Status", last.status || "—"],
    ["Provider", last.providerLabel || last.providerId || last.provider || "—"],
    ["Model", last.model || "—"],
    ["Duration", formatDurationMs(last.durationMs)],
    ["Tokens", tokensValue],
    ["Turns", String(last.turns ?? 0)],
    ["Tool calls", String(last.toolCalls ?? 0)],
    ["Files written", String(last.filesWritten ?? 0)],
    ["TDD", last.slug || "—"],
  ];
  if (last.errorMessage) {
    rows.push(["Error", last.errorMessage]);
  }

  benchmarkStats.innerHTML = rows
    .map(([k, v]) => {
      const text = String(v);
      const danger = k === "Status" && last.status === "error" || k === "Error";
      return `<div${danger ? ' class="benchmark__stat--danger"' : ""}><dt>${k}</dt><dd title="${text.replace(/"/g, "&quot;")}">${text}</dd></div>`;
    })
    .join("");

  benchmarkHistory.innerHTML = history
    .slice(0, 8)
    .map((h) => {
      const tok = h.tokensKnown ? `${formatTokenCount(h.totalTokens)} tok` : "tok n/a";
      const st = h.status === "error" ? "FAIL" : h.status === "max_turns" ? "MAX" : "OK";
      const tip = h.errorMessage || h.model || "";
      return `<li title="${String(tip).replace(/"/g, "&quot;")}">
        <span class="op">${opLabel(h.op)}</span>
        <span class="meta">${st} · ${h.providerLabel || h.providerId || ""} · ${h.model || "—"} · ${h.slug || ""}</span>
        <span class="nums">${formatDurationMs(h.durationMs)} · ${tok}</span>
      </li>`;
    })
    .join("");
}

function setBenchmarkOpen(open) {
  if (!benchmarkOverlay) return;
  benchmarkOverlay.hidden = !open;
  updateGameInputBlock();
  if (open) renderBenchmark(window.__plabBenchmark || { last: null, history: [] });
}

async function clearBenchmarkData() {
  try {
    const res = await fetch("/api/benchmark", { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || res.statusText);
    }
  } catch (err) {
    alert(err.message || err);
    return;
  }
  const empty = { last: null, history: [] };
  window.__plabBenchmark = empty;
  try {
    localStorage.removeItem("plab.benchmark");
  } catch {
    /* */
  }
  renderBenchmark(empty);
}

function applyBenchmarkEvent(ev) {
  const row = { ...ev };
  delete row.type;
  const prev = window.__plabBenchmark || { last: null, history: [] };
  const history = [row, ...(prev.history || []).filter((h) => h.at !== row.at)].slice(0, 12);
  const next = { last: row, history };
  window.__plabBenchmark = next;
  try {
    localStorage.setItem("plab.benchmark", JSON.stringify(next));
  } catch {
    /* */
  }
  renderBenchmark(next);
}

async function loadBenchmark() {
  try {
    const res = await fetch("/api/benchmark");
    if (res.ok) {
      const data = await res.json();
      if (data?.last) {
        window.__plabBenchmark = data;
        renderBenchmark(data);
        return;
      }
    }
  } catch {
    /* */
  }
  try {
    const raw = localStorage.getItem("plab.benchmark");
    if (raw) {
      const data = JSON.parse(raw);
      window.__plabBenchmark = data;
      renderBenchmark(data);
      return;
    }
  } catch {
    /* */
  }
  renderBenchmark({ last: null, history: [] });
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
    syncChatProviderControls();
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

function appendChat(role, text, { mode } = {}) {
  if (!text) return;
  const div = document.createElement("div");
  div.className = `chat-msg chat-msg--${role}`;
  if (mode === "ask" || mode === "agent") {
    div.dataset.mode = mode;
    const mark = document.createElement("span");
    mark.className = `chat-msg__mark chat-msg__mark--${mode}`;
    mark.title = mode === "ask" ? "Ask" : "Agent";
    mark.setAttribute("aria-label", mode === "ask" ? "Ask" : "Agent");
    div.appendChild(mark);
  }
  const body = document.createElement("span");
  body.className = "chat-msg__text";
  body.textContent = text;
  div.appendChild(body);
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function serializeChatLog() {
  return [...chatLog.querySelectorAll(".chat-msg")].map((el) => {
    const role = el.classList.contains("chat-msg--user")
      ? "user"
      : el.classList.contains("chat-msg--assistant")
        ? "assistant"
        : "sys";
    return {
      role,
      text: el.querySelector(".chat-msg__text")?.textContent || el.textContent || "",
      mode: el.dataset.mode || undefined,
    };
  });
}

function restoreChatLog(entries) {
  chatLog.replaceChildren();
  for (const entry of entries || []) {
    if (!entry?.text) continue;
    appendChat(entry.role || "sys", entry.text, { mode: entry.mode });
  }
}

function stripModeEcho(text) {
  return String(text || "")
    .replace(/^\s*\[(Agent|Ask)\]\s*/i, "")
    .replace(/^\s*(Agent|Ask)\s*:\s*/i, "")
    .trim();
}

function createChatRunCollector(userMessage = "") {
  const assistantChunks = [];
  const writtenFiles = new Set();
  let hadError = false;
  let errorMessage = "";
  let mode = "agent";
  let resumable = false;
  let checkpointTurn = null;
  const userNorm = stripModeEcho(userMessage).toLowerCase();

  function isUserEcho(text) {
    const t = stripModeEcho(text);
    if (!t) return true;
    if (/^\[(Agent|Ask)\]/i.test(String(text || "").trim())) return true;
    const norm = t.toLowerCase();
    if (userNorm && (norm === userNorm || norm.startsWith(userNorm))) return true;
    return false;
  }

  return {
    ingest(ev) {
      if (!ev) return;
      if (ev.type === "error" && ev.message) {
        hadError = true;
        errorMessage = String(ev.message);
      }
      if (ev.type === "checkpoint" && ev.resumable) {
        resumable = true;
        if (ev.turn) checkpointTurn = ev.turn;
      }
      if (ev.type === "done") {
        if (ev.mode) mode = ev.mode;
        if (ev.resumable) {
          resumable = true;
          if (ev.turn) checkpointTurn = ev.turn;
        }
      }
      if (ev.type === "assistant" && ev.text) {
        const t = sanitizeAgentText(ev.text);
        if (t && !isUserEcho(t)) assistantChunks.push(t);
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
      if (hadError) {
        return errorMessage
          ? `Request failed: ${errorMessage}`
          : "Request failed — no gameplay changes were applied.";
      }
      let text = "";
      for (let i = assistantChunks.length - 1; i >= 0; i--) {
        const chunk = stripModeEcho(assistantChunks[i]);
        if (chunk.length >= 16 && !isUserEcho(chunk)) {
          text = chunk;
          break;
        }
      }
      if (!text) {
        for (let i = assistantChunks.length - 1; i >= 0; i--) {
          const chunk = stripModeEcho(assistantChunks[i]);
          if (chunk && !isUserEcho(chunk)) {
            text = chunk;
            break;
          }
        }
      }

      const files = [...writtenFiles].filter(Boolean).sort();
      const parts = [];
      if (text) parts.push(text.trim());
      if (files.length) {
        const list = files.map((f) => `• ${f}`).join("\n");
        parts.push(files.length === 1 ? `File updated:\n${list}` : `Files updated:\n${list}`);
      }
      if (!parts.length) {
        if (resumable) {
          return `Stopped — checkpoint ready${checkpointTurn ? ` (turn ${checkpointTurn})` : ""}. Press Continue to resume.`;
        }
        if (mode === "ask") {
          return "Ask finished with no readable reply. Try again or switch provider/model.";
        }
        return "Finished this turn — no gameplay files were written. Try rephrasing or be more specific.";
      }
      return parts.join("\n\n");
    },
    get hadError() {
      return hadError;
    },
    get wroteFiles() {
      return writtenFiles.size > 0;
    },
    get files() {
      return [...writtenFiles];
    },
    get resumable() {
      return resumable;
    },
    get checkpointTurn() {
      return checkpointTurn;
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
  workStopBtn.textContent = "Stop";
  workOverlay.hidden = false;
  updateGameInputBlock();
  workStartedAt = performance.now();
  if (workTimer) clearInterval(workTimer);
  workTimer = setInterval(() => {
    const s = ((performance.now() - workStartedAt) / 1000).toFixed(1);
    workElapsed.textContent = `${s}s`;
  }, 100);
}

function showWorkFailure(message) {
  const msg = String(message || "Failed").slice(0, 1200);
  workEyebrow.textContent = "Failed";
  setWorkStatus(msg);
  appendWorkLog(msg);
  logStart(msg);
  workStopBtn.disabled = false;
  workStopBtn.textContent = "Close";
  workOverlay.hidden = false;
  updateGameInputBlock();
  if (workTimer) {
    clearInterval(workTimer);
    workTimer = null;
  }
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
  let checkpoint = null;
  if (id) {
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(id)}/cancel`, {
        method: "POST",
      });
      checkpoint = await res.json().catch(() => null);
    } catch {
      /* client abort is enough */
    }
  }
  appendWorkLog("Stopped by user");
  if (checkpoint?.resumable) {
    setWorkStatus(`Stopped — Continue available (turn ${checkpoint.turn || "?"})`);
    setChatContinueVisible(checkpoint);
    appendChat(
      "sys",
      `Stopped. Checkpoint saved at turn ${checkpoint.turn || "?"}. Press Continue in chat to resume.`,
    );
    setChatOpen(true);
  }
  setTimeout(hideWorkOverlay, checkpoint?.resumable ? 600 : 200);
}

function setChatContinueVisible(info) {
  if (!chatContinueBtn) return;
  const ok = !!(info && info.resumable);
  chatContinueBtn.hidden = !ok;
  if (ok) {
    const turn = info.turn ? ` · turn ${info.turn}` : "";
    chatContinueBtn.textContent = `Continue checkpoint${turn}`;
  }
}

async function refreshCheckpointButton() {
  if (!chatContinueBtn || !sessionId) {
    setChatContinueVisible(null);
    return;
  }
  try {
    const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/checkpoint`);
    const data = await res.json();
    setChatContinueVisible(data);
  } catch {
    setChatContinueVisible(null);
  }
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
  if (ev.type === "benchmark") {
    applyBenchmarkEvent(ev);
    const summary = summarizeAgentEvent(ev);
    if (summary) {
      setWorkStatus(summary.text);
      appendWorkLog(summary.text);
    }
    return;
  }
  if (ev.type === "advice") {
    const digest = ev.digest || "";
    const warns = (ev.advice || []).filter((a) => a.severity === "warn");
    for (const w of warns.slice(0, 6)) {
      appendWorkLog(`Hint: ${w.message}`);
    }
    if (digest && chat) appendChat("sys", digest);
    else if (digest && !chat) {
      // Surface after generate in chat drawer so operator isn't blind
      appendChat("sys", digest);
    }
    if (warns.length) {
      setWorkStatus(`Soft check · ${warns.length} hint(s) — playable still opens`);
    }
    return;
  }
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
  mechanicList.replaceChildren();
  if (!t) return;
  for (const m of t.mechanics || []) {
    const li = document.createElement("li");
    const title = document.createElement("div");
    title.textContent = m.title || m.id || "";
    const idLine = document.createElement("div");
    idLine.className = "id";
    idLine.textContent = m.type ? `${m.id} · ${m.type}` : String(m.id || "");
    li.append(title, idLine);
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
  syncChatProviderControls();
  updateProviderHint();
}

function shortModelLabel(model) {
  const m = String(model || "").trim();
  if (!m || m === "auto") return "Auto";
  if (m === "__custom__") return "Custom";
  const leaf = m.includes("/") ? m.slice(m.lastIndexOf("/") + 1) : m;
  return leaf.length > 24 ? `${leaf.slice(0, 22)}…` : leaf;
}

function providerBlurb(p) {
  if (!p) return "Choose a provider and model.";
  if (p.id === "cursor") {
    return "Balanced quality and speed, recommended for most tasks";
  }
  return `${p.label} · OpenAI-compatible API. Switch anytime for Generate or Chat.`;
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
  refreshPickerUIs();
}

function selectedModelValue() {
  if (modelSelect.value === "__custom__") return modelCustom.value.trim();
  return modelSelect.value;
}

function selectedChatModelValue() {
  if (!chatModelSelect) return selectedModelValue();
  if (chatModelSelect.value === "__custom__") return chatModelCustom.value.trim();
  return chatModelSelect.value;
}

function fillSelectModels(selectEl, customEl, providerId, selectedModel) {
  const p = (providerState.providers || []).find((x) => x.id === providerId);
  const models = [...(p?.suggestedModels || [])];
  const current = selectedModel || p?.model || "";
  if (current && !models.includes(current)) models.unshift(current);
  selectEl.innerHTML = "";
  for (const m of models) {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m === "auto" ? "auto (server picks)" : m;
    selectEl.appendChild(opt);
  }
  const customOpt = document.createElement("option");
  customOpt.value = "__custom__";
  customOpt.textContent = "Custom…";
  selectEl.appendChild(customOpt);

  if (current && models.includes(current)) {
    selectEl.value = current;
    customEl.hidden = true;
  } else if (current) {
    selectEl.value = "__custom__";
    customEl.hidden = false;
    customEl.value = current;
  } else if (models.length) {
    selectEl.value = models[0];
    customEl.hidden = true;
  }
}

function syncChatProviderControls() {
  if (!chatProviderSelect || !chatModelSelect) return;
  chatProviderSelect.innerHTML = "";
  for (const p of providerState.providers || []) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.label;
    chatProviderSelect.appendChild(opt);
  }
  const active = providerSelect.value || providerState.active || providerState.providers?.[0]?.id;
  if (active && [...chatProviderSelect.options].some((o) => o.value === active)) {
    chatProviderSelect.value = active;
  }
  fillSelectModels(
    chatModelSelect,
    chatModelCustom,
    chatProviderSelect.value,
    selectedModelValue() || providerState.model,
  );
  refreshPickerUIs();
}

/** @type {ReturnType<typeof bindModelPicker>[]} */
const modelPickers = [];

function refreshPickerUIs() {
  for (const p of modelPickers) p.refresh();
}

function closeAllModelPickers(except) {
  closeChatModePicker();
  for (const p of modelPickers) {
    if (p !== except) p.close();
  }
}

function isChatModePickerOpen() {
  return !!(chatModePopover && !chatModePopover.hidden);
}

function closeChatModePicker() {
  if (!chatModePopover || !chatModeTrigger) return;
  chatModePopover.hidden = true;
  chatModeTrigger.setAttribute("aria-expanded", "false");
}

function openChatModePicker() {
  for (const p of modelPickers) p.close();
  if (!chatModePopover || !chatModeTrigger) return;
  chatModePopover.hidden = false;
  chatModeTrigger.setAttribute("aria-expanded", "true");
  if (chatModeBlurb) {
    chatModeBlurb.textContent =
      chatMode === "ask"
        ? "Read-only diagnosis — no file writes this turn."
        : "Edits gameplay files under public/gameplay.";
  }
}

function bindModelPicker({
  root,
  trigger,
  triggerText,
  popover,
  blurb,
  providerEl,
  modelEl,
  customEl,
}) {
  if (!root || !trigger || !popover) {
    return {
      refresh() {},
      close() {},
      isOpen() {
        return false;
      },
    };
  }

  const home = popover.querySelector(".model-picker__home");
  const providerOpts = popover.querySelector('[data-options="provider"]');
  const modelOpts = popover.querySelector('[data-options="model"]');
  const customInput = popover.querySelector("[data-custom]");
  let open = false;
  let view = "home";

  function setView(next) {
    view = next;
    if (home) home.hidden = next !== "home";
    for (const panel of popover.querySelectorAll(".model-picker__panel")) {
      panel.hidden = panel.dataset.panel !== next;
    }
    if (next === "provider") renderProviderOptions();
    if (next === "model") renderModelOptions();
  }

  function currentModelDisplay() {
    if (modelEl.value === "__custom__") return customEl.value.trim() || "Custom";
    return modelEl.value || "Auto";
  }

  function refresh() {
    const p = (providerState.providers || []).find((x) => x.id === providerEl.value);
    const model = currentModelDisplay();
    if (triggerText) triggerText.textContent = shortModelLabel(model);
    if (blurb) blurb.textContent = providerBlurb(p);
    for (const el of popover.querySelectorAll('[data-bind="provider"]')) {
      el.textContent = p?.label || providerEl.value || "—";
    }
    for (const el of popover.querySelectorAll('[data-bind="model"]')) {
      el.textContent = shortModelLabel(model);
    }
    if (customInput) {
      const isCustom = modelEl.value === "__custom__";
      customInput.hidden = !isCustom;
      if (isCustom) customInput.value = customEl.value;
    }
  }

  function close() {
    open = false;
    popover.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    setView("home");
  }

  function openPicker() {
    closeAllModelPickers(api);
    open = true;
    popover.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    setView("home");
    refresh();
  }

  function renderProviderOptions() {
    if (!providerOpts) return;
    providerOpts.innerHTML = "";
    for (const p of providerState.providers || []) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "model-picker__option";
      if (p.id === providerEl.value) btn.classList.add("is-active");
      btn.textContent = p.label;
      btn.addEventListener("click", async () => {
        providerEl.value = p.id;
        fillSelectModels(modelEl, customEl, p.id, p.model);
        try {
          await persistProviderSelectionFrom(p.id, selectedValue());
        } catch {
          /* shown */
        }
        refresh();
        setView("home");
      });
      providerOpts.appendChild(btn);
    }
  }

  function selectedValue() {
    if (modelEl.value === "__custom__") return customEl.value.trim();
    return modelEl.value;
  }

  function renderModelOptions() {
    if (!modelOpts) return;
    modelOpts.innerHTML = "";
    const p = (providerState.providers || []).find((x) => x.id === providerEl.value);
    const models = [...(p?.suggestedModels || [])];
    const current = selectedValue();
    if (current && !models.includes(current) && modelEl.value !== "__custom__") {
      models.unshift(current);
    }
    for (const m of models) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "model-picker__option";
      if (modelEl.value === m) btn.classList.add("is-active");
      btn.textContent = m === "auto" ? "Auto" : m;
      btn.addEventListener("click", async () => {
        modelEl.value = m;
        customEl.hidden = true;
        if (customInput) customInput.hidden = true;
        try {
          await persistProviderSelectionFrom(providerEl.value, m);
        } catch {
          /* shown */
        }
        refresh();
        setView("home");
      });
      modelOpts.appendChild(btn);
    }
    const customBtn = document.createElement("button");
    customBtn.type = "button";
    customBtn.className = "model-picker__option";
    if (modelEl.value === "__custom__") customBtn.classList.add("is-active");
    customBtn.textContent = "Custom…";
    customBtn.addEventListener("click", () => {
      modelEl.value = "__custom__";
      customEl.hidden = false;
      if (customInput) {
        customInput.hidden = false;
        customInput.value = customEl.value || "";
        customInput.focus();
      }
      refresh();
    });
    modelOpts.appendChild(customBtn);
    if (customInput) {
      customInput.hidden = modelEl.value !== "__custom__";
      if (modelEl.value === "__custom__") customInput.value = customEl.value;
    }
  }

  async function commitCustom() {
    if (!customInput || modelEl.value !== "__custom__") return;
    const v = customInput.value.trim();
    if (!v) return;
    customEl.value = v;
    try {
      await persistProviderSelectionFrom(providerEl.value, v);
    } catch {
      /* shown */
    }
    refresh();
  }

  trigger.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (open) close();
    else openPicker();
  });

  popover.addEventListener("click", (e) => e.stopPropagation());

  for (const btn of popover.querySelectorAll("[data-goto]")) {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      setView(btn.getAttribute("data-goto") || "home");
    });
  }

  customInput?.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      await commitCustom();
      setView("home");
    }
  });
  customInput?.addEventListener("change", commitCustom);
  customInput?.addEventListener("blur", commitCustom);

  const api = {
    refresh,
    close,
    isOpen() {
      return open;
    },
  };
  return api;
}

function setChatMode(mode, { close = true } = {}) {
  chatMode = mode === "ask" ? "ask" : "agent";
  try {
    localStorage.setItem(CHAT_MODE_KEY, chatMode);
  } catch {
    /* */
  }
  chatModeAgent?.classList.toggle("is-active", chatMode === "agent");
  chatModeAsk?.classList.toggle("is-active", chatMode === "ask");
  chatDrawer?.classList.toggle("chat-drawer--ask", chatMode === "ask");
  if (chatModeTriggerText) {
    chatModeTriggerText.textContent = chatMode === "ask" ? "Ask" : "Agent";
  }
  if (chatModeBlurb) {
    chatModeBlurb.textContent =
      chatMode === "ask"
        ? "Read-only diagnosis — no file writes this turn."
        : "Edits gameplay files under public/gameplay.";
  }
  if (chatInput) {
    chatInput.placeholder =
      chatMode === "ask"
        ? "Why are AI karts stuck on the first power-up?"
        : "Tune speed, jump, timer, fix loop…";
  }
  if (close) closeChatModePicker();
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
    providerHint.textContent = "";
  }
}

async function persistProviderSelectionFrom(id, model) {
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
    throw new Error(data.error || "Could not set provider");
  }
  providerError.hidden = true;
  providerState = {
    ...providerState,
    ...data,
    providers: data.providers || providerState.providers,
    configured: true,
  };
  if (providerSelect && [...providerSelect.options].some((o) => o.value === id)) {
    providerSelect.value = id;
  }
  fillModelSelect(model);
  syncChatProviderControls();
  updateProviderHint();
}

async function persistProviderSelection() {
  const id = providerSelect.value;
  const model = selectedModelValue();
  if (!id || !model) return;
  try {
    await persistProviderSelectionFrom(id, model);
  } catch {
    /* error already shown */
  }
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
      const text = (
        el.querySelector(".chat-msg__text")?.textContent ||
        el.textContent ||
        ""
      )
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 320);
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
    destination = window.prompt(
      "Export path under exports/ (leave blank for default):",
      suggested,
    );
  } catch {
    destination = null;
  }
  if (destination === null) return;
  destination = String(destination).trim();
  if (!destination) destination = "";

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
  let mod;
  try {
    mod = await import(`/gameplay/main.js?t=${bust}`);
  } catch (err) {
    throw new Error(
      "Could not load /gameplay/main.js — Generate Final may have stopped before writing the entry file. Check Benchmark (max_turns) or run Generate again.",
    );
  }
  if (typeof mod.mount !== "function") {
    throw new Error("gameplay/main.js loaded but does not export mount()");
  }
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

/** ES module siblings stay cached after soft remount — hard reload when Agent wrote files. */
function schedulePlayableReload({ assistantReply, openChat = true } = {}) {
  const messages = serializeChatLog();
  if (assistantReply) {
    messages.push({ role: "assistant", text: assistantReply });
  }
  messages.push({
    role: "sys",
    text: "Page reloaded so module changes apply. Continuing playable…",
  });
  const payload = {
    slug: tddSelect.value || localStorage.getItem(LAST_SLUG_KEY),
    sessionId,
    chatMode,
    openChat: openChat !== false,
    messages,
    at: Date.now(),
  };
  try {
    sessionStorage.setItem(PLAYABLE_RESUME_KEY, JSON.stringify(payload));
  } catch {
    /* */
  }
  location.reload();
}

async function maybeResumeAfterReload() {
  let raw;
  try {
    raw = sessionStorage.getItem(PLAYABLE_RESUME_KEY);
  } catch {
    return false;
  }
  if (!raw) return false;
  try {
    sessionStorage.removeItem(PLAYABLE_RESUME_KEY);
  } catch {
    /* */
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return false;
  }
  if (!data?.slug || Date.now() - (data.at || 0) > 5 * 60 * 1000) return false;

  if (data.chatMode) setChatMode(data.chatMode, { close: false });
  if (data.slug && [...tddSelect.options].some((o) => o.value === data.slug)) {
    tddSelect.value = data.slug;
  }
  showWorkOverlay({
    title: "Continuing playable",
    eyebrow: "Reload",
    status: "Applying fresh modules…",
  });
  try {
    await openPlayable({ slug: data.slug, resume: true });
    restoreChatLog(data.messages || []);
    if (data.openChat) setChatOpen(true);
    hideWorkOverlay();
    return true;
  } catch (err) {
    hideWorkOverlay();
    appendChat("sys", String(err.message || err));
    showScreen("start");
    return false;
  }
}

tddSelect.addEventListener("change", () => {
  renderMechanics();
  localStorage.setItem(LAST_SLUG_KEY, tddSelect.value);
});

modelPickers.push(
  bindModelPicker({
    root: startPicker,
    trigger: startPickerTrigger,
    triggerText: startPickerTriggerText,
    popover: startPickerPopover,
    blurb: startPickerBlurb,
    providerEl: providerSelect,
    modelEl: modelSelect,
    customEl: modelCustom,
  }),
  bindModelPicker({
    root: chatPicker,
    trigger: chatPickerTrigger,
    triggerText: chatPickerTriggerText,
    popover: chatPickerPopover,
    blurb: chatPickerBlurb,
    providerEl: chatProviderSelect,
    modelEl: chatModelSelect,
    customEl: chatModelCustom,
  }),
);

document.addEventListener("click", () => closeAllModelPickers());

chatModeTrigger?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (isChatModePickerOpen()) closeChatModePicker();
  else openChatModePicker();
});
chatModePopover?.addEventListener("click", (e) => e.stopPropagation());
chatModeAgent?.addEventListener("click", (e) => {
  e.preventDefault();
  setChatMode("agent");
});
chatModeAsk?.addEventListener("click", (e) => {
  e.preventDefault();
  setChatMode("ask");
});

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
    let generateFailed = false;
    let failMessage = "";
    await readSSE(
      "/api/sessions/generate-final",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      },
      (ev) => {
        if (ev?.type === "error") {
          generateFailed = true;
          failMessage = ev.message || failMessage;
        }
        if (ev?.type === "benchmark" && ev.status === "error") {
          generateFailed = true;
          if (ev.errorMessage) failMessage = ev.errorMessage;
        }
        if (ev?.type === "benchmark" && ev.status === "max_turns") {
          // not always fatal if main.js exists — checked below
        }
        handleWorkEvent(ev);
      },
    );
    await refreshContinueBtn();
    if (generateFailed) {
      showWorkFailure(
        failMessage ||
          "Generate Final failed. Open Benchmark for status/tokens; check provider/model errors.",
      );
      alert(
        failMessage ||
          "Generate Final failed. See the Failed overlay and Benchmark for details.",
      );
      return;
    }
    const st = await fetch("/api/gameplay/status").then((r) => r.json()).catch(() => ({ ready: false }));
    if (!st.ready) {
      const msg =
        "Generate finished without public/gameplay/main.js (often max_turns). Try again or Chat: write main.js with mount/unmount.";
      showWorkFailure(msg);
      alert(msg);
      return;
    }
    hideWorkOverlay();
    await openPlayable({ slug, resume: false });
  } catch (err) {
    if (err.name === "AbortError") {
      appendWorkLog("Stopped");
      showWorkFailure("Stopped by user");
      return;
    }
    showWorkFailure(String(err.message || err));
    alert(err.message || err);
  } finally {
    generateBtn.disabled = !providerState.configured;
  }
});

workStopBtn.addEventListener("click", () => cancelActiveWork());

benchmarkBtn?.addEventListener("click", () => setBenchmarkOpen(true));
benchmarkClose?.addEventListener("click", () => setBenchmarkOpen(false));
benchmarkClearBtn?.addEventListener("click", async () => {
  if (!confirm("Clear all benchmark history?")) return;
  await clearBenchmarkData();
});
benchmarkOverlay?.addEventListener("click", (e) => {
  if (e.target === benchmarkOverlay) setBenchmarkOpen(false);
});

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

/** Left Shift held — used for Shift+Tab Agent/Ask toggle (chat open only). */
let leftShiftHeld = false;
window.addEventListener("keydown", (e) => {
  if (e.code === "ShiftLeft") leftShiftHeld = true;
});
window.addEventListener("keyup", (e) => {
  if (e.code === "ShiftLeft") leftShiftHeld = false;
});
window.addEventListener("blur", () => {
  leftShiftHeld = false;
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Tab" && leftShiftHeld && !chatDrawer.hidden) {
    e.preventDefault();
    e.stopPropagation();
    closeAllModelPickers();
    setChatMode(chatMode === "ask" ? "agent" : "ask");
    return;
  }
  if (e.key === "Escape") {
    if (modelPickers.some((p) => p.isOpen()) || isChatModePickerOpen()) {
      closeAllModelPickers();
      e.preventDefault();
      return;
    }
    if (benchmarkOverlay && !benchmarkOverlay.hidden) {
      setBenchmarkOpen(false);
      return;
    }
    if (!chatDrawer.hidden) {
      setChatOpen(false);
      return;
    }
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
  appendChat("user", message, { mode: chatMode });
  setChatContinueVisible(null);
  const runNotes = createChatRunCollector(message);
  showWorkOverlay({
    title: chatMode === "ask" ? "Ask (read-only)" : "Chat iteration",
    eyebrow: chatMode === "ask" ? "Ask" : "Agent",
    status: "Sending…",
  });
  try {
    const id = chatProviderSelect?.value || providerSelect.value;
    const model = selectedChatModelValue();
    if (id && model) await persistProviderSelectionFrom(id, model);

    let chatFailed = false;
    await readSSE(
      `/api/sessions/${sessionId}/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, mode: chatMode }),
      },
      (ev) => {
        if (ev?.type === "error") chatFailed = true;
        runNotes.ingest(ev);
        handleWorkEvent(ev, { chat: true });
      },
    );
    hideWorkOverlay();
    const reply = runNotes.buildReply();
    if (runNotes.resumable) {
      setChatContinueVisible({ resumable: true, turn: runNotes.checkpointTurn });
      appendChat("assistant", reply);
      await refreshCheckpointButton();
      return;
    }
    setChatContinueVisible(null);
    if (chatMode === "agent" && !chatFailed && !runNotes.hadError && runNotes.wroteFiles) {
      schedulePlayableReload({
        assistantReply: reply,
        openChat: true,
      });
      return;
    }
    if (chatMode === "agent" && !chatFailed && !runNotes.hadError) {
      await mountGame();
    }
    appendChat("assistant", reply);
  } catch (err) {
    if (err.name === "AbortError") {
      await new Promise((r) => setTimeout(r, 150));
      await refreshCheckpointButton();
      return;
    }
    appendChat("sys", String(err.message || err));
    hideWorkOverlay();
  }
});

chatContinueBtn?.addEventListener("click", async () => {
  if (!sessionId) return appendChat("sys", "No session to continue.");
  setChatContinueVisible(null);
  appendChat("sys", "Continuing from checkpoint…");
  const runNotes = createChatRunCollector("");
  showWorkOverlay({
    title: "Continue checkpoint",
    eyebrow: "Resume",
    status: "Resuming LLM…",
  });
  try {
    let chatFailed = false;
    let mode = chatMode;
    await readSSE(
      `/api/sessions/${sessionId}/continue`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      },
      (ev) => {
        if (ev?.type === "error") chatFailed = true;
        if (ev?.type === "done" && ev.mode) mode = ev.mode;
        runNotes.ingest(ev);
        handleWorkEvent(ev, { chat: true });
      },
    );
    hideWorkOverlay();
    const reply = runNotes.buildReply();
    if (runNotes.resumable) {
      setChatContinueVisible({ resumable: true, turn: runNotes.checkpointTurn });
      appendChat("assistant", reply);
      await refreshCheckpointButton();
      return;
    }
    setChatContinueVisible(null);
    if (mode !== "ask" && !chatFailed && !runNotes.hadError && runNotes.wroteFiles) {
      schedulePlayableReload({
        assistantReply: reply,
        openChat: true,
      });
      return;
    }
    if (mode !== "ask" && !chatFailed && !runNotes.hadError) {
      await mountGame();
    }
    appendChat("assistant", reply || "Continued and finished.");
  } catch (err) {
    if (err.name === "AbortError") {
      await new Promise((r) => setTimeout(r, 150));
      await refreshCheckpointButton();
      return;
    }
    appendChat("sys", String(err.message || err));
    hideWorkOverlay();
    await refreshCheckpointButton();
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

reloadBtn.addEventListener("click", () => {
  schedulePlayableReload({ openChat: !chatDrawer.hidden, assistantReply: null });
});

try {
  const es = new EventSource("/api/events");
  es.onmessage = async (msg) => {
    try {
      const ev = JSON.parse(msg.data);
      // Soft remount is unreliable for cached sibling modules; ignore while working.
      if (ev.type === "reload" && !playEl.hidden && workOverlay.hidden) {
        /* chat handler schedules hard reload when files were written */
      }
    } catch {
      /* */
    }
  };
} catch {
  /* */
}

await loadTdds();
await loadProviders();
await loadBenchmark();
await refreshContinueBtn();
try {
  setChatMode(localStorage.getItem(CHAT_MODE_KEY) === "ask" ? "ask" : "agent");
} catch {
  setChatMode("agent");
}
skyIcon.innerHTML = ICON_SUN;
setChatOpen(false);
await maybeResumeAfterReload();
