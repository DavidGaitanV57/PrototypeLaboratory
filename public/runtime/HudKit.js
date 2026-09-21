/**
 * DOM HUD kit — arcade-readable panels without external UI frameworks.
 * Mount inside `hudRoot` from gameplay mount(). Avoid bottom-right (lab chrome).
 *
 * Theming: same layout/API; skin via CSS variables. Default is `arcade` (party/kart).
 * Pass `createHud(root, { theme: "liminal" })` or a partial token map from the TDD palette.
 */

const STYLE_ID = "plab-hudkit-styles";

const BASE_CSS = `
.plab-hud {
  position: absolute; inset: 0; pointer-events: none; z-index: 2;
  font-family: var(--hud-font, "Arial Black", Arial, sans-serif);
  color: var(--hud-text, #fff);
  --hud-panel-bg: rgba(0,0,0,0.55);
  --hud-border: 3px solid #fff;
  --hud-radius: 12px;
  --hud-shadow: 2px 2px 0 #000, -1px -1px 0 #000;
  --hud-bar-track: #333;
  --hud-bar-fill: linear-gradient(90deg,#4caf50,#ffeb3b 60%,#f44336);
  --hud-toast-bg: rgba(255,152,0,0.95);
  --hud-toast-border: 4px solid #fff;
  --hud-overlay-bg: rgba(0,0,0,0.85);
  --hud-overlay-title: #ffd700;
  --hud-btn-bg: #e91e63;
  --hud-btn-border: 3px solid #fff;
  --hud-accent: #ffd700;
  --hud-hint-bg: rgba(0,0,0,0.55);
  --hud-minimap-bg: rgba(0,40,0,0.4);
  --hud-panel-opacity: 1;
}
.plab-hud * { box-sizing: border-box; }
.plab-hud__panel {
  background: var(--hud-panel-bg); border: var(--hud-border); border-radius: var(--hud-radius);
  padding: 8px 16px; text-shadow: var(--hud-shadow); opacity: var(--hud-panel-opacity);
}
.plab-hud__label { font-size: 11px; letter-spacing: 1px; opacity: 0.95; }
.plab-hud__value { font-size: 28px; font-weight: 900; line-height: 1.1; }
.plab-hud__value--lg { font-size: 42px; }
.plab-hud__value--sm { font-size: 18px; }
.plab-hud__bar { margin-top: 6px; width: 100%; height: 10px; background: var(--hud-bar-track); border-radius: 5px; overflow: hidden; }
.plab-hud__bar-fill { height: 100%; width: 0%; background: var(--hud-bar-fill); transition: width 0.08s linear; }
.plab-hud__toast {
  position: absolute; top: 38%; left: 50%; transform: translateX(-50%) scale(0.9);
  background: var(--hud-toast-bg); border: var(--hud-toast-border); border-radius: var(--hud-radius);
  padding: 12px 28px; font-size: 22px; font-weight: 900; opacity: 0; transition: opacity 0.15s, transform 0.15s;
  text-shadow: var(--hud-shadow);
}
.plab-hud__toast.is-show { opacity: 1; transform: translateX(-50%) scale(1); }
.plab-hud__overlay {
  position: absolute; inset: 0; display: none; flex-direction: column; align-items: center; justify-content: center;
  background: var(--hud-overlay-bg); pointer-events: auto; z-index: 20;
}
.plab-hud__overlay.is-show { display: flex; }
.plab-hud__overlay h2 {
  font-size: 64px; color: var(--hud-overlay-title); margin: 0 0 12px;
  text-shadow: var(--hud-shadow);
}
.plab-hud__overlay p { font-size: 20px; margin: 6px 0; }
.plab-hud__overlay button {
  margin-top: 20px; padding: 12px 36px; font-size: 20px; font-weight: 900;
  background: var(--hud-btn-bg); color: var(--hud-text, #fff);
  border: var(--hud-btn-border); border-radius: var(--hud-radius); cursor: pointer;
}
.plab-hud__hint {
  position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%);
  background: var(--hud-hint-bg); border: var(--hud-border); border-radius: calc(var(--hud-radius) - 2px);
  padding: 6px 14px; font-size: 11px; text-align: center; max-width: 90%;
  text-shadow: var(--hud-shadow); opacity: var(--hud-panel-opacity);
}
.plab-hud__minimap { padding: 6px; }
.plab-hud__minimap canvas { display: block; border-radius: 6px; background: var(--hud-minimap-bg); }
`;

