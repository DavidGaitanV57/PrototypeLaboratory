/**
 * AudioKit — procedural WebAudio: SFX presets, engine loop, ambience beds, generative music with intensity, ducking. createAudio({ volume, music, sfx, ambience }) bus levels 0..1.
 * Auto-unlocks on first key/pointer input. Safe to call before unlock (calls are ignored).
 */

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  pentatonic: [0, 2, 4, 7, 9],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
};

export const MUSIC_STYLES = {
  arcade: { bpm: 132, scale: "major", root: 52, drums: "four", bass: "octave", lead: "square", pad: false },
  chill: { bpm: 92, scale: "pentatonic", root: 50, drums: "soft", bass: "root", lead: "triangle", pad: true },
  tense: { bpm: 110, scale: "phrygian", root: 45, drums: "pulse", bass: "pulse", lead: "none", pad: true },
  ambient: { bpm: 70, scale: "dorian", root: 48, drums: "none", bass: "none", lead: "sine", pad: true },
  action: { bpm: 150, scale: "minor", root: 45, drums: "break", bass: "octave", lead: "saw", pad: false },
};

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function createAudio(opts = {}) {
  let ctx = null;
  let master = null;
  const bus = {};
  let noiseBuf = null;
  let unlocked = false;
  let disposed = false;
  let seqTimer = null;
  let engineNodes = null;
  const ambienceNodes = [];
  // Bus levels (named keys only — inner functions are also called sfx/ambience).
  const levels = { master: opts.volume ?? 0.8, music: opts.music ?? 0.45, sfx: opts.sfx ?? 0.9, ambience: opts.ambience ?? 0.5 };

  function init() {
    if (ctx || disposed) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = levels.master;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
    for (const k of ["music", "sfx", "ambience"]) {
      bus[k] = ctx.createGain();
      bus[k].gain.value = levels[k];
      bus[k].connect(master);
    }
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
  }

  function unlock() {
    init();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    unlocked = true;
  }
  const onFirst = () => unlock();
  window.addEventListener("pointerdown", onFirst);
  window.addEventListener("keydown", onFirst);

  const ready = () => ctx && unlocked && ctx.state !== "closed";

  // ── Building blocks ─────────────────────────────────────
  function env(g, t, { a = 0.005, d = 0.1, s = 0, r = 0.08, peak = 1, hold = 0 } = {}) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * Math.max(s, 0.0001)), t + a + d);
    const end = t + a + d + hold;
    g.gain.setValueAtTime(Math.max(0.0001, peak * Math.max(s, 0.0001)), end);
    g.gain.exponentialRampToValueAtTime(0.0001, end + r);
    return end + r;
  }

  function tone(out, { type = "square", f0 = 440, f1 = null, t = ctx.currentTime, dur = 0.15, vol = 0.3, a = 0.004, filter = null, detune = 0 } = {}) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    o.detune.value = detune;
    const g = ctx.createGain();
    let node = o;
    if (filter) {
      const bq = ctx.createBiquadFilter();
      bq.type = filter.type || "lowpass";
      bq.frequency.value = filter.freq || 2000;
      bq.Q.value = filter.q || 1;
      node.connect(bq);
      node = bq;
    }
    node.connect(g).connect(out);
    const end = env(g, t, { a, d: dur, s: 0.0001, r: 0.03, peak: vol });
    o.start(t);
    o.stop(end + 0.02);
  }

  function noise(out, { t = ctx.currentTime, dur = 0.2, vol = 0.3, type = "bandpass", f0 = 1200, f1 = null, q = 1, a = 0.002 } = {}) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const bq = ctx.createBiquadFilter();
    bq.type = type;
    bq.frequency.setValueAtTime(f0, t);
    if (f1) bq.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    bq.Q.value = q;
    const g = ctx.createGain();
    src.connect(bq).connect(g).connect(out);
    const end = env(g, t, { a, d: dur, s: 0.0001, r: 0.04, peak: vol });
    src.start(t, Math.random());
    src.stop(end + 0.05);
  }

  // ── SFX presets ─────────────────────────────────────────
  const SFX = {
    jump: (o) => tone(bus.sfx, { type: "square", f0: 260 * o.pitch, f1: 620 * o.pitch, dur: 0.14, vol: 0.18, filter: { freq: 2400 } }),
    land: (o) => noise(bus.sfx, { f0: 400 * o.pitch, f1: 120, dur: 0.1, vol: 0.35, type: "lowpass" }),
    step: (o) => noise(bus.sfx, { f0: 900 * o.pitch, dur: 0.04, vol: 0.12, q: 2 }),
    coin: (o) => {
      const t = ctx.currentTime;
      tone(bus.sfx, { type: "square", f0: 988 * o.pitch, t, dur: 0.06, vol: 0.14 });
      tone(bus.sfx, { type: "square", f0: 1319 * o.pitch, t: t + 0.06, dur: 0.18, vol: 0.14 });
    },
    pickup: (o) => {
      const t = ctx.currentTime;
      [0, 4, 7, 12].forEach((s, i) => tone(bus.sfx, { type: "triangle", f0: mtof(72 + s) * o.pitch, t: t + i * 0.045, dur: 0.12, vol: 0.16 }));
    },
    powerup: (o) => {
      const t = ctx.currentTime;
      for (let i = 0; i < 8; i += 1) tone(bus.sfx, { type: "square", f0: mtof(60 + i * 2) * o.pitch, t: t + i * 0.04, dur: 0.07, vol: 0.1, filter: { freq: 3000 } });
    },
    hit: (o) => {
      noise(bus.sfx, { f0: 1800 * o.pitch, f1: 300, dur: 0.12, vol: 0.4 });
      tone(bus.sfx, { type: "sine", f0: 160 * o.pitch, f1: 60, dur: 0.14, vol: 0.45 });
    },
    hurt: (o) => tone(bus.sfx, { type: "sawtooth", f0: 420 * o.pitch, f1: 110, dur: 0.28, vol: 0.2, filter: { freq: 1800 } }),
    explosion: (o) => {
      noise(bus.sfx, { f0: 1400 * o.pitch, f1: 60, dur: 0.9, vol: 0.7, type: "lowpass", q: 0.7 });
      tone(bus.sfx, { type: "sine", f0: 90 * o.pitch, f1: 30, dur: 0.7, vol: 0.6 });
    },
    shoot: (o) => {
      noise(bus.sfx, { f0: 3000 * o.pitch, f1: 500, dur: 0.08, vol: 0.3, type: "highpass" });
      tone(bus.sfx, { type: "square", f0: 880 * o.pitch, f1: 220, dur: 0.09, vol: 0.12 });
    },
    laser: (o) => tone(bus.sfx, { type: "sawtooth", f0: 1600 * o.pitch, f1: 200, dur: 0.18, vol: 0.14, filter: { freq: 4000 } }),
    whoosh: (o) => noise(bus.sfx, { f0: 300 * o.pitch, f1: 2500, dur: 0.3, vol: 0.25, q: 0.8 }),
    boost: (o) => {
      noise(bus.sfx, { f0: 400, f1: 3000 * o.pitch, dur: 0.45, vol: 0.28, q: 0.6 });
      tone(bus.sfx, { type: "sawtooth", f0: 110 * o.pitch, f1: 440 * o.pitch, dur: 0.4, vol: 0.12, filter: { freq: 1500 } });
    },
    click: (o) => tone(bus.sfx, { type: "square", f0: 1400 * o.pitch, dur: 0.025, vol: 0.08 }),
    confirm: (o) => {
      const t = ctx.currentTime;
      tone(bus.sfx, { type: "triangle", f0: 660 * o.pitch, t, dur: 0.08, vol: 0.14 });
      tone(bus.sfx, { type: "triangle", f0: 990 * o.pitch, t: t + 0.08, dur: 0.14, vol: 0.14 });
    },
    error: (o) => tone(bus.sfx, { type: "square", f0: 140 * o.pitch, dur: 0.22, vol: 0.14, filter: { freq: 900 } }),
    alarm: (o) => {
      const t = ctx.currentTime;
      for (let i = 0; i < 3; i += 1) tone(bus.sfx, { type: "sawtooth", f0: 740 * o.pitch, f1: 520, t: t + i * 0.25, dur: 0.2, vol: 0.12, filter: { freq: 2500 } });
    },
    checkpoint: (o) => {
      const t = ctx.currentTime;
      [0, 7, 12].forEach((s, i) => tone(bus.sfx, { type: "square", f0: mtof(67 + s) * o.pitch, t: t + i * 0.07, dur: 0.12, vol: 0.12, filter: { freq: 3500 } }));
    },
    win: (o) => {
      const t = ctx.currentTime;
      [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone(bus.sfx, { type: "square", f0: mtof(60 + s) * o.pitch, t: t + i * 0.09, dur: i === 6 ? 0.6 : 0.12, vol: 0.13, filter: { freq: 3200 } }));
    },
    lose: (o) => {
      const t = ctx.currentTime;
      [7, 6, 5, 0].forEach((s, i) => tone(bus.sfx, { type: "triangle", f0: mtof(55 + s) * o.pitch, t: t + i * 0.22, dur: i === 3 ? 0.8 : 0.2, vol: 0.18 }));
    },
    creak: (o) => tone(bus.sfx, { type: "sawtooth", f0: 70 * o.pitch, f1: 95 * o.pitch, dur: 0.6, vol: 0.08, filter: { type: "bandpass", freq: 600, q: 8 } }),
    heartbeat: (o) => {
      const t = ctx.currentTime;
      tone(bus.sfx, { type: "sine", f0: 70 * o.pitch, f1: 40, t, dur: 0.12, vol: 0.5 });
      tone(bus.sfx, { type: "sine", f0: 60 * o.pitch, f1: 38, t: t + 0.2, dur: 0.14, vol: 0.4 });
    },
  };

  /** Play a preset: sfx("coin"), sfx("hit", { pitch: 1.2, volume: 0.5 }). Random ±4% pitch keeps repeats alive. */
  function sfx(name, { pitch = 1, volume: v = 1, vary = 0.04 } = {}) {
    if (!ready()) return;
    const fn = SFX[name];
    if (!fn) return;
    const prev = bus.sfx.gain.value;
    if (v !== 1) bus.sfx.gain.setValueAtTime(levels.sfx * v, ctx.currentTime);
    fn({ pitch: pitch * (1 + (Math.random() * 2 - 1) * vary) });
    if (v !== 1) bus.sfx.gain.setValueAtTime(prev, ctx.currentTime + 0.5);
  }

  // ── Engine loop (karts, cars, drones) ─────────────────
  function setEngine(throttle01 = 0, { base = 55, range = 160, type = "sawtooth" } = {}) {
    if (!ready()) return;
    if (!engineNodes) {
      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      o1.type = type;
      o2.type = "square";
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 700;
      const g = ctx.createGain();
      g.gain.value = 0;
      o1.connect(lp);
      o2.connect(lp);
      lp.connect(g).connect(bus.sfx);
      o1.start();
      o2.start();
      engineNodes = { o1, o2, lp, g };
    }
    const t = ctx.currentTime;
    const k = Math.max(0, Math.min(1, throttle01));
    engineNodes.o1.frequency.setTargetAtTime(base + range * k, t, 0.06);
    engineNodes.o2.frequency.setTargetAtTime((base + range * k) * 0.5 + 1.5, t, 0.06);
    engineNodes.lp.frequency.setTargetAtTime(500 + 2200 * k, t, 0.08);
    engineNodes.g.gain.setTargetAtTime(0.05 + 0.1 * k, t, 0.1);
  }

  function stopEngine() {
    if (!engineNodes) return;
    const t = ctx.currentTime;
    engineNodes.g.gain.setTargetAtTime(0, t, 0.1);
    const n = engineNodes;
    engineNodes = null;
    setTimeout(() => {
      try {
        n.o1.stop();
        n.o2.stop();
      } catch {
        /* */
      }
    }, 600);
  }

  // ── Ambience beds ───────────────────────────────────────
  /** "wind" | "hum" | "night" | "underwater" | "room" | "rain" */
  function ambience(kind = "wind") {
    if (!ready()) {
      pendingAmbience = kind;
      return;
    }
    stopAmbience();
    const t = ctx.currentTime;
    const add = (node) => ambienceNodes.push(node);
    const noiseLoop = (type, freq, q, vol, lfoRate = 0, lfoDepth = 0) => {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      const bq = ctx.createBiquadFilter();
      bq.type = type;
      bq.frequency.value = freq;
      bq.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.linearRampToValueAtTime(vol, t + 2);
      src.connect(bq).connect(g).connect(bus.ambience);
      if (lfoRate) {
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        lfo.frequency.value = lfoRate;
        lg.gain.value = lfoDepth;
        lfo.connect(lg).connect(bq.frequency);
        lfo.start();
        add(lfo);
      }
      src.start();
      add(src);
    };
    const drone = (f, type, vol) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.linearRampToValueAtTime(vol, t + 2);
      o.connect(g).connect(bus.ambience);
      o.start();
      add(o);
    };
    if (kind === "wind") noiseLoop("bandpass", 500, 0.6, 0.25, 0.08, 300);
    else if (kind === "hum") {
      drone(60, "sawtooth", 0.025);
      drone(120, "sine", 0.03);
      noiseLoop("highpass", 6000, 0.5, 0.02);
    } else if (kind === "night") {
      noiseLoop("bandpass", 4200, 8, 0.05, 6, 400);
      noiseLoop("lowpass", 300, 0.5, 0.08);
    } else if (kind === "underwater") {
      noiseLoop("lowpass", 350, 1.5, 0.35, 0.15, 150);
      drone(48, "sine", 0.05);
    } else if (kind === "rain") noiseLoop("highpass", 1800, 0.4, 0.2);
    else noiseLoop("lowpass", 220, 0.7, 0.06);
  }
  let pendingAmbience = null;

  function stopAmbience() {
    for (const n of ambienceNodes.splice(0)) {
      try {
        n.stop();
      } catch {
        /* */
      }
    }
  }

  // ── Generative music ───────────────────────────────────
  let musicState = null;
  let pendingMusic = null;

  /** musicPlay("arcade" | "chill" | "tense" | "ambient" | "action" | {bpm, scale, root, …}) */
  function musicPlay(style = "arcade", overrides = {}) {
    if (!ready()) {
      pendingMusic = [style, overrides];
      return;
    }
    musicStop();
    const s = { ...(typeof style === "string" ? MUSIC_STYLES[style] || MUSIC_STYLES.arcade : style), ...overrides };
    const scale = SCALES[s.scale] || SCALES.major;
    const stepDur = 60 / s.bpm / 4;
    const prog = [0, 5, 3, 4];
    musicState = { s, scale, stepDur, step: 0, next: ctx.currentTime + 0.1, intensity: 0.5, melody: [] };
    for (let i = 0; i < 16; i += 1) musicState.melody.push(Math.random() < 0.55 ? (Math.random() * scale.length * 1.5) | 0 : -1);
    const out = bus.music;
    const note = (deg, oct = 0) => s.root + scale[((deg % scale.length) + scale.length) % scale.length] + 12 * (oct + Math.floor(deg / scale.length));

    const tick = () => {
      if (!musicState) return;
      const m = musicState;
      while (m.next < ctx.currentTime + 0.12) {
        const t = m.next;
        const st = m.step % 16;
        const bar = Math.floor(m.step / 16) % prog.length;
        const chord = prog[bar];
        const I = m.intensity;
        // drums
        if (s.drums !== "none") {
          const kick = s.drums === "four" ? st % 4 === 0 : s.drums === "break" ? [0, 6, 10].includes(st) : s.drums === "pulse" ? st % 8 === 0 : st === 0 || st === 10;
          if (kick) tone(out, { type: "sine", f0: 150, f1: 42, t, dur: 0.16, vol: 0.5 });
          if ((s.drums === "four" || s.drums === "break") && (st === 4 || st === 12)) noise(out, { t, f0: 1800, dur: 0.12, vol: 0.22 * (0.6 + I * 0.4) });
          if (I > 0.35 && st % 2 === 0 && s.drums !== "soft") noise(out, { t, f0: 8000, type: "highpass", dur: 0.03, vol: 0.06 * I });
          if (s.drums === "soft" && st % 8 === 4) noise(out, { t, f0: 3000, dur: 0.05, vol: 0.05 });
        }
        // bass
        if (s.bass !== "none") {
          const on = s.bass === "pulse" ? st % 2 === 0 : s.bass === "octave" ? st % 2 === 0 : st % 8 === 0;
          if (on) {
            const oct = s.bass === "octave" && st % 4 === 2 ? -1 : -2;
            tone(out, { type: "sawtooth", f0: mtof(note(chord, oct + 1)), t, dur: stepDur * 1.6, vol: 0.12, filter: { freq: 500 + I * 900 } });
          }
        }
        // pad
        if (s.pad && st === 0) {
          for (const d of [0, 2, 4]) tone(out, { type: "triangle", f0: mtof(note(chord + d, 0)), t, dur: stepDur * 15, vol: 0.035, a: 0.4, detune: (Math.random() - 0.5) * 12 });
        }
        // lead
        if (s.lead !== "none" && I > 0.25) {
          const deg = m.melody[st];
          if (deg >= 0 && (st % 2 === 0 || I > 0.6)) {
            const type = s.lead === "saw" ? "sawtooth" : s.lead;
            tone(out, { type, f0: mtof(note(chord + deg, 1)), t, dur: stepDur * 1.8, vol: 0.06, filter: { freq: 2800 } });
          }
        }
        m.step += 1;
        m.next += stepDur;
        if (m.step % 64 === 0) {
          // mutate melody a bit every 4 bars
          for (let i = 0; i < 4; i += 1) m.melody[(Math.random() * 16) | 0] = Math.random() < 0.6 ? (Math.random() * scale.length * 1.5) | 0 : -1;
        }
      }
    };
    seqTimer = setInterval(tick, 25);
  }

  function musicStop() {
    if (seqTimer) clearInterval(seqTimer);
    seqTimer = null;
    musicState = null;
  }

  /** 0..1 — thins or fills drums/lead (chase, boss, final lap). */
  function setIntensity(v) {
    if (musicState) musicState.intensity = Math.max(0, Math.min(1, v));
  }

  /** Temporarily lower music/ambience (dialog, stingers). */
  function duck(amount = 0.35, seconds = 1) {
    if (!ready()) return;
    const t = ctx.currentTime;
    for (const k of ["music", "ambience"]) {
      bus[k].gain.cancelScheduledValues(t);
      bus[k].gain.setTargetAtTime(levels[k] * amount, t, 0.05);
      bus[k].gain.setTargetAtTime(levels[k], t + seconds, 0.3);
    }
  }

  function setVolume(name, v) {
    levels[name] = Math.max(0, v);
    if (!ctx) return;
    if (name === "master") master.gain.value = levels.master;
    else if (bus[name]) bus[name].gain.value = levels[name];
  }

  // Start deferred music/ambience once unlocked
  const deferTimer = setInterval(() => {
    if (!ready()) return;
    if (pendingMusic) {
      const [s, o] = pendingMusic;
      pendingMusic = null;
      musicPlay(s, o);
    }
    if (pendingAmbience) {
      const k = pendingAmbience;
      pendingAmbience = null;
      ambience(k);
    }
  }, 150);

  function dispose() {
    disposed = true;
    clearInterval(deferTimer);
    musicStop();
    stopAmbience();
    stopEngine();
    window.removeEventListener("pointerdown", onFirst);
    window.removeEventListener("keydown", onFirst);
    try {
      ctx?.close();
    } catch {
      /* */
    }
    ctx = null;
  }

  return {
    unlock,
    sfx,
    setEngine,
    stopEngine,
    ambience,
    stopAmbience,
    music: musicPlay,
    stopMusic: musicStop,
    setIntensity,
    duck,
    setVolume,
    get presets() {
      return Object.keys(SFX);
    },
    dispose,
  };
}
