import fs from "node:fs/promises";
import path from "node:path";

/**
 * List relative paths under public/gameplay/ for sync evidence prompts.
 * @param {string} root
 * @returns {Promise<string[]>}
 */
export async function listGameplayFiles(root) {
  const gameplayDir = path.join(root, "public", "gameplay");
  const out = [];
  async function walk(dir, prefix = "public/gameplay") {
    let entries = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (ent.name.startsWith(".")) continue;
      const rel = `${prefix}/${ent.name}`;
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) await walk(abs, rel);
      else if (ent.isFile() && /\.(js|json|yaml|yml|md)$/i.test(ent.name)) out.push(rel);
    }
  }
  await walk(gameplayDir);
  return out.sort();
}

/**
 * @param {{ role: string, message: string }[]} history
 * @param {string} [clientDigest]
 * @param {number} [limit]
 */
export function mergeChatDigest(history = [], clientDigest = "", limit = 16) {
  const serverLines = history
    .slice(-limit)
    .map((h) => {
      const text = String(h.message || "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 320);
      return text ? `${h.role || "user"}: ${text}` : "";
    })
    .filter(Boolean);

  const client = String(clientDigest || "").trim();
  if (serverLines.length && client) {
    return `${client}\n\n--- session history ---\n${serverLines.join("\n")}`;
  }
  if (client) return client;
  if (serverLines.length) return serverLines.join("\n");
  return "";
}

const SYNC_KINDS = new Set(["mechanic", "number", "input", "camera", "hud", "loop", "other"]);

function tryParseJsonBlob(raw) {
  const t = String(raw || "").trim();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    /* fall through */
  }
  const startObj = t.indexOf("{");
  const startArr = t.indexOf("[");
  let start = -1;
  if (startObj >= 0 && (startArr < 0 || startObj < startArr)) start = startObj;
  else if (startArr >= 0) start = startArr;
  if (start < 0) return null;
  const endObj = t.lastIndexOf("}");
  const endArr = t.lastIndexOf("]");
  const end = Math.max(endObj, endArr);
  if (end <= start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeSyncItem(it, index) {
  if (!it || typeof it !== "object") return null;
  const title = String(it.title || it.name || "").trim().slice(0, 160);
  if (!title) return null;
  const kindRaw = String(it.kind || "other").toLowerCase().trim();
  const kind = SYNC_KINDS.has(kindRaw) ? kindRaw : "other";
  return {
    id: String(it.id || `change-${index + 1}`)
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80) || `change-${index + 1}`,
    kind,
    title,
    section: String(it.section || "").trim().slice(0, 80),
    detail: String(it.detail || it.summary || it.description || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 600),
  };
}

/**
 * Parse model output into a Sync TDD checklist.
 * @param {string} raw
 * @returns {{ items: { id: string, kind: string, title: string, section: string, detail: string }[] }}
 */
export function parseSyncProposal(raw) {
  const text = String(raw || "");
  const fenced = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((m) => m[1]);
  const candidates = [...fenced, text];
  for (let i = candidates.length - 1; i >= 0; i--) {
    const parsed = tryParseJsonBlob(candidates[i]);
    if (!parsed) continue;
    const list = Array.isArray(parsed) ? parsed : parsed.items;
    if (!Array.isArray(list)) continue;
    const items = list
      .slice(0, 40)
      .map((it, idx) => normalizeSyncItem(it, idx))
      .filter(Boolean);
    const seen = new Set();
    const unique = [];
    for (const it of items) {
      let id = it.id;
      let n = 2;
      while (seen.has(id)) {
        id = `${it.id}-${n++}`;
      }
      seen.add(id);
      unique.push({ ...it, id });
    }
    return { items: unique };
  }
  return { items: [] };
}

/**
 * @param {{ id?: string, title?: string, kind?: string, section?: string, detail?: string }[]} items
 */
export function formatSelectedSyncItems(items = []) {
  if (!items.length) return "";
  return items
    .map((it, i) => {
      const title = String(it.title || it.id || `Item ${i + 1}`).trim();
      const bits = [
        `${i + 1}. ${title}`,
        it.kind ? `   kind: ${it.kind}` : "",
        it.section ? `   section: ${it.section}` : "",
        it.detail ? `   ${String(it.detail).trim()}` : "",
      ].filter(Boolean);
      return bits.join("\n");
    })
    .join("\n");
}

function uniqueIds(items, key = "id") {
  const seen = new Set();
  const unique = [];
  for (const it of items) {
    let id = it[key];
    let n = 2;
    while (seen.has(id)) id = `${it[key]}-${n++}`;
    seen.add(id);
    unique.push({ ...it, [key]: id });
  }
  return unique;
}

function normalizePlanStep(it, index) {
  if (!it || typeof it !== "object") return null;
  const title = String(it.title || it.name || "").trim().slice(0, 140);
  if (!title) return null;
  return {
    id: String(it.id || `step-${index + 1}`)
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80) || `step-${index + 1}`,
    file: String(it.file || it.path || "")
      .trim()
      .replace(/\\/g, "/")
      .slice(0, 120),
    title,
    detail: String(it.detail || it.summary || it.description || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 400),
  };
}

/**
 * Parse model output into a Plan checklist for the review modal.
 * @param {string} raw
 * @returns {{ title: string, goal: string, approach: string, steps: object[], risks: string[], verify: string }}
 */
export function parseChatPlan(raw) {
  const text = String(raw || "");
  const fenced = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((m) => m[1]);
  const candidates = [...fenced, text];
  for (let i = candidates.length - 1; i >= 0; i--) {
    const parsed = tryParseJsonBlob(candidates[i]);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
    const list = Array.isArray(parsed.steps) ? parsed.steps : Array.isArray(parsed.items) ? parsed.items : [];
    const steps = uniqueIds(
      list.slice(0, 16).map((it, idx) => normalizePlanStep(it, idx)).filter(Boolean),
    );
    const risks = Array.isArray(parsed.risks)
      ? parsed.risks.map((r) => String(r || "").trim().replace(/\s+/g, " ").slice(0, 240)).filter(Boolean).slice(0, 5)
      : [];
    return {
      title: String(parsed.title || parsed.goal || "Implementation plan").trim().slice(0, 120),
      goal: String(parsed.goal || "").trim().replace(/\s+/g, " ").slice(0, 400),
      approach: String(parsed.approach || "").trim().replace(/\s+/g, " ").slice(0, 400),
      steps,
      risks,
      verify: String(parsed.verify || parsed.how || "").trim().replace(/\s+/g, " ").slice(0, 400),
    };
  }
  const fallback = text.trim().replace(/\s+/g, " ").slice(0, 800);
  if (!fallback) {
    return { title: "Implementation plan", goal: "", approach: "", steps: [], risks: [], verify: "" };
  }
  return {
    title: "Implementation plan",
    goal: fallback.slice(0, 400),
    approach: "",
    steps: [
      {
        id: "step-1",
        file: "",
        title: "Apply the plan as described",
        detail: fallback.slice(0, 400),
      },
    ],
    risks: [],
    verify: "",
  };
}

/**
 * @param {{ title?: string, goal?: string, approach?: string, verify?: string, steps?: object[] }} plan
 * @param {object[]} [selectedSteps]
 */
export function formatChatPlanForAgent(plan, selectedSteps) {
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