const ANCHORS = {
  "top-left": { top: "18px", left: "18px", right: "auto", bottom: "auto" },
  "top-right": { top: "18px", right: "18px", left: "auto", bottom: "auto" },
  "top-center": { top: "18px", left: "50%", transform: "translateX(-50%)", right: "auto", bottom: "auto" },
  "bottom-left": { bottom: "18px", left: "18px", top: "auto", right: "auto" },
  "bottom-center": { bottom: "18px", left: "50%", transform: "translateX(-50%)", top: "auto", right: "auto" },
};

/** @typedef {{
 *   id?: string,
 *   font?: string,
 *   text?: string,
 *   panelBg?: string,
 *   border?: string,
 *   radius?: string,
 *   shadow?: string,
 *   barTrack?: string,
 *   barFill?: string,
 *   toastBg?: string,
 *   toastBorder?: string,
 *   overlayBg?: string,
 *   overlayTitle?: string,
 *   buttonBg?: string,
 *   buttonBorder?: string,
 *   accent?: string,
 *   hintBg?: string,
 *   minimapBg?: string,
 *   panelOpacity?: string|number,
 * }} HudThemeTokens */

/** Named skins — layout identical; only colors/weight change. */
export const HUD_THEMES = {
  /** Default: kart / party / collector arcade. */
  arcade: {
    id: "arcade",
    font: '"Arial Black", Arial, sans-serif',
    text: "#ffffff",
    panelBg: "rgba(0,0,0,0.55)",
    border: "3px solid #ffffff",
    radius: "12px",
    shadow: "2px 2px 0 #000, -1px -1px 0 #000",
    barTrack: "#333333",
    barFill: "linear-gradient(90deg,#4caf50,#ffeb3b 60%,#f44336)",
    toastBg: "rgba(255,152,0,0.95)",
    toastBorder: "4px solid #ffffff",
    overlayBg: "rgba(0,0,0,0.85)",
    overlayTitle: "#ffd700",
    buttonBg: "#e91e63",
    buttonBorder: "3px solid #ffffff",
    accent: "#ffd700",
    hintBg: "rgba(0,0,0,0.55)",
    minimapBg: "rgba(0,40,0,0.4)",
    panelOpacity: "1",
  },
  /** Alias of arcade for party / kart TDDs. */
  party: null,
  /** Liminal / horror / backrooms — low contrast, quiet chrome. */
  liminal: {
    id: "liminal",
    font: '"Segoe UI", system-ui, sans-serif',
    text: "#e6dcb8",
    panelBg: "rgba(18,16,10,0.38)",
    border: "1px solid rgba(201,180,90,0.32)",
    radius: "4px",
    shadow: "0 0 0 transparent",
    barTrack: "rgba(40,36,24,0.85)",
    barFill: "linear-gradient(90deg,#7A6A48,#C9B45A)",
    toastBg: "rgba(90,82,48,0.92)",
    toastBorder: "1px solid rgba(201,180,90,0.45)",
    overlayBg: "rgba(8,7,5,0.92)",
    overlayTitle: "#C9B45A",
    buttonBg: "#5a5230",
    buttonBorder: "1px solid rgba(201,180,90,0.5)",
    accent: "#C9B45A",
    hintBg: "rgba(18,16,10,0.35)",
    minimapBg: "rgba(30,28,18,0.55)",
    panelOpacity: "0.85",
  },
  /** Soft desaturated chrome when TDD asks quiet UI without full liminal. */
  muted: {
    id: "muted",
    font: '"Segoe UI", system-ui, sans-serif',
    text: "#d8d8d4",
    panelBg: "rgba(12,12,14,0.5)",
    border: "1px solid rgba(255,255,255,0.22)",
    radius: "8px",
    shadow: "0 1px 2px rgba(0,0,0,0.5)",
    barTrack: "#2a2a2e",
    barFill: "linear-gradient(90deg,#6e726e,#9aa0a0)",
    toastBg: "rgba(40,42,44,0.94)",
    toastBorder: "1px solid rgba(255,255,255,0.25)",
    overlayBg: "rgba(0,0,0,0.88)",
    overlayTitle: "#c8c8c4",
    buttonBg: "#3a3c40",
    buttonBorder: "1px solid rgba(255,255,255,0.3)",
    accent: "#9aa0a0",
    hintBg: "rgba(12,12,14,0.45)",
    minimapBg: "rgba(20,22,24,0.55)",
    panelOpacity: "0.9",
  },
  /** Stealth / infiltration — cool, low glow. */
  stealth: {
    id: "stealth",
    font: '"Segoe UI", system-ui, sans-serif',
    text: "#c8e0d8",
    panelBg: "rgba(6,14,12,0.55)",
    border: "1px solid rgba(80,180,140,0.35)",
    radius: "6px",
    shadow: "0 0 8px rgba(40,120,90,0.25)",
    barTrack: "#1a2824",
    barFill: "linear-gradient(90deg,#2e6b55,#5ec49a)",
    toastBg: "rgba(20,48,40,0.94)",
    toastBorder: "1px solid rgba(80,180,140,0.4)",
    overlayBg: "rgba(4,10,8,0.9)",
    overlayTitle: "#5ec49a",
    buttonBg: "#1e4a3a",
    buttonBorder: "1px solid rgba(80,180,140,0.45)",
    accent: "#5ec49a",
    hintBg: "rgba(6,14,12,0.5)",
    minimapBg: "rgba(8,28,22,0.55)",
    panelOpacity: "0.92",
  },
};

