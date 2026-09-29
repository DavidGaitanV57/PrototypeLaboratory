/**
 * Player — responsive 3D platforming: accel/friction, coyote time, jump buffer, variable jump, double jump,
 * moving-platform carry, AABB collisions. Visual: makeHero rig with procedural animation + squash/stretch.
 */
import * as THREE from "/vendor/three/build/three.module.js";
import { makeHero, animateCharacter, squashCharacter } from "/runtime/Primitives.js";

const HALF = new THREE.Vector3(0.35, 0.8, 0.35);

export function createPlayer(scene, { LOOK, TUNING }) {
  const mesh = makeHero({ body: LOOK.palette.hero, accent: LOOK.palette.heroAccent, accessory: "cap" });
  scene.add(mesh);
  const T = TUNING;
  const s = {
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    grounded: false,
    groundCol: null,
    coyote: 0,
    buffer: 0,
    jumps: 0,
    facing: 0,
    stun: 0,
  };

  function reset(p) {
    s.pos.copy(p);
    s.vel.set(0, 0, 0);
    s.grounded = false;
    s.jumps = 0;
    s.stun = 0;
    s.facing = Math.PI;
    mesh.position.copy(p);
  }

  /**
   * @param {{ x:number, z:number, jumpPressed:boolean, jumpHeld:boolean }} ctl  x/z in world units (-1..1)
   * @returns {{ jumped?:boolean, doubleJumped?:boolean, landed?:number, bounced?:boolean }}
   */
  function step(dt, ctl, colliders) {
    const ev = {};
    const wish = new THREE.Vector3(ctl.x, 0, ctl.z);
    if (wish.lengthSq() > 1) wish.normalize();
    if (s.stun > 0) {
      s.stun -= dt;
      wish.set(0, 0, 0);
    }
    const accel = s.grounded ? T.groundAccel : T.airAccel;
    const target = wish.multiplyScalar(T.moveSpeed);
    const hv = new THREE.Vector3(s.vel.x, 0, s.vel.z);
    const diff = target.clone().sub(hv);
    const maxStep = (target.lengthSq() > 0.01 ? accel : T.friction * (s.grounded ? 1 : 0.2)) * dt;
    if (diff.length() > maxStep) diff.setLength(maxStep);
    s.vel.x += diff.x;
    s.vel.z += diff.z;

    // Jump logic
    s.coyote = s.grounded ? T.coyoteTime : s.coyote - dt;
    s.buffer = ctl.jumpPressed ? T.jumpBuffer : s.buffer - dt;
    if (s.buffer > 0 && (s.grounded || s.coyote > 0)) {
      s.vel.y = T.jumpVel;
      s.grounded = false;
      s.coyote = 0;
      s.buffer = 0;
      s.jumps = 1;
      ev.jumped = true;
      squashCharacter(mesh, -0.25);
    } else if (ctl.jumpPressed && !s.grounded && s.jumps < 2) {
      s.vel.y = T.doubleJumpVel;
      s.jumps = 2;
      s.buffer = 0;
      ev.doubleJumped = true;
      squashCharacter(mesh, -0.3);
    }
    if (!ctl.jumpHeld && s.vel.y > 0 && s.jumps === 1) s.vel.y *= Math.pow(T.jumpCut, dt * 10);

    const g = s.vel.y < 0 ? T.gravity * T.fallGravityMul : T.gravity;
    s.vel.y = Math.max(-T.maxFall, s.vel.y - g * dt);

    // Carry on moving platforms
    if (s.grounded && s.groundCol) s.pos.addScaledVector(s.groundCol.vel, dt);

    // Integrate + resolve (Y then XZ)
    const wasGrounded = s.grounded;
    const fallSpeed = -s.vel.y;
    s.pos.y += s.vel.y * dt;
    s.grounded = false;
    s.groundCol = null;
    for (const c of colliders) {
      const dx = Math.abs(s.pos.x - c.center.x) - (HALF.x + c.half.x);
      const dz = Math.abs(s.pos.z - c.center.z) - (HALF.z + c.half.z);
      if (dx >= 0 || dz >= 0) continue;
      const top = c.center.y + c.half.y;
      const bottom = c.center.y - c.half.y;
      const feet = s.pos.y;
      const head = s.pos.y + HALF.y * 2;
      if (s.vel.y <= 0 && feet < top && feet > top - 0.9) {
        s.pos.y = top;
        s.vel.y = 0;
        s.grounded = true;
        s.groundCol = c;
        s.jumps = 0;
        if (c.type === "bounce") {
          s.vel.y = T.bounceVel;
          s.grounded = false;
          s.jumps = 1;
          ev.bounced = true;
          squashCharacter(mesh, 0.45);
        }
      } else if (s.vel.y > 0 && head > bottom && head < bottom + 0.5) {
        s.pos.y = bottom - HALF.y * 2;
        s.vel.y = 0;
      }
    }
    if (s.grounded && !wasGrounded) {
      ev.landed = fallSpeed;
      squashCharacter(mesh, Math.min(0.4, fallSpeed / 40));
    }

    s.pos.x += s.vel.x * dt;
    s.pos.z += s.vel.z * dt;
    for (const c of colliders) {
      const top = c.center.y + c.half.y;
      const bottom = c.center.y - c.half.y;
      if (s.pos.y >= top - 0.05 || s.pos.y + HALF.y * 2 <= bottom) continue;
      const ox = HALF.x + c.half.x - Math.abs(s.pos.x - c.center.x);
      const oz = HALF.z + c.half.z - Math.abs(s.pos.z - c.center.z);
      if (ox <= 0 || oz <= 0) continue;
      if (ox < oz) {
        s.pos.x += Math.sign(s.pos.x - c.center.x) * ox;
        s.vel.x = 0;
      } else {
        s.pos.z += Math.sign(s.pos.z - c.center.z) * oz;
        s.vel.z = 0;
      }
    }

    // Visual
    const hs = Math.hypot(s.vel.x, s.vel.z);
    if (hs > 0.5) s.facing = Math.atan2(s.vel.x, s.vel.z);
    let d = s.facing - mesh.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    mesh.rotation.y += d * Math.min(1, dt * 14);
    mesh.position.copy(s.pos);
    animateCharacter(mesh, dt, { speed: hs, grounded: s.grounded, vy: s.vel.y });
    return ev;
  }

  function knock(from, force) {
    const dir = s.pos.clone().sub(from).setY(0);
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);
    dir.normalize();
    s.vel.x = dir.x * force;
    s.vel.z = dir.z * force;
    s.vel.y = force * 0.7;
    s.grounded = false;
    s.stun = 0.35;
  }

  return { mesh, state: s, reset, step, knock, dispose: () => scene.remove(mesh) };
}
