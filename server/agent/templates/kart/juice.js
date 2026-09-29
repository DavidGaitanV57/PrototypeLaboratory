/**
 * Feedback — one place for JuiceKit + FxKit + AudioKit. Gameplay calls semantic events only.
 */
import * as THREE from "/vendor/three/build/three.module.js";
import { createJuice } from "/runtime/JuiceKit.js";
import { createFx } from "/runtime/FxKit.js";
import { createAudio } from "/runtime/AudioKit.js";

export function mountJuice({ camera, canvas, scene, look, LOOK }) {
  const juice = createJuice({ camera, canvas, look, maxShake: 0.5 });
  const fx = createFx(scene, { camera });
  const audio = createAudio();
  audio.music(LOOK.audio.music);
  audio.ambience(LOOK.audio.ambience);
  const tmp = new THREE.Vector3();
  let sparkT = 0;

  return {
    juice,
    fx,
    audio,
    filterDelta: (dt) => juice.filterDelta(dt),
    update(realDt, simDt) {
      fx.update(simDt);
      juice.update(realDt);
    },
    countdownTick: () => audio.sfx("click", { pitch: 0.8 }),
    go() {
      audio.sfx("confirm");
      juice.kick(-4);
    },
    engine: (k) => audio.setEngine(k),
    drifting(kart, tier, dt) {
      sparkT -= dt;
      if (sparkT > 0) return;
      sparkT = 0.05;
      for (const w of kart.userData.wheels.filter((x) => !x.front)) {
        w.spin.getWorldPosition(tmp);
        tmp.y = 0.15;
        fx.burst(tmp, { count: 3, color: tier === 2 ? 0xff8a00 : tier === 1 ? 0x4cc9f0 : 0xfff3c4, speed: 3, up: 0.6, gravity: 8, life: 0.3, size: 0.12 });
      }
    },
    boost(pos, tier = 1) {
      audio.sfx("boost", { pitch: tier === 2 ? 1.2 : 1 });
      juice.kick(tier === 2 ? 9 : 6);
      juice.shake(0.12, 0.2);
      fx.burst(pos, { count: 20, color: 0xff9d2e, speed: 6, life: 0.4, size: 0.2 });
      look?.pulse?.({ exposure: 0.12, bloom: 0.3, duration: 0.4 });
    },
    offroad(pos) {
      if (Math.random() < 0.3) fx.dust(pos, { count: 2 });
    },
    itemBox(pos) {
      audio.sfx("pickup");
      fx.pickup(pos, 0x4cc9f0);
      juice.shake(0.1, 0.12);
    },
    shock(pos) {
      audio.sfx("laser", { pitch: 0.6 });
      juice.impact("medium");
      fx.ring(pos, { color: 0xb388ff, radius: 14, life: 0.5 });
    },
    bump(pos) {
      audio.sfx("hit", { pitch: 1.3, volume: 0.6 });
      juice.shake(0.25, 0.2);
      fx.sparks(pos, { count: 12 });
    },
    lap(n, total, pos) {
      audio.sfx("checkpoint");
      juice.floatText(pos, n === total ? "FINAL LAP!" : `LAP ${n}`, { color: "#ffd23f", size: 30 });
      if (n === total) audio.setIntensity(1);
    },
    finish(win, archPos) {
      audio.stopEngine();
      audio.sfx(win ? "win" : "lose");
      juice.impact(win ? "win" : "lose");
      if (win) fx.confetti(archPos.clone().setY(6), { count: 160 });
    },
    dispose() {
      juice.dispose();
      fx.dispose();
      audio.dispose();
    },
  };
}
