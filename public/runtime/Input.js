/**
 * Keyboard / pointer action map — genre agnostic.
 * Ignores keys while lab UI owns focus (chat, overlays, form fields).
 */
export function createInput(target = window) {
  const down = new Set();
  const pressed = new Set();
  const released = new Set();
  let mx = 0;
  let my = 0;
  let mdx = 0;
  let mdy = 0;
  let buttons = 0;

  function labBlocksInput() {
    return document.body?.dataset?.plabGameInput === "blocked";
  }

  function uiOwnsFocus() {
    if (labBlocksInput()) return true;
    const el = document.activeElement;
    if (!el || el === document.body) return false;
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON") return true;
    if (el.isContentEditable) return true;
    if (el.closest?.("[data-plab-ui]")) return true;
    return false;
  }

  function clearState() {
    down.clear();
    pressed.clear();
    released.clear();
    buttons = 0;
    mdx = 0;
    mdy = 0;
  }

  function onLabBlock() {
    clearState();
  }

  function onKeyDown(e) {
    if (uiOwnsFocus()) return;
    if (e.repeat) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    down.add(k);
    pressed.add(k);
    if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) e.preventDefault();
  }
  function onKeyUp(e) {
    if (uiOwnsFocus()) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    down.delete(k);
    released.add(k);
  }
  function onMouseMove(e) {
    if (uiOwnsFocus()) return;
    mdx += e.movementX || 0;
    mdy += e.movementY || 0;
    mx = e.clientX;
    my = e.clientY;
  }
  function onMouseDown(e) {
    if (uiOwnsFocus()) return;
    buttons |= 1 << e.button;
  }
  function onMouseUp(e) {
    if (uiOwnsFocus()) return;
    buttons &= ~(1 << e.button);
  }
  function onBlur() {
    clearState();
  }

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);
  target.addEventListener("mousemove", onMouseMove);
  target.addEventListener("mousedown", onMouseDown);
  target.addEventListener("mouseup", onMouseUp);
  window.addEventListener("blur", onBlur);
  window.addEventListener("plab:input-block", onLabBlock);

  const api = {
    axis() {
      if (uiOwnsFocus()) return { x: 0, y: 0 };
      let x = 0;
      let y = 0;
      if (down.has("a") || down.has("ArrowLeft")) x -= 1;
      if (down.has("d") || down.has("ArrowRight")) x += 1;
      if (down.has("w") || down.has("ArrowUp")) y += 1;
      if (down.has("s") || down.has("ArrowDown")) y -= 1;
      return { x, y };
    },
    key(k) {
      if (uiOwnsFocus()) return false;
      return down.has(k);
    },
    justPressed(k) {
      if (uiOwnsFocus()) return false;
      return pressed.has(k);
    },
    justReleased(k) {
      if (uiOwnsFocus()) return false;
      return released.has(k);
    },
    mouseDelta() {
      if (uiOwnsFocus()) return { x: 0, y: 0 };
      const d = { x: mdx, y: mdy };
      mdx = 0;
      mdy = 0;
      return d;
    },
    mouseButton(i = 0) {
      if (uiOwnsFocus()) return false;
      return (buttons & (1 << i)) !== 0;
    },
    mousePos() {
      return { x: mx, y: my };
    },
    endFrame() {
      pressed.clear();
      released.clear();
    },
    clearState,
    dispose() {
      target.removeEventListener("keydown", onKeyDown);
      target.removeEventListener("keyup", onKeyUp);
      target.removeEventListener("mousemove", onMouseMove);
      target.removeEventListener("mousedown", onMouseDown);
      target.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("plab:input-block", onLabBlock);
    },
  };
  return api;
}
