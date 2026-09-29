/**
 * Cameras: follow, FPS, chase (speed FOV, look-ahead, wall pull-in), third-person orbit, cinematic intro orbit.
 */
import * as THREE from "/vendor/three/build/three.module.js";

export function createFollowCamera(camera, target, opts = {}) {
  const offset = new THREE.Vector3(...(opts.offset || [0, 5, 10]));
  const look = new THREE.Vector3(...(opts.look || [0, 1, 0]));
  const damp = opts.damp ?? 8;
  const tmp = new THREE.Vector3();
  const lookAt = new THREE.Vector3();

  return {
    update(dt) {
      if (!target) return;
      tmp.copy(target.position).add(offset);
      camera.position.lerp(tmp, 1 - Math.exp(-damp * dt));
      lookAt.copy(target.position).add(look);
      camera.lookAt(lookAt);
    },
    setOffset(x, y, z) {
      offset.set(x, y, z);
    },
  };
}

export function createFpsCamera(camera, input, opts = {}) {
  const yawPitch = { yaw: 0, pitch: 0 };
  const sens = opts.sens ?? 0.002;
  const eye = opts.eyeHeight ?? 1.6;
  const pos = new THREE.Vector3();

  return {
    yawPitch,
    attach(body) {
      this.body = body;
    },
    update(_dt) {
      const d = input.mouseDelta();
      yawPitch.yaw -= d.x * sens;
      yawPitch.pitch -= d.y * sens;
      yawPitch.pitch = Math.max(-1.4, Math.min(1.4, yawPitch.pitch));
      if (this.body) {
        pos.copy(this.body.position);
        pos.y += eye;
        camera.position.copy(pos);
      }
      camera.rotation.order = "YXZ";
      camera.rotation.y = yawPitch.yaw;
      camera.rotation.x = yawPitch.pitch;
    },
  };
}

const _v = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _look = new THREE.Vector3();
const _ray = new THREE.Raycaster();

/**
 * Chase camera for vehicles / runners: sits behind the target's heading, looks ahead,
 * widens FOV with speed and pulls in when walls block the view.
 * update(dt, { speed }) — speed in m/s.
 */
export function createChaseCamera(camera, target, opts = {}) {
  const o = {
    distance: 7,
    height: 3,
    lookAhead: 4,
    lookHeight: 1,
    damp: 6,
    fovBase: camera.fov || 65,
    fovGain: 0.6,
    fovMax: 92,
    collide: [],
    ...opts,
  };
  let fov = o.fovBase;
  return {
    update(dt, { speed = 0 } = {}) {
      if (!target) return;
      _fwd.set(0, 0, 1).applyQuaternion(target.quaternion).setY(0).normalize();
      _v.copy(target.position).addScaledVector(_fwd, -o.distance);
      _v.y += o.height;
      if (o.collide.length) {
        _look.copy(target.position);
        _look.y += o.lookHeight;
        const dir = _v.clone().sub(_look);
        const len = dir.length();
        _ray.set(_look, dir.normalize());
        _ray.far = len;
        const hit = _ray.intersectObjects(o.collide, true)[0];
        if (hit) _v.copy(_look).addScaledVector(dir, Math.max(1.2, hit.distance - 0.4));
      }
      camera.position.lerp(_v, 1 - Math.exp(-o.damp * dt));
      _look.copy(target.position).addScaledVector(_fwd, o.lookAhead);
      _look.y += o.lookHeight;
      camera.lookAt(_look);
      const want = Math.min(o.fovMax, o.fovBase + Math.abs(speed) * o.fovGain);
      fov += (want - fov) * (1 - Math.exp(-4 * dt));
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    },
    snap() {
      _fwd.set(0, 0, 1).applyQuaternion(target.quaternion).setY(0).normalize();
      camera.position.copy(target.position).addScaledVector(_fwd, -o.distance);
      camera.position.y += o.height;
    },
    set(partial) {
      Object.assign(o, partial);
    },
  };
}

/**
 * Mouse-orbit third-person camera (pointer lock on click). yaw is exposed so movement can be camera-relative.
 */
export function createThirdPersonCamera(camera, target, input, opts = {}) {
  const o = { distance: 6, minPitch: -0.35, maxPitch: 1.1, sens: 0.0025, height: 1.4, damp: 12, collide: [], pointerLock: null, ...opts };
  const state = { yaw: opts.yaw ?? Math.PI, pitch: opts.pitch ?? 0.35 };
  const onClick = () => o.pointerLock?.requestPointerLock?.();
  o.pointerLock?.addEventListener?.("click", onClick);
  return {
    state,
    get yaw() {
      return state.yaw;
    },
    update(dt) {
      const d = input?.mouseDelta?.() || { x: 0, y: 0 };
      state.yaw -= d.x * o.sens;
      state.pitch = Math.max(o.minPitch, Math.min(o.maxPitch, state.pitch + d.y * o.sens));
      _look.copy(target.position);
      _look.y += o.height;
      _v.set(Math.sin(state.yaw) * Math.cos(state.pitch), Math.sin(state.pitch), Math.cos(state.yaw) * Math.cos(state.pitch));
      let dist = o.distance;
      if (o.collide.length) {
        _ray.set(_look, _v);
        _ray.far = dist;
        const hit = _ray.intersectObjects(o.collide, true)[0];
        if (hit) dist = Math.max(1, hit.distance - 0.3);
      }
      const want = _look.clone().addScaledVector(_v, dist);
      camera.position.lerp(want, 1 - Math.exp(-o.damp * dt));
      camera.lookAt(_look);
    },
    /** Camera-relative move vector from input.axis(): moveDir(axis.x, axis.y). */
    moveDir(ax, az, out = new THREE.Vector3()) {
      out.set(Math.sin(state.yaw), 0, Math.cos(state.yaw)).multiplyScalar(-az);
      out.x += Math.cos(state.yaw) * ax;
      out.z -= Math.sin(state.yaw) * ax;
      return out.lengthSq() > 1 ? out.normalize() : out;
    },
    dispose() {
      o.pointerLock?.removeEventListener?.("click", onClick);
    },
  };
}

/**
 * Cinematic intro: orbit + descend around a focus point, then hand control back.
 * update(dt) → true while playing. skip() ends it. Great for the first 3 seconds.
 */
export function createIntroOrbit(camera, { center, radius = 30, height = 14, endRadius = 10, endHeight = 5, turns = 0.35, duration = 3.2, onDone } = {}) {
  let t = 0;
  let done = false;
  const c = center ? new THREE.Vector3(center.x, center.y, center.z) : new THREE.Vector3();
  return {
    update(dt) {
      if (done) return false;
      t += dt;
      const k = Math.min(1, t / duration);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      const ang = e * turns * Math.PI * 2;
      const r = radius + (endRadius - radius) * e;
      const h = height + (endHeight - height) * e;
      camera.position.set(c.x + Math.sin(ang) * r, c.y + h, c.z + Math.cos(ang) * r);
      camera.lookAt(c);
      if (k >= 1) {
        done = true;
        onDone?.();
      }
      return !done;
    },
    skip() {
      if (!done) {
        done = true;
        onDone?.();
      }
    },
    get playing() {
      return !done;
    },
  };
}
