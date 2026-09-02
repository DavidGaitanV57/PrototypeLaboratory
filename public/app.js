const startEl = document.getElementById("start");
const playEl = document.getElementById("play");
const tddSelect = document.getElementById("tddSelect");
const mechanicList = document.getElementById("mechanicList");
const providerSelect = document.getElementById("providerSelect");
const modelSelect = document.getElementById("modelSelect");
const modelCustom = document.getElementById("modelCustom");
const providerHint = document.getElementById("providerHint");
const providerError = document.getElementById("providerError");
const pingModelBtn = document.getElementById("pingModelBtn");
const pingModelsBtn = document.getElementById("pingModelsBtn");
const pingStatus = document.getElementById("pingStatus");
const pingModelList = document.getElementById("pingModelList");
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
const playMenu = document.getElementById("playMenu");
const playMenuTrigger = document.getElementById("playMenuTrigger");
const playMenuPopover = document.getElementById("playMenuPopover");
const chatToggle = document.getElementById("chatToggle");
const chatDrawer = document.getElementById("chatDrawer");
const chatResizeHandle = document.getElementById("chatResizeHandle");
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
const chatModePlan = document.getElementById("chatModePlan");
const chatModeTrigger = document.getElementById("chatModeTrigger");
const chatModeTriggerText = document.getElementById("chatModeTriggerText");
const chatModePopover = document.getElementById("chatModePopover");
const chatModeBlurb = document.getElementById("chatModeBlurb");
const chatApplyPlanBtn = document.getElementById("chatApplyPlanBtn");
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
const syncReviewOverlay = document.getElementById("syncReviewOverlay");
const syncReviewClose = document.getElementById("syncReviewClose");
const syncReviewCancel = document.getElementById("syncReviewCancel");
const syncReviewApply = document.getElementById("syncReviewApply");
const syncReviewAll = document.getElementById("syncReviewAll");
const syncReviewNone = document.getElementById("syncReviewNone");
const syncReviewList = document.getElementById("syncReviewList");
const syncReviewEmpty = document.getElementById("syncReviewEmpty");
const syncReviewCount = document.getElementById("syncReviewCount");
const planReviewOverlay = document.getElementById("planReviewOverlay");
const planReviewClose = document.getElementById("planReviewClose");
const planReviewDiscard = document.getElementById("planReviewDiscard");
const planReviewApply = document.getElementById("planReviewApply");
const planReviewAll = document.getElementById("planReviewAll");
const planReviewNone = document.getElementById("planReviewNone");
const planReviewList = document.getElementById("planReviewList");
const planReviewEmpty = document.getElementById("planReviewEmpty");
const planReviewCount = document.getElementById("planReviewCount");
const planReviewTitle = document.getElementById("planReviewTitle");
const planReviewMeta = document.getElementById("planReviewMeta");
const planReviewVerify = document.getElementById("planReviewVerify");
const planReviewForm = document.getElementById("planReviewForm");
const planReviewInput = document.getElementById("planReviewInput");
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
let sessionSlug = null;
let lastAdviceDigestShown = "";
let gameModule = null;
let tdds = [];
let providerState = { providers: [], active: null, model: null, configured: false };
let activeWorkController = null;
let workTimer = null;
let workStartedAt = 0;
let lastWorkLogLine = "";
/** @type {"agent" | "ask" | "plan"} */
let chatMode = "agent";
const CHAT_MODE_KEY = "plab.chatMode";
const CHAT_MODE_ORDER = ["agent", "ask", "plan"];
/** @type {{ title: string, goal: string, approach: string, steps: object[], risks: string[], verify: string } | null} */
let lastChatPlan = null;

function normalizeChatMode(mode) {
  if (mode === "ask" || mode === "plan") return mode;
  return "agent";
}

function chatModeLabel(mode) {
  const m = normalizeChatMode(mode);
  if (m === "ask") return "Ask";
  if (m === "plan") return "Plan";
  return "Agent";
}

function cycleChatMode(mode) {
  const cur = normalizeChatMode(mode);
  const i = CHAT_MODE_ORDER.indexOf(cur);
  return CHAT_MODE_ORDER[(i + 1) % CHAT_MODE_ORDER.length];
}

function isReadOnlyChat(mode = chatMode) {
  return mode === "ask" || mode === "plan";
}

function chatModeBlurbText(mode = chatMode) {
  if (mode === "ask") return "Read-only diagnosis — no file writes this turn.";
  if (mode === "plan") return "Read-only plan — check steps, revise with feedback, then Apply or Discard.";
  return "Agent edits public/gameplay. Pick any provider/model for this turn.";
}

