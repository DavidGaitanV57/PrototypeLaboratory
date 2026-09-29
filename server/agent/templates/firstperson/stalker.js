/**
 * Stalker — patrols the maze, notices you with a vision cone + line of sight (and sprint noise), then hunts via BFS.
 * States: Dormant → Patrol → Alert → Chase → Search → Patrol.
 */
import * as THREE from "/vendor/three/build/three.module.js";
import { stylized, glow } from "/runtime/MaterialKit.js";

export function createStalker(scene, { maze, LOOK, TUNING }) {
  const T = TUNING;
  const g = new THREE.Group();
  g.name = "Stalker";
  const skin = stylized(LOOK.palette.stalker, { roughness: 1 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.5, 6, 12), skin);
  body.position.y = 1.2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), skin);
  head.position.y = 2.3;
  head.scale.y = 1.25;
  const eyeMat = glow(LOOK.palette.stalkerEyes, 5);
  const eyes = [];
  for (const sx of [-0.08, 0.08]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), eyeMat);
    e.position.set(sx, 2.33, 0.21);
    g.add(e);
    eyes.push(e);
  }
  const arms = [];
  for (const sx of [-0.36, 0.36]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx, 1.95, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 1.3, 4, 8), skin);
    arm.position.y = -0.7;
    pivot.add(arm);
    g.add(pivot);
    arms.push(pivot);
  }
  g.add(body, head);
  scene.add(g);

  const s = {
    state: "Dormant",
    detect: 0,
    route: [],
    repathT: 0,
    lostT: 0,
    lastSeen: new THREE.Vector3(),
    grace: T.graceTime,
    yaw: 0,
    t: 0,
  };
  const fwd = new THREE.Vector3();
  const toP = new THREE.Vector3();
  const eye = new THREE.Vector3();

  function reset(cell) {
    const p = maze.cellCenter(cell[0], cell[1]);
    g.position.copy(p);
    s.state = "Dormant";
    s.detect = 0;
    s.route = [];
    s.grace = T.graceTime;
  }

  function newPatrolRoute() {
    const from = maze.toCell(g.position);
    s.route = maze.path(from, maze.randomCell());
  }

  function follow(dt, speed) {
    while (s.route.length && s.route[0].distanceToSquared(g.position) < 0.15) s.route.shift();
    const tgt = s.route[0];
    if (!tgt) return false;
    toP.subVectors(tgt, g.position).setY(0);
    const d = toP.length();
    const want = Math.atan2(toP.x, toP.z);
    let diff = want - s.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    s.yaw += diff * Math.min(1, dt * 6);
    g.position.addScaledVector(toP.normalize(), Math.min(d, speed * dt));
    return true;
  }

  /**
   * @returns {{ spotted?: boolean, lost?: boolean, caught?: boolean }}
   */
  function update(dt, { playerPos, lightOn, sprinting }) {
    const ev = {};
    s.t += dt;
    if (s.state === "Dormant") {
      s.grace -= dt;
      if (s.grace <= 0) {
        s.state = "Patrol";
        newPatrolRoute();
      }
    }

    // Senses
    eye.copy(g.position).setY(2.2);
    toP.subVectors(playerPos, g.position).setY(0);
    const dist = toP.length();
    fwd.set(Math.sin(s.yaw), 0, Math.cos(s.yaw));
    const angle = THREE.MathUtils.radToDeg(fwd.angleTo(toP.normalize()));
    const range = lightOn ? T.sightRangeLit : T.sightRange;
    const sees = s.state !== "Dormant" && dist < range && angle < T.sightHalfAngle && maze.lineOfSight(eye, playerPos.clone().setY(1.5));
    const hears = s.state !== "Dormant" && sprinting && dist < 9;

    if (sees) {
      s.detect = Math.min(1, s.detect + T.detectRate * dt * (1.4 - dist / range));
      s.lastSeen.copy(playerPos);
      s.lostT = 0;
    } else if (hears) {
      s.detect = Math.min(1, s.detect + 0.5 * dt);
      s.lastSeen.copy(playerPos);
    } else if (s.state !== "Chase") {
      s.detect = Math.max(0, s.detect - T.forgetRate * dt);
    }

    if ((s.state === "Patrol" || s.state === "Search") && s.detect > 0.35) s.state = "Alert";
    if (s.state === "Alert") {
      // freeze and stare while suspicion builds
      const want = Math.atan2(s.lastSeen.x - g.position.x, s.lastSeen.z - g.position.z);
      s.yaw += (want - s.yaw) * Math.min(1, dt * 3);
      if (s.detect >= 1) {
        s.state = "Chase";
        ev.spotted = true;
      } else if (s.detect < 0.1) {
        s.state = "Patrol";
        newPatrolRoute();
      }
    }

    if (s.state === "Chase") {
      s.repathT -= dt;
      if (!sees) s.lostT += dt;
      if (s.repathT <= 0) {
        s.repathT = 0.4;
        s.route = maze.path(maze.toCell(g.position), maze.toCell(sees ? playerPos : s.lastSeen));
        if (sees || s.route.length <= 1) s.route.push(playerPos.clone().setY(0));
      }
      follow(dt, T.chaseSpeed);
      if (s.lostT > T.loseTrackTime) {
        s.state = "Search";
        s.detect = 0.3;
        s.route = maze.path(maze.toCell(g.position), maze.toCell(s.lastSeen));
        ev.lost = true;
      }
    } else if (s.state === "Patrol" || s.state === "Search") {
      if (!follow(dt, T.patrolSpeed)) {
        if (s.state === "Search") s.state = "Patrol";
        newPatrolRoute();
      }
    }

    // Keep out of walls
    maze.collide(g.position, 0.35);

    // Pose: shamble, arms sway, twitchy head
    const moving = s.state === "Patrol" || s.state === "Chase" || s.state === "Search";
    const k = s.state === "Chase" ? 2.4 : 1;
    g.rotation.y = s.yaw;
    g.position.y = moving ? Math.abs(Math.sin(s.t * 4 * k)) * 0.06 : 0;
    arms[0].rotation.x = moving ? Math.sin(s.t * 4 * k) * 0.5 * k : -0.1;
    arms[1].rotation.x = moving ? -Math.sin(s.t * 4 * k) * 0.5 * k : -0.1;
    if (s.state === "Chase") {
      arms[0].rotation.x = arms[1].rotation.x = -1.2 + Math.sin(s.t * 18) * 0.1;
    }
    head.rotation.z = Math.sin(s.t * 1.7) * 0.15 + (Math.random() < 0.02 ? (Math.random() - 0.5) * 0.6 : 0);
    eyeMat.color.setHex(LOOK.palette.stalkerEyes).multiplyScalar(s.state === "Chase" ? 8 : 3 + s.detect * 5);

    if (s.state !== "Dormant" && dist < T.catchDistance) ev.caught = true;
    return ev;
  }

  return {
    group: g,
    state: s,
    reset,
    update,
    dispose: () => scene.remove(g),
  };
}
