/**
 * Feedback — one place for JuiceKit + FxKit + AudioKit. Gameplay calls semantic events only.
 */
import { createJuice } from "/runtime/JuiceKit.js";
import { createFx } from "/runtime/FxKit.js";
import { createAudio } from "/runtime/AudioKit.js";

export function mountJuice({ camera, canvas, scene, look, LOOK }) {
  const juice = createJuice({ camera, canvas, look, maxShake: 0.45 });
  const fx = createFx(scene, { camera });
  const audio = createAudio();
  audio.music(LOOK.audio.music);
  audio.ambience(LOOK.audio.ambience);
  let combo = 0;
  let comboT = 0;

  return {
    juice,
    fx,
    audio,
    filterDelta: (dt) => juice.filterDelta(dt),
    update(realDt, simDt) {
      comboT -= realDt;
      if (comboT <= 0) combo = 0;
      fx.update(simDt);
      juice.update(realDt);
    },
    jump(pos, double) {
      audio.sfx("jump", { pitch: double ? 1.35 : 1 });
      if (double) fx.burst(pos, { count: 14, color: 0xffffff, speed: 3, up: 0, gravity: 2, life: 0.35, size: 0.15 });
    },
    land(pos, speed) {
      if (speed < 6) return;
      audio.sfx("land", { volume: Math.min(1, speed / 20) });
      fx.dust(pos, { count: Math.min(16, 4 + speed) });
      if (speed > 16) juice.shake(0.15, 0.15);
    },
    bounce(pos) {
      audio.sfx("powerup", { pitch: 1.4 });
      juice.kick(8);
      fx.ring(pos, { color: 0xff4fa3, radius: 4, life: 0.4 });
      fx.burst(pos, { count: 26, colors: [0xff4fa3, 0xffd23f], speed: 7, up: 0.9, life: 0.6, size: 0.18 });
    },
    star(pos, color) {
      combo += 1;
      comboT = 1.2;
      audio.sfx("coin", { pitch: 1 + Math.min(combo, 8) * 0.06 });
      fx.pickup(pos, color);
      juice.floatText(pos, combo > 1 ? `+1 x${combo}` : "+1", { color: "#ffd23f" });
    },
    beaconOpen(pos) {
      audio.sfx("powerup");
      juice.impact("light");
      fx.ring(pos, { color: 0x4cc9f0, radius: 8, life: 0.8 });
    },
    hit(pos) {
      audio.sfx("hurt");
      juice.impact("heavy", { color: "#ff3b3b" });
      fx.sparks(pos);
    },
    fall() {
      audio.sfx("whoosh", { pitch: 0.6 });
      juice.flash("#000000", 0.5, 0.7);
    },
    win(pos) {
      audio.sfx("win");
      audio.setIntensity(1);
      juice.impact("win");
      fx.confetti(pos, { count: 180 });
    },
    lose() {
      audio.sfx("lose");
      juice.impact("lose");
    },
    dispose() {
      juice.dispose();
      fx.dispose();
      audio.dispose();
    },
  };
}