function chatModePlaceholder(mode = chatMode) {
  if (mode === "ask") return "Why are AI karts stuck on the first power-up?";
  if (mode === "plan") return "Plan: add banana item and stop AI camping the first box…";
  return "Tune speed, jump, timer, fix loop…";
}
const PLAYABLE_RESUME_KEY = "plab.resumePlayable";

function updateGameInputBlock() {
  const block =
    !chatDrawer.hidden ||
    !workOverlay.hidden ||
    !benchmarkOverlay.hidden ||
    (syncReviewOverlay && !syncReviewOverlay.hidden) ||
    (planReviewOverlay && !planReviewOverlay.hidden);
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
  if (ev.type === "sync-proposal") {
    const n = (ev.items || []).length;
    return n ? `Proposed ${n} TDD change${n === 1 ? "" : "s"}` : "No TDD deltas proposed";
  }
  if (ev.type === "plan-proposal") {
    const n = (ev.steps || []).length;
    const title = String(ev.title || "Plan").trim();
    return n ? `${title} · ${n} step${n === 1 ? "" : "s"}` : title || "Plan ready";
  }
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
  if (op === "plan") return "Plan";
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

/** @type {{ id: string, kind: string, title: string, section: string, detail: string }[]} */
let syncProposalItems = [];
let syncProposalMeta = { summary: "", chatDigest: "" };

function setSyncReviewOpen(open) {
  if (!syncReviewOverlay) return;
  syncReviewOverlay.hidden = !open;
  updateGameInputBlock();
}

function selectedSyncItems() {
  if (!syncReviewList) return [];
  return [...syncReviewList.querySelectorAll("input[type=checkbox]:checked")].map((el) => {
    const id = el.value;
    return syncProposalItems.find((it) => it.id === id);
  }).filter(Boolean);
}

function updateSyncReviewCount() {
  if (!syncReviewCount || !syncReviewApply) return;
  const total = syncProposalItems.length;
  const n = selectedSyncItems().length;
  syncReviewCount.textContent = total ? `${n} / ${total} selected` : "";
  syncReviewApply.disabled = n === 0;
}

function renderSyncReview(items) {
  syncProposalItems = Array.isArray(items) ? items : [];
  if (!syncReviewList) return;
  syncReviewList.replaceChildren();
  if (syncReviewEmpty) syncReviewEmpty.hidden = syncProposalItems.length > 0;
  if (syncReviewList) syncReviewList.hidden = syncProposalItems.length === 0;
  for (const it of syncProposalItems) {
    const li = document.createElement("li");
    const label = document.createElement("label");
    label.className = "sync-review__item";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = true;
    cb.value = it.id;
    cb.addEventListener("change", updateSyncReviewCount);
    const body = document.createElement("div");
    const title = document.createElement("div");
    title.className = "sync-review__title";
    title.textContent = it.title;
    const meta = document.createElement("div");
    meta.className = "sync-review__meta";
    if (it.kind) {
      const chip = document.createElement("span");
      chip.className = "sync-review__chip";
      chip.textContent = it.kind;
      meta.appendChild(chip);
    }
    if (it.section) {
      const chip = document.createElement("span");
      chip.className = "sync-review__chip";
      chip.textContent = it.section;
      meta.appendChild(chip);
    }
    body.appendChild(title);
    if (meta.childNodes.length) body.appendChild(meta);
    if (it.detail) {
      const detail = document.createElement("p");
      detail.className = "sync-review__detail";
      detail.textContent = it.detail;
      body.appendChild(detail);
    }
    label.append(cb, body);
    li.appendChild(label);
    syncReviewList.appendChild(li);
  }
  updateSyncReviewCount();
}

function setPlanReviewOpen(open) {
  if (!planReviewOverlay) return;
  planReviewOverlay.hidden = !open;
  updateGameInputBlock();
}

function planFromEvent(ev) {
  if (!ev || typeof ev !== "object") return null;
  if (Array.isArray(ev.steps) || ev.title || ev.goal) {
    return {
      title: String(ev.title || "Plan").trim() || "Plan",
      goal: String(ev.goal || "").trim(),
      approach: String(ev.approach || "").trim(),
      steps: Array.isArray(ev.steps) ? ev.steps : [],
      risks: Array.isArray(ev.risks) ? ev.risks : [],
      verify: String(ev.verify || "").trim(),
    };
  }
  if (ev.plan && typeof ev.plan === "object") return planFromEvent(ev.plan);
  return null;
}

function selectedPlanSteps() {
  if (!planReviewList || !lastChatPlan) return [];
  return [...planReviewList.querySelectorAll("input[type=checkbox]:checked")]
    .map((el) => lastChatPlan.steps.find((it) => it.id === el.value))
    .filter(Boolean);
}

function unselectedPlanSteps() {
  if (!planReviewList || !lastChatPlan) return [];
  return [...planReviewList.querySelectorAll("input[type=checkbox]:not(:checked)")]
    .map((el) => lastChatPlan.steps.find((it) => it.id === el.value))
    .filter(Boolean);
}

function updatePlanReviewCount() {
  if (!planReviewCount || !planReviewApply) return;
  const total = lastChatPlan?.steps?.length || 0;
  const n = selectedPlanSteps().length;
  planReviewCount.textContent = total ? `${n} / ${total} selected` : "";
  planReviewApply.disabled = n === 0;
}

function appendPlanBlock(parent, label, text) {
  if (!text) return;
  const block = document.createElement("div");
  block.className = "plan-review__block";
  const h = document.createElement("h3");
  h.textContent = label;
  const p = document.createElement("p");
  p.textContent = text;
  block.append(h, p);
  parent.appendChild(block);
}

function renderPlanReview(plan) {
  lastChatPlan = plan && typeof plan === "object" ? plan : null;
  if (planReviewTitle) planReviewTitle.textContent = lastChatPlan?.title || "Plan";
  if (planReviewMeta) {
    planReviewMeta.replaceChildren();
    if (lastChatPlan) {
      appendPlanBlock(planReviewMeta, "Goal", lastChatPlan.goal);
      appendPlanBlock(planReviewMeta, "Approach", lastChatPlan.approach);
      const risks = lastChatPlan.risks || [];
      if (risks.length) {
        const block = document.createElement("div");
        block.className = "plan-review__block";
        const h = document.createElement("h3");
        h.textContent = "Risks";
        const ul = document.createElement("ul");
        ul.className = "plan-review__risks";
        for (const risk of risks) {
          const li = document.createElement("li");
          li.textContent = risk;
          ul.appendChild(li);
        }
        block.append(h, ul);
        planReviewMeta.appendChild(block);
      }
    }
  }
  if (planReviewVerify) {
    const verify = lastChatPlan?.verify || "";
    planReviewVerify.hidden = !verify;
    planReviewVerify.textContent = verify ? `Verify: ${verify}` : "";
  }
  if (!planReviewList) return;
  planReviewList.replaceChildren();
  const steps = lastChatPlan?.steps || [];
  if (planReviewEmpty) planReviewEmpty.hidden = steps.length > 0;
  planReviewList.hidden = steps.length === 0;
  for (const it of steps) {
    const li = document.createElement("li");
    const label = document.createElement("label");
    label.className = "sync-review__item";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = true;
    cb.value = it.id;
    cb.addEventListener("change", updatePlanReviewCount);
    const body = document.createElement("div");
    const title = document.createElement("div");
    title.className = "sync-review__title";
    title.textContent = it.title;
    const meta = document.createElement("div");
    meta.className = "sync-review__meta";
    if (it.file) {
      const chip = document.createElement("span");
      chip.className = "sync-review__chip";
      chip.textContent = shortPath(it.file);
      meta.appendChild(chip);
    }
    body.appendChild(title);
    if (meta.childNodes.length) body.appendChild(meta);
    if (it.detail) {
      const detail = document.createElement("p");
      detail.className = "sync-review__detail";
      detail.textContent = it.detail;
      body.appendChild(detail);
    }
    label.append(cb, body);
    li.appendChild(label);
    planReviewList.appendChild(li);
  }
  updatePlanReviewCount();
}

function presentChatPlan(plan) {
  renderPlanReview(plan);
  setApplyPlanVisible(true);
  setPlanReviewOpen(true);
}

function discardChatPlan() {
  lastChatPlan = null;
  setPlanReviewOpen(false);
  setApplyPlanVisible(false);
  appendChat("sys", "Plan discarded.");
}

function formatPlanStepLines(steps, heading) {
  if (!steps.length) return [`${heading}: (none)`];
  const lines = [`${heading}:`];
  steps.forEach((s, i) => {
    lines.push(`${i + 1}. ${s.title || s.id || "Step"}`);
    if (s.id) lines.push(`   id: ${s.id}`);
    if (s.file) lines.push(`   file: ${s.file}`);
    if (s.detail) lines.push(`   ${s.detail}`);
  });
  return lines;
}

function formatChatPlanRevision(plan, keepSteps, dropSteps, feedback) {
  return [
    "Revise the current implementation plan. Return a full replacement JSON checklist.",
    plan?.title ? `Title: ${plan.title}` : "",
    plan?.goal ? `Goal: ${plan.goal}` : "",
    plan?.approach ? `Approach: ${plan.approach}` : "",
    "",
    ...formatPlanStepLines(keepSteps, "KEEP these steps (copy them forward unless the note explicitly changes one)"),
    "",
    ...formatPlanStepLines(dropSteps, "DROP these steps (do not include them)"),
    "",
    "User feedback (add / change):",
    String(feedback || "").trim(),
    "",
    "Keep the KEEP steps intact unless the feedback edits one of them. Add new steps for the feedback. Do not revive dropped steps. No code samples.",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function formatChatPlanForAgent(plan, selectedSteps) {
  const steps = Array.isArray(selectedSteps) ? selectedSteps : plan?.steps || [];
  const lines = [
    `Implement this approved plan${plan?.title ? `: ${plan.title}` : ""}.`,
    "Follow only the selected steps. Do not add extra features.",
  ];
  if (plan?.goal) lines.push("", "Goal:", plan.goal);
  if (plan?.approach) lines.push("", "Approach:", plan.approach);
  if (steps.length) {
    lines.push("", "Steps:");
    steps.forEach((s, i) => {
      lines.push(`${i + 1}. ${s.title || s.id || "Step"}`);
      if (s.file) lines.push(`   file: ${s.file}`);
      if (s.detail) lines.push(`   ${s.detail}`);
    });
  }
  if (plan?.verify) lines.push("", "Verify in play:", plan.verify);
  return lines.join("\n");
}

function summarizeChatPlan(plan) {
  const title = plan?.title || "Plan ready";
  const n = plan?.steps?.length || 0;
  if (!n) return `${title}. No steps to apply — Discard or try Plan again.`;
  return `${title}. ${n} step${n === 1 ? "" : "s"} — revise below, Apply selected, or Discard.`;
}

async function applySelectedPlan() {
  if (!sessionId) return appendChat("sys", "Generate Final or Continue first.");
  const selected = selectedPlanSteps();
  if (!selected.length || !lastChatPlan) return;
  const plan = lastChatPlan;
  const n = selected.length;
  const message = formatChatPlanForAgent(plan, selected);
  lastChatPlan = null;
  setPlanReviewOpen(false);
  setApplyPlanVisible(false);
  setChatMode("agent");
  await sendChatTurn(message, {
    displayText: `Apply plan: ${plan.title || "Plan"} (${n} step${n === 1 ? "" : "s"})`,
  });
}

async function reviseChatPlan(feedback) {
  const note = String(feedback || "").trim();
  if (!note) return;
  if (!sessionId) return appendChat("sys", "Generate Final or Continue first.");
  if (!lastChatPlan) return appendChat("sys", "No plan to revise yet.");
  const keep = selectedPlanSteps();
  const drop = unselectedPlanSteps();
  const message = formatChatPlanRevision(lastChatPlan, keep, drop, note);
  if (planReviewInput) planReviewInput.value = "";
  setPlanReviewOpen(false);
  setChatMode("plan");
  await sendChatTurn(message, { displayText: `Revise plan: ${note}` });
  if (lastChatPlan && planReviewOverlay?.hidden) {
    renderPlanReview(lastChatPlan);
    setApplyPlanVisible(true);
    setPlanReviewOpen(true);
  }
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
    applyChatDrawerWidth(readChatDrawerWidth());
    syncChatProviderControls();
    requestAnimationFrame(() => chatInput?.focus?.());
  } else if (!playEl.hidden) {
    requestAnimationFrame(() => canvas?.focus?.());
  }
}

const CHAT_WIDTH_KEY = "plab.chatWidth";
const CHAT_WIDTH_MIN = 280;
const CHAT_WIDTH_MAX = 720;
const CHAT_WIDTH_DEFAULT = 400;

function clampChatWidth(px) {
  const vw = Math.max(320, window.innerWidth || 800);
  const max = Math.min(CHAT_WIDTH_MAX, Math.floor(vw * 0.92));
  return Math.max(CHAT_WIDTH_MIN, Math.min(max, Math.round(px)));
}

function readChatDrawerWidth() {
  const raw = Number(localStorage.getItem(CHAT_WIDTH_KEY));
  if (Number.isFinite(raw) && raw > 0) return clampChatWidth(raw);
  return CHAT_WIDTH_DEFAULT;
}

function applyChatDrawerWidth(px) {
  if (!chatDrawer) return;
  const w = clampChatWidth(px);
  chatDrawer.style.setProperty("--chat-w", `${w}px`);
  return w;
}

function bindChatDrawerResize() {
  if (!chatResizeHandle || !chatDrawer) return;
  let dragging = false;

  function onMove(e) {
    if (!dragging) return;
    const x = e.touches?.[0]?.clientX ?? e.clientX;
    const next = clampChatWidth(window.innerWidth - x);
    applyChatDrawerWidth(next);
  }

  function onUp() {
    if (!dragging) return;
    dragging = false;
    chatDrawer.classList.remove("is-resizing");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    const w = readComputedChatWidth();
    localStorage.setItem(CHAT_WIDTH_KEY, String(w));
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
  }

  function readComputedChatWidth() {
    const raw = getComputedStyle(chatDrawer).getPropertyValue("--chat-w").trim();
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? clampChatWidth(n) : CHAT_WIDTH_DEFAULT;
  }

  chatResizeHandle.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragging = true;
    chatDrawer.classList.add("is-resizing");
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    chatResizeHandle.setPointerCapture?.(e.pointerId);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  });

  window.addEventListener("resize", () => {
    if (!chatDrawer.hidden) applyChatDrawerWidth(readChatDrawerWidth());
  });

  applyChatDrawerWidth(readChatDrawerWidth());
}

