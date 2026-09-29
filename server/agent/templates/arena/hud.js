/**
 * HUD — HudKit only. HP, score, combo, wave, enemies left, dash.
 */
import { createHud } from "/runtime/HudKit.js";

export function mountHud(hudRoot, { LOOK, onPlayAgain }) {
  const hud = createHud(hudRoot, { theme: LOOK.hudTheme });
  const left = hud.panel("top-left", { minWidth: "190px" });
  const hp = left.bar("hp", "HEALTH");
  const hpText = left.stat("hpText", "", { small: true });
  const score = left.stat("score", "SCORE", { large: true });
  const waveP = hud.panel("top-center", { minWidth: "150px" });
  const wave = waveP.stat("wave", "WAVE");
  const left2 = waveP.stat("left", "ENEMIES", { small: true });
  const right = hud.panel("top-right", { minWidth: "130px" });
  const combo = right.stat("combo", "COMBO", { large: true, color: "#ff3df2" });
  const dash = hud.panel("bottom-left", { minWidth: "170px" }).bar("dash", "DASH [SHIFT]");
  hud.controlsHint("<b>WASD</b> move · <b>MOUSE</b> aim · <b>CLICK / SPACE</b> shoot · <b>SHIFT</b> dash · <b>R</b> restart");

  return {
    hud,
    update({ hp01, hpNow, hpMax, scoreNow, waveNow, waves, enemiesLeft, comboNow, dash01 }) {
      hp.set(hp01);
      hpText.set(`${hpNow}/${hpMax}`);
      score.set(String(scoreNow).padStart(6, "0"));
      wave.set(`${Math.min(waveNow, waves)}/${waves}`);
      left2.set(String(enemiesLeft));
      combo.set(comboNow > 1 ? `x${comboNow}` : "—");
      dash.set(dash01);
    },
    title: (a, b, ms) => hud.titleCard(a, b, ms),
    toast: (t, ms) => hud.toast(t, ms),
    showResult: (title, lines) => hud.showResult(title, lines, { onPlayAgain }),
    hideResult: () => hud.hideResult(),
    dispose: () => hud.dispose(),
  };
}
