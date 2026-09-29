/**
 * Feedback — JuiceKit + FxKit + AudioKit. Loud, punchy, readable.
 */
import { createJuice } from "/runtime/JuiceKit.js";
import { createFx } from "/runtime/FxKit.js";
import { createAudio } from "/runtime/AudioKit.js";

export function mountJuice({ camera, canvas, scene, look, LOOK }) {
  const juice = createJuice({ camera, canvas, look, maxShake: 0.7 });
  const fx = createFx(scene, { camera, max: 4000 });
  const audio = createAudio();
  audio.music(LOOK.audio.music);
  audio.ambience(LOOK.audio.ambience);
  audio.setIntensity(0.3);

  return {
    juice,
    fx,
    audio,
    filterDelta: (dt) => juice.filterDelta(dt),
    update(realDt, simDt) {
      fx.update(simDt);
      juice.update(realDt);
    },
    shoot(pos) {
      audio.sfx("shoot", { volume: 0.5 });
      fx.burst(pos, { count: 4, color: LOOK.palette.bullet, speed: 4, gravity: 0, life: 0.12, size: 0.12 });
      juice.shake(0.04, 0.05);
    },
    hit(pos, color) {
      audio.sfx("hit", { volume: 0.45, pitch: 1.3 });
      fx.sparks(pos, { count: 10, color });
      juice.hitStop(0.015);
    },
    kill(pos, color, points, combo) {
      audio.sfx("explosion", { volume: 0.55, pitch: 1.2 + Math.min(combo, 6) * 0.05 });
      fx.burst(pos, { count: 34, colors: [color, 0xffffff], speed: 9, gravity: 10, life: 0.6, size: 0.22 });
      fx.ring(pos, { color, radius: 2.8, life: 0.35 });
      juice.shake(0.22, 0.2);
      juice.hitStop(0.035);
      juice.floatText(pos, combo > 1 ? `+${points} x${combo}` : `+${points}`, { color: combo > 3 ? "#ff3df2" : "#ffffff", size: 20 + Math.min(combo, 8) * 2 });
      if (combo >= 5) look?.pulse?.({ bloom: 0.4, duration: 0.3 });
    },
    bigKill(pos, color) {
      fx.explosion(pos, { color });
      juice.impact("heavy", { color: "#ffffff" });
    },
    hurt(pos) {
      audio.sfx("hurt");
      juice.impact("heavy", { color: "#ff2255" });
      fx.sparks(pos, { color: 0xff2255, count: 20 });
    },
    dash(pos) {
      audio.sfx("whoosh", { pitch: 1.3 });
      juice.kick(5);
      fx.dust(pos, { count: 8, color: 0x4cc9f0 });
    },
    heal(pos) {
      audio.sfx("powerup", { pitch: 1.2 });
      fx.pickup(pos, LOOK.palette.heal);
      juice.floatText(pos, "+HP", { color: "#3dff8a" });
    },
    portal(pos, color) {
      fx.burst(pos.clone().setY(1.2), { count: 16, color, speed: 5, gravity: 0, life: 0.4, size: 0.2 });
    },
    wave(n) {
      audio.sfx("alarm", { pitch: 1.2, volume: 0.6 });
      audio.setIntensity(Math.min(1, 0.35 + n * 0.15));
    },
    cleared() {
      audio.sfx("checkpoint");
      audio.duck(0.4, 1);
    },
    win(pos) {
      audio.sfx("win");
      juice.impact("win");
      fx.confetti(pos.clone().setY(3), { count: 200 });
    },
    lose() {
      audio.sfx("lose");
      audio.setIntensity(0);
      juice.impact("lose");
    },
    dispose() {
      juice.dispose();
      fx.dispose();
      audio.dispose();
    },
  };
}
