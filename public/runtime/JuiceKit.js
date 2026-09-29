/**
 * Game feel — trauma shake, flash, hit-stop, FOV kick, slow-mo, squash, dt tweens, floating text, impact presets. Optional LookKit pulses.
 */
import * as THREE from "/vendor/three/build/three.module.js";

export const EASE = {
  linear: (t) => t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outElastic: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};

// Smooth pseudo-noise for shake (sum of incommensurate sines)
function noise1(t, seed) {
  return (
    Math.sin(t * 13.1 + seed) * 0.5 +
    Math.sin(t * 27.7 + seed * 1.7) * 0.3 +
    Math.sin(t * 51.3 + seed * 2.3) * 0.2
  );
}

/**
 * @param {{ camera?: THREE.Camera, canvas?: HTMLCanvasElement, scene?: THREE.Scene, look?: object, maxShake?: number }} opts
 */
export function createJuice({ camera, canvas, scene, look, maxShake = 0.6 } = {}) {
  void scene;
  let trauma = 0;
  let traumaDecay = 1.6;
  let t = 0;
  const lastOffset = new THREE.Vector3();
  let lastRoll = 0;
  let offsetApplied = false;

  let hitStopT = 0;
  let timeScale = 1;
  let slow = null;

  let fovBase = camera?.isPerspectiveCamera ? camera.fov : null;
  let fovKick = 0;
  let fovVel = 0;

  const tweens = [];
  const floaters = [];

  let flashEl = null;
  let layer = null;
  if (canvas?.parentElement) {
    flashEl = document.createElement("div");
    Object.assign(flashEl.style, {
      position: "absolute",
      inset: "0",
      pointerEvents: "none",
      opacity: "0",
      zIndex: "3",
      transition: "opacity 0.05s",
    });
    canvas.parentElement.appendChild(flashEl);
    layer = document.createElement("div");
    Object.assign(layer.style, { position: "absolute", inset: "0", pointerEvents: "none", zIndex: "4", overflow: "hidden" });
    canvas.parentElement.appendChild(layer);
  }

  function removeOffset() {
    if (!camera || !offsetApplied) return;
    camera.position.sub(lastOffset);
    camera.rotation.z -= lastRoll;
    lastOffset.set(0, 0, 0);
    lastRoll = 0;
    offsetApplied = false;
  }

  /** Legacy-compatible: intensity 0..1 adds trauma; duration sets decay. */
  function shake(intensity = 0.4, duration = 0.25) {
    trauma = Math.min(1, trauma + intensity);
    traumaDecay = Math.max(0.8, 1 / Math.max(0.12, duration * 1.4));
    look?.pulse?.({ chroma: intensity * 0.006, duration: Math.max(0.15, duration) });
  }

  function flash(color = "#ffffff", duration = 0.35, opacity = 0.55) {
    if (!flashEl) return;
    flashEl.style.transition = "opacity 0.03s";
    flashEl.style.background = color;
    flashEl.style.opacity = String(opacity);
    setTimeout(() => {
      if (!flashEl) return;
      flashEl.style.transition = `opacity ${Math.max(0.05, duration)}s ease-out`;
      flashEl.style.opacity = "0";
    }, 40);
  }

  function hitStop(duration = 0.06) {
    hitStopT = Math.max(hitStopT, duration);
  }

  /** FOV punch (degrees, positive = zoom out), springs back. */
  function kick(degrees = 6) {
    if (fovBase == null && camera?.isPerspectiveCamera) fovBase = camera.fov;
    fovVel += degrees * 14;
  }

  /** Time dilation that eases back to 1 over duration (real seconds). */
  function slowMo(scale = 0.3, duration = 0.6) {
    slow = { scale: Math.max(0.05, scale), t: 0, duration: Math.max(0.05, duration) };
  }

  /** dt-driven tween of numeric props: tween(mesh.position, { y: 2 }, { duration: 0.4, ease: "outBack" }) */
  function tween(target, to, { duration = 0.3, ease = "outCubic", delay = 0, onDone } = {}) {
    const from = {};
    for (const k of Object.keys(to)) from[k] = target[k];
    const tw = { target, from, to, t: -delay, duration: Math.max(0.001, duration), ease: EASE[ease] || EASE.outCubic, onDone };
    tweens.push(tw);
    return {
      cancel() {
        const i = tweens.indexOf(tw);
        if (i >= 0) tweens.splice(i, 1);
      },
    };
  }

  /** Scale pop on a mesh or group, then ease back (dt-driven). */
  function pop(object3d, { peak = 1.2, duration = 0.2 } = {}) {
    if (!object3d?.scale) return;
    const base = object3d.userData.__popBase || object3d.scale.clone();
    object3d.userData.__popBase = base;
    object3d.scale.copy(base).multiplyScalar(peak);
    tween(object3d.scale, { x: base.x, y: base.y, z: base.z }, {
      duration,
      ease: "outElastic",
      onDone: () => delete object3d.userData.__popBase,
    });
  }

  /** Squash (amount>0) or stretch (amount<0) with elastic recovery. */
  function squash(object3d, amount = 0.3, duration = 0.35) {
    if (!object3d?.scale) return;
    const base = object3d.userData.__sqBase || object3d.scale.clone();
    object3d.userData.__sqBase = base;
    object3d.scale.set(base.x * (1 + amount * 0.5), base.y * (1 - amount), base.z * (1 + amount * 0.5));
    tween(object3d.scale, { x: base.x, y: base.y, z: base.z }, {
      duration,
      ease: "outElastic",
      onDone: () => delete object3d.userData.__sqBase,
    });
  }

  /** Brief emissive flash on a mesh material. */
  function emissiveFlash(mesh, color = 0xffffff, duration = 0.15) {
    const mats = [];
    mesh?.traverse?.((o) => {
      if (o.material) mats.push(...(Array.isArray(o.material) ? o.material : [o.material]));
    });
    const saved = mats.map((m) => ({ m, e: m.emissive?.getHex?.() ?? 0, i: m.emissiveIntensity ?? 0 }));
    for (const { m } of saved) {
      if (m.emissive) m.emissive.setHex(color);
      m.emissiveIntensity = 1.5;
    }
    setTimeout(() => {
      for (const s of saved) {
        if (s.m.emissive) s.m.emissive.setHex(s.e);
        s.m.emissiveIntensity = s.i;
      }
    }, duration * 1000);
  }

  /** Floating world-space text ("+100", "CRIT!", "LAP 2"). */
  function floatText(worldPos, text, { color = "#ffffff", size = 22, duration = 0.9, rise = 1.4 } = {}) {
    if (!layer || !camera) return;
    const el = document.createElement("div");
    el.textContent = text;
    Object.assign(el.style, {
      position: "absolute",
      left: "0",
      top: "0",
      font: `900 ${size}px "Arial Black", system-ui, sans-serif`,
      color,
      textShadow: "0 2px 0 rgba(0,0,0,0.55), 0 0 12px rgba(0,0,0,0.35)",
      whiteSpace: "nowrap",
      willChange: "transform, opacity",
    });
    layer.appendChild(el);
    floaters.push({ el, pos: worldPos.clone ? worldPos.clone() : new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z), t: 0, duration, rise });
  }

  /** Preset combos: "light" | "medium" | "heavy" | "win" | "lose". */
  function impact(level = "medium", { color } = {}) {
    if (level === "light") {
      shake(0.18, 0.15);
      kick(1.5);
    } else if (level === "heavy") {
      shake(0.7, 0.45);
      hitStop(0.09);
      kick(-7);
      flash(color || "#ffffff", 0.25, 0.4);
      look?.pulse?.({ exposure: 0.35, chroma: 0.01, duration: 0.35 });
    } else if (level === "win") {
      slowMo(0.35, 1.2);
      kick(-5);
      flash(color || "#fff6c8", 0.6, 0.35);
      look?.pulse?.({ exposure: 0.3, bloom: 0.6, saturation: 0.2, duration: 1.2 });
    } else if (level === "lose") {
      slowMo(0.2, 1.4);
      shake(0.6, 0.5);
      flash(color || "#200000", 0.8, 0.5);
      look?.pulse?.({ saturation: -0.8, vignette: 0.4, duration: 1.6 });
    } else {
      shake(0.38, 0.25);
      hitStop(0.045);
      kick(3);
      look?.pulse?.({ exposure: 0.15, duration: 0.2 });
    }
  }

  /**
   * Call once per frame before simulation. Returns scaled delta (hit-stop + slow-mo).
   */
  function filterDelta(dt) {
    removeOffset();
    if (hitStopT > 0) {
      hitStopT -= dt;
      return 0;
    }
    let s = timeScale;
    if (slow) {
      slow.t += dt;
      const k = Math.min(1, slow.t / slow.duration);
      s *= slow.scale + (1 - slow.scale) * EASE.inOutCubic(k);
      if (k >= 1) slow = null;
    }
    return dt * s;
  }

  const proj = new THREE.Vector3();
  /** Call after camera follow, before render (real dt). */
  function update(dt) {
    t += dt;
    removeOffset();

    for (let i = tweens.length - 1; i >= 0; i -= 1) {
      const tw = tweens[i];
      tw.t += dt;
      if (tw.t < 0) continue;
      const k = Math.min(1, tw.t / tw.duration);
      const e = tw.ease(k);
      for (const key of Object.keys(tw.to)) tw.target[key] = tw.from[key] + (tw.to[key] - tw.from[key]) * e;
      if (k >= 1) {
        tweens.splice(i, 1);
        tw.onDone?.();
      }
    }

    if (camera) {
      if (trauma > 0) {
        const s = trauma * trauma * maxShake;
        lastOffset.set(noise1(t, 1.3) * s, noise1(t, 7.1) * s * 0.7, noise1(t, 3.7) * s * 0.5);
        lastRoll = noise1(t, 11.9) * s * 0.06;
        camera.position.add(lastOffset);
        camera.rotation.z += lastRoll;
        offsetApplied = true;
        trauma = Math.max(0, trauma - traumaDecay * dt);
      }
      if (camera.isPerspectiveCamera && fovBase != null && (fovKick !== 0 || fovVel !== 0)) {
        // critically-damped-ish spring back to 0
        fovVel += (-fovKick * 160 - fovVel * 18) * dt;
        fovKick += fovVel * dt;
        if (Math.abs(fovKick) < 0.01 && Math.abs(fovVel) < 0.05) {
          fovKick = 0;
          fovVel = 0;
        }
        camera.fov = fovBase + fovKick;
        camera.updateProjectionMatrix();
      }
    }

    if (floaters.length && camera && canvas) {
      const w = canvas.clientWidth || 1;
      const h = canvas.clientHeight || 1;
      for (let i = floaters.length - 1; i >= 0; i -= 1) {
        const f = floaters[i];
        f.t += dt;
        const k = f.t / f.duration;
        proj.copy(f.pos);
        proj.y += f.rise * EASE.outCubic(Math.min(1, k));
        proj.project(camera);
        const x = (proj.x * 0.5 + 0.5) * w;
        const y = (-proj.y * 0.5 + 0.5) * h;
        const sc = k < 0.15 ? 0.6 + (k / 0.15) * 0.6 : 1.2 - Math.min(0.2, (k - 0.15) * 0.4);
        f.el.style.transform = `translate(-50%,-50%) translate(${x}px, ${y}px) scale(${sc})`;
        f.el.style.opacity = String(proj.z > 1 ? 0 : 1 - Math.max(0, (k - 0.6) / 0.4));
        if (k >= 1) {
          f.el.remove();
          floaters.splice(i, 1);
        }
      }
    }
  }

  function setTimeScale(s) {
    timeScale = Math.max(0.05, s);
  }

  /** Legacy no-op kept for older gameplay (offsets are relative now). */
  function captureCameraBase() {
    if (camera?.isPerspectiveCamera) fovBase = camera.fov;
  }

  function dispose() {
    removeOffset();
    if (camera?.isPerspectiveCamera && fovBase != null) {
      camera.fov = fovBase;
      camera.updateProjectionMatrix();
    }
    flashEl?.remove();
    layer?.remove();
    flashEl = null;
    layer = null;
    tweens.length = 0;
    floaters.length = 0;
  }

  return {
    shake,
    flash,
    hitStop,
    kick,
    slowMo,
    impact,
    pop,
    squash,
    tween,
    floatText,
    emissiveFlash,
    filterDelta,
    update,
    setTimeScale,
    captureCameraBase,
    dispose,
  };
}
