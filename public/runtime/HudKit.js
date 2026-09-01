/**
 * DOM HUD kit — arcade-readable panels without external UI frameworks.
 * Mount inside `hudRoot` from gameplay mount(). Avoid bottom-right (lab chrome).
 */

const STYLE_ID = "plab-hudkit-styles";

const BASE_CSS = `
.plab-hud { position: absolute; inset: 0; pointer-events: none; font-family: "Arial Black", Arial, sans-serif; color: #fff; z-index: 2; }
.plab-hud * { box-sizing: border-box; }
.plab-hud__panel {
  background: rgba(0,0,0,0.55); border: 3px solid #fff; border-radius: 12px;
  padding: 8px 16px; text-shadow: 2px 2px 0 #000, -1px -1px 0 #000;
}
.plab-hud__label { font-size: 11px; letter-spacing: 1px; opacity: 0.95; }
.plab-hud__value { font-size: 28px; font-weight: 900; line-height: 1.1; }
.plab-hud__value--lg { font-size: 42px; }
.plab-hud__value--sm { font-size: 18px; }
.plab-hud__bar { margin-top: 6px; width: 100%; height: 10px; background: #333; border-radius: 5px; overflow: hidden; }
.plab-hud__bar-fill { height: 100%; width: 0%; background: linear-gradient(90deg,#4caf50,#ffeb3b 60%,#f44336); transition: width 0.08s linear; }
.plab-hud__toast {
  position: absolute; top: 38%; left: 50%; transform: translateX(-50%) scale(0.9);
  background: rgba(255,152,0,0.95); border: 4px solid #fff; border-radius: 12px;
  padding: 12px 28px; font-size: 22px; font-weight: 900; opacity: 0; transition: opacity 0.15s, transform 0.15s;
}
.plab-hud__toast.is-show { opacity: 1; transform: translateX(-50%) scale(1); }
.plab-hud__overlay {
  position: absolute; inset: 0; display: none; flex-direction: column; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.85); pointer-events: auto; z-index: 20;
}
.plab-hud__overlay.is-show { display: flex; }
.plab-hud__overlay h2 { font-size: 64px; color: #ffd700; margin: 0 0 12px; text-shadow: 4px 4px 0 #000; }
.plab-hud__overlay p { font-size: 20px; margin: 6px 0; }
.plab-hud__overlay button {
  margin-top: 20px; padding: 12px 36px; font-size: 20px; font-weight: 900;
  background: #e91e63; color: #fff; border: 3px solid #fff; border-radius: 12px; cursor: pointer;
}
.plab-hud__hint {
  position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%);
  background: rgba(0,0,0,0.55); border: 2px solid #fff; border-radius: 10px;
  padding: 6px 14px; font-size: 11px; text-align: center; max-width: 90%;
}
.plab-hud__minimap { padding: 6px; }
.plab-hud__minimap canvas { display: block; border-radius: 6px; background: rgba(0,40,0,0.4); }
`;

const ANCHORS = {
  "top-left": { top: "18px", left: "18px", right: "auto", bottom: "auto" },
  "top-right": { top: "18px", right: "18px", left: "auto", bottom: "auto" },
  "top-center": { top: "18px", left: "50%", transform: "translateX(-50%)", right: "auto", bottom: "auto" },
  "bottom-left": { bottom: "18px", left: "18px", top: "auto", right: "auto" },
  "bottom-center": { bottom: "18px", left: "50%", transform: "translateX(-50%)", top: "auto", right: "auto" },
};

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = BASE_CSS;
  document.head.appendChild(el);
}

/**
 * @param {HTMLElement} root — usually hudRoot from mount()
 */
export function createHud(root) {
  if (!root) throw new Error("createHud requires hudRoot element");
  ensureStyles();
  root.replaceChildren?.();
  const shell = document.createElement("div");
  shell.className = "plab-hud";
  root.appendChild(shell);

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

  function panel(anchor = "top-left", opts = {}) {
    const box = document.createElement("div");
    box.className = "plab-hud__panel";
    Object.assign(box.style, { position: "absolute", ...ANCHORS[anchor] });
    if (opts.minWidth) box.style.minWidth = opts.minWidth;
    if (opts.className) box.classList.add(opts.className);
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
    return { set(t) { h.innerHTML = t; } };
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

  function dispose() {
    clearTimeout(toastTimer);
    root.replaceChildren?.();
  }

  return { shell, panel, controlsHint, toast, showResult, hideResult, dispose };
}