HUD_THEMES.party = { ...HUD_THEMES.arcade, id: "party" };

const TOKEN_TO_VAR = {
  font: "--hud-font",
  text: "--hud-text",
  panelBg: "--hud-panel-bg",
  border: "--hud-border",
  radius: "--hud-radius",
  shadow: "--hud-shadow",
  barTrack: "--hud-bar-track",
  barFill: "--hud-bar-fill",
  toastBg: "--hud-toast-bg",
  toastBorder: "--hud-toast-border",
  overlayBg: "--hud-overlay-bg",
  overlayTitle: "--hud-overlay-title",
  buttonBg: "--hud-btn-bg",
  buttonBorder: "--hud-btn-border",
  accent: "--hud-accent",
  hintBg: "--hud-hint-bg",
  minimapBg: "--hud-minimap-bg",
  panelOpacity: "--hud-panel-opacity",
};

/**
 * Resolve a preset name, partial tokens, or `{ preset, ...overrides }`.
 * @param {string|HudThemeTokens|{preset?: string}&HudThemeTokens|null|undefined} theme
 * @returns {HudThemeTokens}
 */
export function resolveHudTheme(theme) {
  if (theme == null || theme === "") return { ...HUD_THEMES.arcade };
  if (typeof theme === "string") {
    const key = theme.toLowerCase().trim();
    const preset = HUD_THEMES[key];
    if (preset) return { ...preset };
    return { ...HUD_THEMES.arcade, id: key };
  }
  const presetName = String(theme.preset || theme.id || "arcade").toLowerCase();
  const base = HUD_THEMES[presetName] ? { ...HUD_THEMES[presetName] } : { ...HUD_THEMES.arcade };
  const { preset: _p, ...rest } = theme;
  return { ...base, ...rest, id: rest.id || base.id || presetName };
}

/**
 * Build a skin from TDD master-palette hexes (optional overrides on a preset).
 * @param {{ accent?: string, panel?: string, text?: string, button?: string, preset?: string }} palette
 */
export function themeFromPalette(palette = {}) {
  const base = resolveHudTheme(palette.preset || "muted");
  const accent = palette.accent || base.accent;
  const out = { ...base, id: "custom" };
  if (accent) {
    out.accent = accent;
    out.overlayTitle = accent;
    out.barFill = `linear-gradient(90deg, ${shadeHex(accent, -0.35)}, ${accent})`;
    out.border = base.border?.includes("solid")
      ? base.border.replace(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/, hexToRgba(accent, 0.4))
      : `1px solid ${hexToRgba(accent, 0.4)}`;
    out.toastBorder = out.border;
    out.buttonBorder = out.border;
    out.buttonBg = shadeHex(accent, -0.45);
    out.toastBg = hexToRgba(shadeHex(accent, -0.4), 0.92);
  }
  if (palette.text) out.text = palette.text;
  if (palette.panel) out.panelBg = palette.panel;
  if (palette.button) out.buttonBg = palette.button;
  return out;
}

