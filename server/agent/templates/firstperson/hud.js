/**
 * HUD — HudKit only, quiet horror chrome: keycards, stamina, battery, awareness, objective.
 */
import { createHud } from "/runtime/HudKit.js";

export function mountHud(hudRoot, { LOOK, onPlayAgain }) {
  const hud = createHud(hudRoot, { theme: LOOK.hudTheme });
  const left = hud.panel("top-left", { minWidth: "170px" });
  const keys = left.stat("keys", "KEYCARDS", { large: true });
  const objective = left.stat("obj", "OBJECTIVE", { small: true });
  const aware = hud.panel("top-center", { minWidth: "160px" });
  const eye = aware.stat("eye", "AWARENESS", { small: true });
  const detect = aware.bar("detect", "");
  const bottom = hud.panel("bottom-left", { minWidth: "200px" });
  const stamina = bottom.bar("stamina", "STAMINA");
  const battery = bottom.bar("battery", "FLASHLIGHT [F]");
  const hint = hud.controlsHint("<b>CLICK</b> to look · <b>WASD</b> move · <b>SHIFT</b> sprint (loud) · <b>F</b> flashlight · <b>R</b> restart");

  return {
    hud,
    update({ got, total, stamina01, battery01, detect01, stalkerState, exitOpen }) {
      keys.set(`${got}/${total}`);
      objective.set(exitOpen ? "Reach the EXIT" : "Find keycards");
      stamina.set(stamina01);
      battery.set(battery01);
      detect.set(detect01);
      eye.set(stalkerState === "Chase" ? "HUNTED" : stalkerState === "Alert" ? "IT SENSES YOU" : stalkerState === "Search" ? "SEARCHING" : "UNSEEN");
    },
    setHint: (html) => hint.set(html),
    title: (a, b, ms) => hud.titleCard(a, b, ms),
    toast: (t, ms) => hud.toast(t, ms),
    showResult: (title, lines) => hud.showResult(title, lines, { onPlayAgain }),
    hideResult: () => hud.hideResult(),
    dispose: () => hud.dispose(),
  };
}
