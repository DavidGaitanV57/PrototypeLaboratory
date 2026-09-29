/**
 * Arcade kart — shared by player and AI. Drift charges mini-turbos; items: turbo / shock.
 */
import * as THREE from "/vendor/three/build/three.module.js";
import { makeVehicle, animateVehicle } from "/runtime/Primitives.js";

const FWD = new THREE.Vector3();
const RIGHT = new THREE.Vector3();

export function createKart(scene, { color, helmet = 0xffffff, TUNING, name = "Kart" }) {
  const mesh = makeVehicle(color, { helmet });
  mesh.name = name;
  scene.add(mesh);
  const s = {
    mesh,
    name,
    yaw: 0,
    speed: 0,
    steer: 0,
    drift: 0, // -1 / 0 / 1
    driftT: 0,
    boostT: 0,
    slowT: 0,
    offroad: false,
    item: null,
    progress: 0,
    lastT: 0,
    finished: false,
    finishTime: 0,
    lapTimes: [],
    lapStart: 0,
    bumpV: new THREE.Vector3(),
  };

  function place(position, yaw, t) {
    mesh.position.copy(position);
    s.yaw = yaw;
    s.speed = 0;
    s.drift = 0;
    s.driftT = 0;
    s.boostT = 0;
    s.slowT = 0;
    s.item = null;
    s.lastT = t;
    s.progress = t > 0.5 ? t - 1 : t;
    s.finished = false;
    s.finishTime = 0;
    s.lapTimes = [];
    s.lapStart = 0;
    s.bumpV.set(0, 0, 0);
    mesh.rotation.set(0, yaw, 0);
  }

  /**
   * @param {{ throttle:number, steer:number, drift:boolean }} ctl
   * @returns {{ driftRelease?: number }} events
   */
  function step(dt, ctl, { offroad = false } = {}) {
    const T = TUNING;
    const ev = {};
    s.offroad = offroad;
    let top = T.maxSpeed * (offroad ? T.offroadMul : 1) * (s.slowT > 0 ? 0.45 : 1);
    if (s.boostT > 0) top = Math.max(top, T.boostSpeed);
    if (ctl.throttle > 0) s.speed += T.accel * ctl.throttle * dt;
    else if (ctl.throttle < 0) s.speed -= (s.speed > 0 ? T.brake : T.accel * 0.6) * -ctl.throttle * dt;
    else s.speed -= s.speed * T.coastDrag * dt;
    if (s.boostT > 0) s.speed += (T.boostSpeed - s.speed) * Math.min(1, dt * 4);
    s.speed = THREE.MathUtils.clamp(s.speed, -T.reverseSpeed, top + 0.01);
    if (s.speed > top) s.speed += (top - s.speed) * Math.min(1, dt * 3);

    // Drift: hold while steering above min speed
    const wantsDrift = ctl.drift && Math.abs(ctl.steer) > 0.2 && s.speed > T.driftMinSpeed && !offroad;
    if (wantsDrift && !s.drift) s.drift = Math.sign(ctl.steer);
    if (s.drift && (!ctl.drift || s.speed < T.driftMinSpeed * 0.7)) {
      const tier = s.driftT >= T.miniTurbo[1] ? 2 : s.driftT >= T.miniTurbo[0] ? 1 : 0;
      if (tier) {
        s.boostT = Math.max(s.boostT, T.boostTime[tier - 1]);
        ev.driftRelease = tier;
      }
      s.drift = 0;
      s.driftT = 0;
    }
    if (s.drift) s.driftT += dt;

    s.steer += (ctl.steer - s.steer) * Math.min(1, dt * 10);
    const grip = THREE.MathUtils.clamp(Math.abs(s.speed) / 10, 0, 1) * Math.sign(s.speed || 1);
    let yawRate = -s.steer * T.steerRate * grip;
    if (s.drift) yawRate = -(s.drift * 0.75 + s.steer * 0.55) * T.steerRate * T.driftSteerMul * grip;
    s.yaw += yawRate * dt;

    FWD.set(Math.sin(s.yaw), 0, Math.cos(s.yaw));
    RIGHT.set(Math.cos(s.yaw), 0, -Math.sin(s.yaw));
    mesh.position.addScaledVector(FWD, s.speed * dt);
    if (s.drift) mesh.position.addScaledVector(RIGHT, s.drift * s.speed * T.driftSlide * dt); // slide outward
    mesh.position.addScaledVector(s.bumpV, dt);
    s.bumpV.multiplyScalar(Math.exp(-dt * 6));

    const visualYaw = s.yaw - (s.drift ? s.drift * 0.35 : 0); // nose into the turn
    mesh.rotation.y += (visualYaw - mesh.rotation.y) * Math.min(1, dt * 12);
    animateVehicle(mesh, dt, { speed: s.speed, steer: -(s.drift ? s.drift : s.steer), accel: ctl.throttle });
    mesh.position.y = offroad ? Math.sin(performance.now() * 0.05) * 0.03 : 0;

    if (s.boostT > 0) s.boostT -= dt;
    if (s.slowT > 0) s.slowT -= dt;
    return ev;
  }

  return {
    state: s,
    mesh,
    place,
    step,
    get driftTier() {
      if (!s.drift) return 0;
      return s.driftT >= TUNING.miniTurbo[1] ? 2 : s.driftT >= TUNING.miniTurbo[0] ? 1 : 0;
    },
    dispose() {
      scene.remove(mesh);
    },
  };
}

/** Racing line follower — used for rivals and for autoplay. */
export function createDriver(path, { skill = 1, lane = 0, lookAhead = 0.025 } = {}) {
  const target = new THREE.Vector3();
  const side = new THREE.Vector3();
  let laneT = Math.random() * 10;
  return {
    skill,
    control(kartState, dt, { rubber = 0 } = {}) {
      laneT += dt * 0.3;
      const t = kartState.lastT + lookAhead + Math.min(0.02, Math.abs(kartState.speed) * 0.0006);
      target.copy(path.pointAtT(t));
      side.crossVectors(path.tangentAtT(t), new THREE.Vector3(0, 1, 0)).normalize();
      target.addScaledVector(side, lane + Math.sin(laneT) * 1.5);
      const dx = target.x - kartState.mesh.position.x;
      const dz = target.z - kartState.mesh.position.z;
      const want = Math.atan2(dx, dz);
      let diff = want - kartState.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = THREE.MathUtils.clamp(-diff * 2.2, -1, 1);
      const sharp = Math.abs(diff) > 0.45;
      return {
        throttle: sharp && kartState.speed > 20 ? 0.2 : Math.min(1, skill * (1 + rubber)),
        steer,
        drift: Math.abs(diff) > 0.25 && kartState.speed > 16,
      };
    },
  };
}
