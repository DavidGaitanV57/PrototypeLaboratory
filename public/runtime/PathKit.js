/**
 * Spline paths, progress, and checkpoint helpers for races, patrols, lanes.
 */
import * as THREE from "/vendor/three/build/three.module.js";

/**
 * @param {THREE.Vector3[] | [number,number,number][]} points
 */
export function createPath(points, { closed = true, tension = 0.5 } = {}) {
  const vecs = points.map((p) =>
    p instanceof THREE.Vector3 ? p.clone() : new THREE.Vector3(p[0], p[1] ?? 0, p[2]),
  );
  const curve = new THREE.CatmullRomCurve3(vecs, closed, "catmullrom", tension);
  const samples = 256;
  const lut = [];
  let totalLen = 0;
  let prev = curve.getPointAt(0);
  lut.push({ t: 0, len: 0, point: prev.clone() });
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const pt = curve.getPointAt(t);
    totalLen += prev.distanceTo(pt);
    lut.push({ t, len: totalLen, point: pt.clone() });
    prev = pt;
  }

  function pointAtT(t) {
    return curve.getPointAt(((t % 1) + 1) % 1);
  }

  function tangentAtT(t) {
    return curve.getTangentAt(((t % 1) + 1) % 1).normalize();
  }

  function tAtLength(len) {
    const d = ((len % totalLen) + totalLen) % totalLen;
    for (let i = 1; i < lut.length; i++) {
      if (lut[i].len >= d) {
        const a = lut[i - 1];
        const b = lut[i];
        const f = (d - a.len) / Math.max(1e-6, b.len - a.len);
        return a.t + (b.t - a.t) * f;
      }
    }
    return 0;
  }

  function nearestT(worldPos) {
    let bestT = 0;
    let bestD = Infinity;
    const p = worldPos instanceof THREE.Vector3 ? worldPos : new THREE.Vector3(...worldPos);
    for (const row of lut) {
      const d = row.point.distanceToSquared(p);
      if (d < bestD) {
        bestD = d;
        bestT = row.t;
      }
    }
    return { t: bestT, distance: Math.sqrt(bestD) };
  }

  function progressDelta(t0, t1) {
    if (!closed) return t1 - t0;
    let d = t1 - t0;
    if (d < -0.5) d += 1;
    if (d > 0.5) d -= 1;
    return d;
  }

  return {
    curve,
    length: totalLen,
    pointAtT,
    tangentAtT,
    tAtLength,
    nearestT,
    progressDelta,
    lut,
  };
}

/**
 * Lap / checkpoint gate: fires when player crosses a progress threshold.
 */
export function createProgressGate({ onCross } = {}) {
  let lastT = null;
  let armed = true;
  return {
    reset(t) {
      lastT = t;
      armed = true;
    },
    sample(t, path, { threshold = 0.02 } = {}) {
      if (lastT == null) {
        lastT = t;
        return false;
      }
      const delta = path.progressDelta(lastT, t);
      lastT = t;
      if (!armed) return false;
      if (delta < -threshold) {
        armed = false;
        onCross?.();
        return true;
      }
      return false;
    },
    rearm() {
      armed = true;
    },
  };
}