function hexToRgba(hex, a = 1) {
  const h = String(hex || "").replace("#", "");
  if (h.length !== 6 && h.length !== 3) return `rgba(0,0,0,${a})`;
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

function shadeHex(hex, amount) {
  const h = String(hex || "").replace("#", "");
  if (h.length !== 6 && h.length !== 3) return hex || "#888888";
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = parseInt(full, 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const t = amount < 0 ? 0 : 255;
  const p = Math.abs(amount);
  r = Math.round((t - r) * p + r);
  g = Math.round((t - g) * p + g);
  b = Math.round((t - b) * p + b);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function applyThemeVars(shell, tokens) {
  const resolved = resolveHudTheme(tokens);
  for (const [key, cssVar] of Object.entries(TOKEN_TO_VAR)) {
    const val = resolved[key];
    if (val == null || val === "") continue;
    shell.style.setProperty(cssVar, String(val));
  }
  if (resolved.id) shell.dataset.theme = resolved.id;
  return resolved;
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = BASE_CSS;
  document.head.appendChild(el);
}

/**
 * @param {HTMLElement} root — usually hudRoot from mount()
 * @param {{ theme?: string|HudThemeTokens|{preset?: string}&HudThemeTokens }} [opts]
 */
export function createHud(root, opts = {}) {
  if (!root) throw new Error("createHud requires hudRoot element");
  ensureStyles();
  root.replaceChildren?.();
  const shell = document.createElement("div");
  shell.className = "plab-hud";
  root.appendChild(shell);

  let currentTheme = applyThemeVars(shell, opts.theme ?? "arcade");

  const toastEl = document.createElement("div");
  toastEl.className = "plab-hud__toast";
  shell.appendChild(toastEl);
  let toastTimer = null;

  const overlay = document.createElement("div");
  overlay.className = "plab-hud__overlay";
  overlay.innerHTML = `<h2></h2><p class="plab-hud__overlay-body"></p><button type="button">Play again</button>`;
  shell.appendChild(overlay);
  const overlayTitle = overlay.querySelector("h2");
  const overlayBody = overlay.querySelector(".plab-hud__overlay-body");
  const overlayBtn = overlay.querySelector("button");
  let onRestart = null;
  overlayBtn.addEventListener("click", () => onRestart?.());

  function panel(anchor = "top-left", panelOpts = {}) {
    const box = document.createElement("div");
    box.className = "plab-hud__panel";
    Object.assign(box.style, { position: "absolute", ...ANCHORS[anchor] });
    if (panelOpts.minWidth) box.style.minWidth = panelOpts.minWidth;
    if (panelOpts.className) box.classList.add(panelOpts.className);
    shell.appendChild(box);

    const stats = new Map();
    return {
      el: box,
      stat(id, label, { large = false, small = false, color } = {}) {
        const wrap = document.createElement("div");
        wrap.dataset.statId = id;
        const lab = document.createElement("div");
        lab.className = "plab-hud__label";
        lab.textContent = label;
        const val = document.createElement("div");
        val.className = "plab-hud__value";
        if (large) val.classList.add("plab-hud__value--lg");
        if (small) val.classList.add("plab-hud__value--sm");
        if (color) val.style.color = color;
        val.textContent = "—";
        wrap.append(lab, val);
        box.appendChild(wrap);
        stats.set(id, val);
        return {
          set(text) {
            val.textContent = text;
          },
        };
      },
      bar(id, label) {
        const wrap = document.createElement("div");
        const lab = document.createElement("div");
        lab.className = "plab-hud__label";
        lab.textContent = label;
        const track = document.createElement("div");
        track.className = "plab-hud__bar";
        const fill = document.createElement("div");
        fill.className = "plab-hud__bar-fill";
        track.appendChild(fill);
        wrap.append(lab, track);
        box.appendChild(wrap);
        return {
          set(ratio) {
            fill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
          },
        };
      },
      raw(html) {
        const d = document.createElement("div");
        d.innerHTML = html;
        box.appendChild(d);
        return d;
      },
    };
  }

  function controlsHint(text) {
    const h = document.createElement("div");
    h.className = "plab-hud__hint";
    h.innerHTML = text;
    shell.appendChild(h);
    return {
      set(t) {
        h.innerHTML = t;
      },
    };
  }

  function toast(text, ms = 1600) {
    toastEl.textContent = text;
    toastEl.classList.add("is-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-show"), ms);
  }

  function showResult(title, lines = [], { onPlayAgain } = {}) {
    overlayTitle.textContent = title;
    overlayBody.replaceChildren();
    for (const line of lines) {
      const p = document.createElement("p");
      p.textContent = line;
      overlayBody.appendChild(p);
    }
    onRestart = onPlayAgain ?? null;
    overlay.classList.add("is-show");
  }

  function hideResult() {
    overlay.classList.remove("is-show");
  }

  /** Re-skin without rebuilding panels (layout/usability unchanged). */
  function setTheme(theme) {
    currentTheme = applyThemeVars(shell, theme);
    return currentTheme;
  }

  function dispose() {
    clearTimeout(toastTimer);
    root.replaceChildren?.();
  }

  return {
    shell,
    panel,
    controlsHint,
    toast,
    showResult,
    hideResult,
    setTheme,
    get theme() {
      return currentTheme;
    },
    dispose,
  };
}