bindChatDrawerResize();

function logStart(line) {
  startLog.hidden = false;
  startLog.textContent += `${line}\n`;
  startLog.scrollTop = startLog.scrollHeight;
}

function setPlayStatus(text, show = true) {
  playStatus.hidden = !show;
  playStatus.textContent = text || "";
}

function updateSessionTddBadge(slug) {
  const badge = document.getElementById("sessionTddBadge");
  if (!badge) return;
  if (!slug) {
    badge.hidden = true;
    badge.textContent = "";
    return;
  }
  const t = tdds.find((x) => x.slug === slug);
  badge.textContent = t ? `${t.projectName} · ${slug}` : slug;
  badge.hidden = false;
}

function appendChat(role, text, { mode } = {}) {
  if (!text) return;
  const div = document.createElement("div");
  div.className = `chat-msg chat-msg--${role}`;
  if (mode === "ask" || mode === "agent" || mode === "plan") {
    div.dataset.mode = mode;
    const mark = document.createElement("span");
    mark.className = `chat-msg__mark chat-msg__mark--${mode}`;
    mark.title = chatModeLabel(mode);
    mark.setAttribute("aria-label", chatModeLabel(mode));
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
    .replace(/^\s*\[(Agent|Ask|Plan)\]\s*/i, "")
    .replace(/^\s*(Agent|Ask|Plan)\s*:\s*/i, "")
    .trim();
}

function collapseChatWhitespace(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

/**
 * Pick one final reply from streamed assistant events.
 * Cursor often sends growing snapshots (`**Biol**` → `**Biolum**`) that are NOT
 * strict prefixes — never concatenate those or the chat turns into gibberish.
 */
function mergeAssistantChunks(chunks, { isUserEcho }) {
  const parts = [];
  for (const raw of chunks) {
    const chunk = stripModeEcho(String(raw || "")).trim();
    if (!chunk || isUserEcho(chunk)) continue;
    parts.push(chunk);
  }
  if (!parts.length) return "";
  if (parts.length === 1) return collapseChatWhitespace(parts[0]);

  const longest = parts.reduce((a, b) => (a.length >= b.length ? a : b));
  const last = parts[parts.length - 1];
  // Prefer the last snapshot when it's basically the full answer
  if (last.length >= Math.max(48, longest.length * 0.7)) {
    return collapseChatWhitespace(last);
  }
  return collapseChatWhitespace(longest);
}

function createChatRunCollector(userMessage = "") {
  const assistantChunks = [];
  const writtenFiles = new Set();
  let hadError = false;
  let errorMessage = "";
  let mode = "agent";
  let resumable = false;
  let checkpointTurn = null;
  let planProposal = null;
  const userNorm = stripModeEcho(userMessage).toLowerCase();

  function isUserEcho(text) {
    const t = stripModeEcho(text);
    if (!t) return true;
    if (/^\[(Agent|Ask|Plan)\]/i.test(String(text || "").trim())) return true;
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
        const fromDone = planFromEvent(ev.plan);
        if (fromDone) planProposal = fromDone;
      }
      if (ev.type === "plan-proposal") {
        const fromEv = planFromEvent(ev);
        if (fromEv) planProposal = fromEv;
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
      const text = mergeAssistantChunks(assistantChunks, { isUserEcho });

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
        if (mode === "plan") {
          return "Plan finished with no readable reply. Try again or switch provider/model.";
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
    get planProposal() {
      return planProposal;
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
    setApplyPlanVisible(false);
  }
}

function setApplyPlanVisible(show) {
  if (!chatApplyPlanBtn) return;
  chatApplyPlanBtn.hidden = !show;
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
  if (ev.type === "session" && ev.sessionId) {
    sessionId = ev.sessionId;
    if (ev.slug) {
      sessionSlug = ev.slug;
      updateSessionTddBadge(ev.slug);
    }
  }
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
    const showDigest = digest && digest !== lastAdviceDigestShown;
    if (showDigest && chat) appendChat("sys", digest);
    else if (showDigest && !chat) {
      appendChat("sys", digest);
    }
    if (showDigest) lastAdviceDigestShown = digest;
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
    setPingBusy(true);
    modelSelect.innerHTML = "";
    providerHint.textContent = "";
    return;
  }

  generateBtn.disabled = false;
  setPingBusy(false);
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
    chatModeBlurb.textContent = chatModeBlurbText();
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
  chatMode = normalizeChatMode(mode);
  try {
    localStorage.setItem(CHAT_MODE_KEY, chatMode);
  } catch {
    /* */
  }
  chatModeAgent?.classList.toggle("is-active", chatMode === "agent");
  chatModeAsk?.classList.toggle("is-active", chatMode === "ask");
  chatModePlan?.classList.toggle("is-active", chatMode === "plan");
  chatDrawer?.classList.toggle("chat-drawer--ask", chatMode === "ask");
  chatDrawer?.classList.toggle("chat-drawer--plan", chatMode === "plan");
  if (chatModeTriggerText) {
    chatModeTriggerText.textContent = chatModeLabel(chatMode);
  }
  if (chatModeBlurb) {
    chatModeBlurb.textContent = chatModeBlurbText(chatMode);
  }
  if (chatInput) {
    chatInput.placeholder = chatModePlaceholder(chatMode);
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

function setPingBusy(busy) {
  if (pingModelBtn) pingModelBtn.disabled = busy;
  if (pingModelsBtn) pingModelsBtn.disabled = busy;
}

function setPingStatus(text, kind = "") {
  if (!pingStatus) return;
  pingStatus.hidden = !text;
  pingStatus.textContent = text || "";
  pingStatus.classList.remove("ping-status--ok", "ping-status--fail", "ping-status--busy");
  if (kind) pingStatus.classList.add(`ping-status--${kind}`);
}

function clearPingModelList() {
  if (!pingModelList) return;
  pingModelList.replaceChildren();
  pingModelList.hidden = true;
}

function renderPingModelList(results) {
  if (!pingModelList) return;
  pingModelList.replaceChildren();
  if (!results?.length) {
    pingModelList.hidden = true;
    return;
  }
  pingModelList.hidden = false;
  for (const row of results) {
    const li = document.createElement("li");
    const mark = document.createElement("span");
    mark.className = `ping-model-list__mark ping-model-list__mark--${row.ok ? "ok" : "fail"}`;
    mark.textContent = row.ok ? "ok" : "fail";
    const model = document.createElement("span");
    model.className = "ping-model-list__model";
    model.textContent = row.model || "—";
    model.title = row.error || row.note || "";
    const meta = document.createElement("span");
    meta.className = "ping-model-list__meta";
    meta.textContent = row.ok
      ? `${row.ms ?? "?"}ms`
      : String(row.error || `HTTP ${row.status || "?"}`).slice(0, 48);
    li.append(mark, model, meta);
    pingModelList.appendChild(li);
  }
}

async function pingSelectedModel() {
  const id = providerSelect?.value;
  const model = selectedModelValue();
  if (!id || !model) {
    setPingStatus("Pick a provider and model first.", "fail");
    return;
  }
  clearPingModelList();
  setPingBusy(true);
  setPingStatus(`Pinging ${id} / ${model}…`, "busy");
  try {
    const res = await fetch("/api/agent/ping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, model }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok && data.ok !== true) {
      setPingStatus(data.error || `Ping failed (${res.status})`, "fail");
      return;
    }
    if (data.ok) {
      const note = data.note ? ` · ${data.note}` : "";
      setPingStatus(`OK · ${data.label || id} / ${data.model} · ${data.ms}ms${note}`, "ok");
    } else {
      setPingStatus(
        `Fail · ${data.label || id} / ${data.model || model} · ${data.error || "no response"} (${data.ms ?? "?"}ms)`,
        "fail",
      );
    }
    renderPingModelList([data]);
  } catch (err) {
    setPingStatus(String(err.message || err), "fail");
  } finally {
    setPingBusy(false);
  }
}

async function pingAllSuggestedModels() {
  const id = providerSelect?.value;
  if (!id) {
    setPingStatus("Pick a provider first.", "fail");
    return;
  }
  const p = currentProvider();
  const models = [];
  const seen = new Set();
  const push = (m) => {
    const v = String(m || "").trim();
    if (!v || seen.has(v)) return;
    seen.add(v);
    models.push(v);
  };
  push(selectedModelValue());
  for (const m of p?.suggestedModels || []) push(m);
  clearPingModelList();
  setPingBusy(true);
  setPingStatus(`Pinging ${models.length} model${models.length === 1 ? "" : "s"} on ${p?.label || id}…`, "busy");
  try {
    const res = await fetch("/api/agent/ping-models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, models }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setPingStatus(data.error || `Ping failed (${res.status})`, "fail");
      return;
    }
    const ok = data.okCount || 0;
    const fail = data.failCount || 0;
    setPingStatus(
      `${data.label || id}: ${ok} ok · ${fail} fail`,
      fail && !ok ? "fail" : fail ? "busy" : "ok",
    );
    renderPingModelList(data.results || []);
  } catch (err) {
    setPingStatus(String(err.message || err), "fail");
  } finally {
    setPingBusy(false);
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
    status: "Copying gameplay + runtime…",
  });
  appendWorkLog(`target: ${destination || suggested}`);
  try {
    const body = destination ? { destination } : {};
    const result = await apiJson(`/api/tdds/${encodeURIComponent(slug)}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setWorkStatus(`Exported · ${result.filesCopied} files`);
    appendWorkLog(`copied ${result.filesCopied} files`);
    appendWorkLog(result.destination);
    appendWorkLog("cd into that folder → node server.mjs → http://127.0.0.1:8080/");
    setTimeout(hideWorkOverlay, 2200);
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
  updateSessionTddBadge(useSlug);

  const needSession =
    resume || !sessionId || (sessionSlug != null && sessionSlug !== useSlug);
  if (needSession) {
    const res = await fetch("/api/sessions/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: useSlug }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Resume failed");
    sessionId = data.sessionId;
    sessionSlug = data.slug || useSlug;
    lastAdviceDigestShown = "";
  } else if (!sessionSlug) {
    sessionSlug = useSlug;
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
chatModePlan?.addEventListener("click", (e) => {
  e.preventDefault();
  setChatMode("plan");
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
  sessionSlug = null;
  lastAdviceDigestShown = "";
  updateSessionTddBadge(null);
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

pingModelBtn?.addEventListener("click", () => pingSelectedModel());
pingModelsBtn?.addEventListener("click", () => pingAllSuggestedModels());

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

function setPlayMenuOpen(open) {
  if (!playMenuPopover || !playMenuTrigger) return;
  playMenuPopover.hidden = !open;
  playMenuTrigger.setAttribute("aria-expanded", open ? "true" : "false");
}

function isPlayMenuOpen() {
  return playMenuPopover && !playMenuPopover.hidden;
}

playMenuTrigger?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  setPlayMenuOpen(!isPlayMenuOpen());
});

playMenuPopover?.addEventListener("click", (e) => {
  e.stopPropagation();
  const item = e.target.closest?.(".play-menu__item");
  if (item) setPlayMenuOpen(false);
});

document.addEventListener("click", (e) => {
  if (!isPlayMenuOpen()) return;
  if (playMenu?.contains(e.target)) return;
  setPlayMenuOpen(false);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && isPlayMenuOpen()) setPlayMenuOpen(false);
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

/** Left Shift held — used for Shift+Tab Agent/Ask/Plan cycle (chat open only). */
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
    setChatMode(cycleChatMode(chatMode));
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
    if (syncReviewOverlay && !syncReviewOverlay.hidden) {
      setSyncReviewOpen(false);
      return;
    }
    if (planReviewOverlay && !planReviewOverlay.hidden) {
      setPlanReviewOpen(false);
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
  resizeChatInput();
  await sendChatTurn(message);
});

function resizeChatInput() {
  if (!chatInput) return;
  chatInput.style.height = "0px";
  const scroll = chatInput.scrollHeight;
  const max = Math.min(window.innerHeight * 0.48, 256);
  chatInput.style.height = `${Math.min(Math.max(scroll, 22), max)}px`;
  chatInput.style.overflowY = scroll > max ? "auto" : "hidden";
}

chatInput?.addEventListener("input", resizeChatInput);
chatInput?.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.shiftKey) return;
  e.preventDefault();
  chatForm?.requestSubmit?.();
});
resizeChatInput();

async function sendChatTurn(message, { displayText } = {}) {
  const mode = chatMode;
  appendChat("user", displayText || message, { mode });
  setChatContinueVisible(null);
  if (mode !== "plan") setApplyPlanVisible(false);
  const runNotes = createChatRunCollector(message);
  showWorkOverlay({
    title:
      mode === "ask"
        ? "Ask (read-only)"
        : mode === "plan"
          ? "Plan (read-only)"
          : "Chat iteration",
    eyebrow: chatModeLabel(mode),
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
        body: JSON.stringify({ message, mode }),
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
    if (mode === "plan" && !chatFailed && !runNotes.hadError) {
      const plan = runNotes.planProposal;
      if (plan && (plan.steps?.length || plan.goal || plan.title)) {
        presentChatPlan(plan);
        appendChat("assistant", summarizeChatPlan(plan), { mode: "plan" });
        return;
      }
      if (lastChatPlan) setApplyPlanVisible(true);
      appendChat("assistant", "No checklist came back. Try Plan again.", { mode: "plan" });
      return;
    }
    if (mode === "agent" && !chatFailed && !runNotes.hadError && runNotes.wroteFiles) {
      schedulePlayableReload({
        assistantReply: reply,
        openChat: true,
      });
      return;
    }
    if (mode === "agent" && !chatFailed && !runNotes.hadError) {
      await mountGame();
    }
    appendChat("assistant", reply, { mode });
  } catch (err) {
    if (err.name === "AbortError") {
      await new Promise((r) => setTimeout(r, 150));
      await refreshCheckpointButton();
      return;
    }
    appendChat("sys", String(err.message || err));
    hideWorkOverlay();
  }
}

chatApplyPlanBtn?.addEventListener("click", () => {
  if (!lastChatPlan) return appendChat("sys", "No plan to review yet.");
  renderPlanReview(lastChatPlan);
  setPlanReviewOpen(true);
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
    if (mode === "plan" && !chatFailed && !runNotes.hadError) {
      const plan = runNotes.planProposal;
      if (plan && (plan.steps?.length || plan.goal || plan.title)) {
        presentChatPlan(plan);
        appendChat("assistant", summarizeChatPlan(plan), { mode: "plan" });
        return;
      }
    }
    if (mode === "agent" && !chatFailed && !runNotes.hadError && runNotes.wroteFiles) {
      schedulePlayableReload({
        assistantReply: reply,
        openChat: true,
      });
      return;
    }
    if (mode === "agent" && !chatFailed && !runNotes.hadError) {
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
  syncProposalMeta = { summary, chatDigest };
  showWorkOverlay({
    title: "Review TDD changes",
    eyebrow: "Preview",
    status: "Comparing playable vs TDD…",
  });
  try {
    let items = [];
    await readSSE(
      `/api/sessions/${sessionId}/sync-tdd/preview`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary, chatDigest }),
      },
      (ev) => {
        if (ev?.type === "sync-proposal" && Array.isArray(ev.items)) items = ev.items;
        handleWorkEvent(ev);
      },
    );
    hideWorkOverlay();
    renderSyncReview(items);
    setSyncReviewOpen(true);
  } catch (err) {
    if (err.name === "AbortError") return;
    setWorkStatus(String(err.message || err));
    appendWorkLog(String(err.message || err));
    setTimeout(hideWorkOverlay, 800);
  }
});

async function applySelectedSync() {
  if (!sessionId) return;
  const selectedItems = selectedSyncItems();
  if (!selectedItems.length) return;
  setSyncReviewOpen(false);
  showWorkOverlay({
    title: "Sync TDD",
    eyebrow: "Writing",
    status: `Applying ${selectedItems.length} selected change${selectedItems.length === 1 ? "" : "s"}…`,
  });
  try {
    await readSSE(
      `/api/sessions/${sessionId}/sync-tdd`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: syncProposalMeta.summary,
          chatDigest: syncProposalMeta.chatDigest,
          selectedItems,
        }),
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
}

syncReviewClose?.addEventListener("click", () => setSyncReviewOpen(false));
syncReviewCancel?.addEventListener("click", () => setSyncReviewOpen(false));
syncReviewOverlay?.addEventListener("click", (e) => {
  if (e.target === syncReviewOverlay) setSyncReviewOpen(false);
});
syncReviewApply?.addEventListener("click", () => applySelectedSync());
syncReviewAll?.addEventListener("click", () => {
  for (const el of syncReviewList?.querySelectorAll("input[type=checkbox]") || []) el.checked = true;
  updateSyncReviewCount();
});
syncReviewNone?.addEventListener("click", () => {
  for (const el of syncReviewList?.querySelectorAll("input[type=checkbox]") || []) el.checked = false;
  updateSyncReviewCount();
});

planReviewClose?.addEventListener("click", () => setPlanReviewOpen(false));
planReviewOverlay?.addEventListener("click", (e) => {
  if (e.target === planReviewOverlay) setPlanReviewOpen(false);
});
planReviewDiscard?.addEventListener("click", () => discardChatPlan());
planReviewApply?.addEventListener("click", () => applySelectedPlan());
planReviewAll?.addEventListener("click", () => {
  for (const el of planReviewList?.querySelectorAll("input[type=checkbox]") || []) el.checked = true;
  updatePlanReviewCount();
});
planReviewNone?.addEventListener("click", () => {
  for (const el of planReviewList?.querySelectorAll("input[type=checkbox]") || []) el.checked = false;
  updatePlanReviewCount();
});
planReviewForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const note = planReviewInput?.value.trim();
  if (!note) return;
  await reviseChatPlan(note);
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
  setChatMode(normalizeChatMode(localStorage.getItem(CHAT_MODE_KEY)));
} catch {
  setChatMode("agent");
}
skyIcon.innerHTML = ICON_SUN;
setChatOpen(false);
await maybeResumeAfterReload();
