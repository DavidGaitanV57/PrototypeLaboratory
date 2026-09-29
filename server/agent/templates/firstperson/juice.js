/**
 * Feedback — JuiceKit + FxKit + AudioKit for quiet horror: restraint, then spikes.
 */
import { createJuice } from "/runtime/JuiceKit.js";
import { createFx } from "/runtime/FxKit.js";
import { createAudio } from "/runtime/AudioKit.js";

export function mountJuice({ camera, canvas, scene, look, LOOK }) {
  const juice = createJuice({ camera, canvas, look, maxShake: 0.25 });
  const fx = createFx(scene, { camera });
  const audio = createAudio({ music: 0.3 });
  audio.ambience(LOOK.audio.ambience);
  audio.music(LOOK.audio.music);
  audio.setIntensity(0.1);
  let beatT = 0;
  let creakT = 6;

  return {
    juice,
    fx,
    audio,
    filterDelta: (dt) => juice.filterDelta(dt),
    update(realDt, simDt, { threat = 0 } = {}) {
      beatT -= realDt;
      if (threat > 0.15 && beatT <= 0) {
        audio.sfx("heartbeat", { volume: 0.4 + threat * 0.8 });
        beatT = 1.2 - threat * 0.75;
      }
      creakT -= realDt;
      if (creakT <= 0) {
        audio.sfx("creak", { pitch: 0.7 + Math.random() * 0.6 });
        creakT = 8 + Math.random() * 12;
      }
      fx.update(simDt);
      juice.update(realDt);
    },
    step: (sprint) => audio.sfx("step", { volume: sprint ? 0.9 : 0.45, pitch: sprint ? 1.1 : 0.9 }),
    flashlight: () => audio.sfx("click", { pitch: 0.6 }),
    key(pos) {
      audio.sfx("pickup", { pitch: 0.8 });
      fx.pickup(pos, LOOK.palette.key);
      juice.flash("#31e1a0", 0.4, 0.18);
      juice.floatText(pos, "KEYCARD", { color: "#31e1a0", size: 18 });
    },
    exitOpen() {
      audio.sfx("confirm", { pitch: 0.7 });
      audio.duck(0.3, 1.5);
    },
    spotted() {
      audio.sfx("alarm", { pitch: 0.55 });
      audio.setIntensity(1);
      juice.kick(-6);
      juice.shake(0.35, 0.3);
      look?.pulse?.({ chroma: 0.012, saturation: -0.3, duration: 0.8 });
    },
    lost() {
      audio.setIntensity(0.3);
    },
    caught() {
      audio.sfx("hit", { pitch: 0.5 });
      audio.sfx("explosion", { pitch: 0.4, volume: 0.6 });
      juice.impact("lose", { color: "#300000" });
      juice.flash("#ff0000", 0.9, 0.55);
    },
    escaped() {
      audio.sfx("win", { pitch: 0.8 });
      audio.stopMusic();
      juice.impact("win", { color: "#e8fff4" });
    },
    dispose() {
      juice.dispose();
      fx.dispose();
      audio.dispose();
    },
  };
}
