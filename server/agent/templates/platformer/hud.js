/**
 * HUD — HudKit only. Stars, lives, timer, title card, result overlay.
 */
import { createHud } from "/runtime/HudKit.js";

export function mountHud(hudRoot, { LOOK, TUNING, onPlayAgain }) {
  const hud = createHud(hudRoot, { theme: LOOK.hudTheme });
  const left = hud.panel("top-left", { minWidth: "170px" });
  const stars = left.stat("stars", "STARS", { large: true, color: "#ffd23f" });
  const lives = left.stat("lives", "LIVES", { small: true, color: "#ff6b81" });
  const time = hud.panel("top-center").stat("time", "TIME", { small: true });
  const goal = hud.panel("top-right", { minWidth: "150px" });
  const beacon = goal.stat("beacon", "BEACON", { small: true });
  const bar = goal.bar("prog", "ALTITUDE");
  hud.controlsHint("<b>WASD</b> move · <b>SPACE</b> jump (twice for double jump) · <b>R</b> restart");

  return {
    hud,
    update({ got, need, total, livesLeft, t, altitude01 }) {
      stars.set(`★ ${got}/${total}`);
      lives.set("♥".repeat(Math.max(0, livesLeft)) || "—");
      const m = Math.floor(t / 60);
      time.set(`${m}:${String(Math.floor(t % 60)).padStart(2, "0")}`);
      beacon.set(got >= need ? "OPEN ✦" : `needs ${need - got}`);
      bar.set(altitude01);
    },
    title: (a, b, ms) => hud.titleCard(a, b, ms),
    toast: (t, ms) => hud.toast(t, ms),
    showResult: (title, lines) => hud.showResult(title, lines, { onPlayAgain }),
    hideResult: () => hud.hideResult(),
    dispose: () => hud.dispose(),
    TUNING,
  };
}
