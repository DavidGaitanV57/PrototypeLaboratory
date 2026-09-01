/**
 * Lightweight game feel — shake, flash, hit-stop, mesh pop. No assets required.
 */
import * as THREE from "/vendor/three/build/three.module.js";

export function createJuice({ camera, canvas, scene } = {}) {
  let shakeAmp = 0;
  let shakeT = 0;
  const basePos = new THREE.Vector3();
  let hasBase = false;

  let hitStopT = 0;
  let timeScale = 1;

  let flashEl = null;
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
  }

  function captureCameraBase() {
    if (!camera) return;
    basePos.copy(camera.position);
    hasBase = true;
  }

  function shake(intensity = 0.4, duration = 0.25) {
    shakeAmp = Math.max(shakeAmp, intensity);
    shakeT = Math.max(shakeT, duration);
    if (!hasBase && camera) captureCameraBase();
  }

  function flash(color = "#ffffff", duration = 0.35) {
    if (!flashEl) return;
    flashEl.style.background = color;
    flashEl.style.opacity = "0.55";
    setTimeout(() => {
      flashEl.style.opacity = "0";
    }, duration * 1000);
  }

  function hitStop(duration = 0.06) {
    hitStopT = Math.max(hitStopT, duration);
  }

  /** Scale pop on a mesh or group, then ease back. */
  function pop(object3d, { peak = 1.2, duration = 0.2 } = {}) {
    if (!object3d?.scale) return;
    const base = object3d.scale.clone();
    const start = performance.now();
    const dur = duration * 1000;
    function tick() {
      const t = (performance.now() - start) / dur;
      if (t >= 1) {
        object3d.scale.copy(base);
        return;
      }
      const s = t < 0.5 ? 1 + (peak - 1) * (t / 0.5) : peak - (peak - 1) * ((t - 0.5) / 0.5);
      object3d.scale.set(base.x * s, base.y * s, base.z * s);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /** Brief emissive flash on a mesh material. */
  function emissiveFlash(mesh, color = 0xffffff, duration = 0.15) {
    if (!mesh?.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const saved = mats.map((m) => ({
      emissive: m.emissive?.getHex?.() ?? 0,
      intensity: m.emissiveIntensity ?? 0,
    }));
    for (const m of mats) {
      if (m.emissive) m.emissive.setHex(color);
      m.emissiveIntensity = 0.8;
    }
    setTimeout(() => {
      mats.forEach((m, i) => {
        if (m.emissive) m.emissive.setHex(saved[i].emissive);
        m.emissiveIntensity = saved[i].intensity;
      });
    }, duration * 1000);
  }

  /**
   * Call once per frame before simulation. Returns scaled delta (hit-stop).
   */
  function filterDelta(dt) {
    if (hitStopT > 0) {
      hitStopT -= dt;
      return 0;
    }
    return dt * timeScale;
  }

  /** Call after camera follow, before render. */
  function update(dt) {
    if (camera && shakeT > 0) {
      shakeT -= dt;
      const f = shakeT > 0 ? shakeAmp * (shakeT / 0.25) : 0;
      camera.position.x = basePos.x + (Math.random() - 0.5) * f;
      camera.position.y = basePos.y + (Math.random() - 0.5) * f * 0.6;
      camera.position.z = basePos.z + (Math.random() - 0.5) * f;
      if (shakeT <= 0 && hasBase) camera.position.copy(basePos);
    } else if (camera && hasBase) {
      basePos.copy(camera.position);
    }
  }

  function setTimeScale(s) {
    timeScale = Math.max(0.05, s);
  }

  function dispose() {
    flashEl?.remove();
    flashEl = null;
  }

  return {
    shake,
    flash,
    hitStop,
    pop,
    emissiveFlash,
    filterDelta,
    update,
    setTimeScale,
    captureCameraBase,
    dispose,
  };
}
