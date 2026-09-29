/**
 * HUD — HudKit only. Live race state; title card + countdown + result overlay.
 */
import { createHud } from "/runtime/HudKit.js";
import { createMinimap } from "/runtime/MinimapKit.js";

const ORD = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];

export function mountHud(hudRoot, { LOOK, onPlayAgain }) {
  const hud = createHud(hudRoot, { theme: LOOK.hudTheme });
  const left = hud.panel("top-left", { minWidth: "150px" });
  const pos = left.stat("pos", "POSITION", { large: true });
  const lap = left.stat("lap", "LAP");
  const time = hud.panel("top-center").stat("time", "TIME", { small: true });
  const speedPanel = hud.panel("bottom-left", { minWidth: "220px" });
  const speed = speedPanel.stat("spd", "KM/H", { large: true });
  const boost = speedPanel.bar("boost", "DRIFT / BOOST");
  const item = speedPanel.stat("item", "ITEM [E]", { small: true });
  const mapPanel = hud.panel("top-right");
  const minimap = createMinimap(mapPanel.el, { size: 170, label: "TRACK" });
  hud.controlsHint("<b>W/S</b> gas/brake · <b>A/D</b> steer · <b>SPACE</b> drift (hold) · <b>E</b> item · <b>R</b> restart");

  let pathPts = [];
  const fmt = (s) => {
    const m = Math.floor(s / 60);
    const r = s - m * 60;
    return `${m}:${r.toFixed(2).padStart(5, "0")}`;
  };

  return {
    hud,
    setTrack(path, bounds) {
      pathPts = path.lut.filter((_, i) => i % 4 === 0).map((l) => l.point);
      const pad = 8;
      minimap.setBounds(bounds.min.x - pad, bounds.max.x + pad, bounds.min.z - pad, bounds.max.z + pad);
    },
    update({ position, total, lapNow, laps, t, kmh, boost01, itemIcon, markers }) {
      pos.set(`${ORD[position - 1] || position}/${total}`);
      lap.set(`${Math.min(lapNow, laps)}/${laps}`);
      time.set(fmt(t));
      speed.set(String(Math.round(kmh)));
      boost.set(boost01);
      item.set(itemIcon || "—");
      minimap.draw(pathPts, markers);
    },
    title: (a, b, ms) => hud.titleCard(a, b, ms),
    countdown: (n, o) => hud.countdown(n, o),
    toast: (t, ms) => hud.toast(t, ms),
    showResult(title, lines) {
      hud.showResult(title, lines, { onPlayAgain });
    },
    hideResult: () => hud.hideResult(),
    fmt,
    dispose: () => hud.dispose(),
  };
}
