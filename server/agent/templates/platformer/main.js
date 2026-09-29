/**
 * Entry — 3D platformer vertical slice.
 * Flow: Intro orbit → Play (collect stars, climb) → beacon opens at target → reach it = WIN; lives/timer = LOSE → R restart.
 */
import * as THREE from "/vendor/three/build/three.module.js";
import { createEngine } from "/runtime/Engine.js";
import { installSceneKit } from "/runtime/SceneKit.js";
import { installLook } from "/runtime/LookKit.js";
import { createInput } from "/runtime/Input.js";
import { createFollowCamera, createIntroOrbit } from "/runtime/CameraRig.js";

import { META, TUNING } from "./config.js";
import { LOOK } from "./look.js";
import { createLevel } from "./level.js";
import { createPlayer } from "./player.js";
import { mountHud } from "./hud.js";
import { mountJuice } from "./juice.js";

let current = null;

export async function mount(canvas, { hudRoot } = {}) {
  if (current) await unmount();

  const engine = createEngine(canvas, { fov: 60, far: 700 });
  const { scene, camera } = engine;
  const sceneKit = installSceneKit(scene, { ground: false });
  const look = installLook(engine, LOOK.look);
  const input = createInput(window);
  const level = createLevel(scene, { LOOK });
  const player = createPlayer(scene, { LOOK, TUNING });
  const fb = mountJuice({ camera, canvas, scene, look, LOOK });
  const hud = mountHud(hudRoot, { LOOK, TUNING, onPlayAgain: () => restart() });
  look.follow(player.mesh);

  const follow = createFollowCamera(camera, player.mesh, { offset: [0, 5.5, 10.5], look: [0, 1.4, -3], damp: 6 });
  let intro = createIntroOrbit(camera, { center: new THREE.Vector3(0, 2, -6), ...LOOK.intro, onDone: () => (state = "Playing") });
  let state = "Intro"; // Intro → Playing → Won | Lost
  let lives = TUNING.lives;
  let timeLeft = TUNING.timeLimit;
  let got = 0;
  let t = 0;
  let checkpoint = level.spawn.clone();
  let resultDelay = -1;
  let hitCooldown = 0;
  let beaconToastT = 0;
  const topY = level.goal.pos.y;

  function restart() {
    hud.hideResult();
    level.reset();
    lives = TUNING.lives;
    timeLeft = TUNING.timeLimit;
    got = 0;
    checkpoint = level.spawn.clone();
    player.reset(checkpoint);
    fb.audio.setIntensity(0.5);
    state = "Playing";
    resultDelay = -1;
  }
  player.reset(level.spawn);
  hud.title(META.title, META.subtitle, 2600);

  // Autoplay (visual QA): chase the next route point and jump across gaps.
  let autoIdx = 1;
  function autopilot() {
    const s = player.state;
    const route = level.route;
    while (autoIdx < route.length - 1 && s.pos.z < route[autoIdx].z + 1 && s.pos.y > route[autoIdx].y - 0.5) autoIdx += 1;
    const tgt = route[autoIdx];
    const dx = tgt.x - s.pos.x;
    const dz = tgt.z - s.pos.z;
    const d = Math.hypot(dx, dz);
    const x = dx / Math.max(1, d);
    const z = dz / Math.max(1, d);
    const onEdge = s.grounded && (d > 3 || tgt.y > s.pos.y + 0.5);
    return { x, z, jumpPressed: onEdge || (!s.grounded && s.vel.y < 0 && s.jumps === 1 && tgt.y >= s.pos.y - 0.5), jumpHeld: true };
  }

  const tmp = new THREE.Vector3();
  const frame = (rawDt) => {
    const dt = fb.filterDelta(rawDt);
    t += dt;
    if (state === "Intro") {
      intro.update(rawDt);
      if (input.justPressed(" ") || input.justPressed("Enter")) intro.skip();
    }
    if (input.justPressed("r") && state !== "Intro") restart();

    level.update(dt, t);

    if (state === "Playing") {
      timeLeft -= dt;
      const ax = input.axis();
      const ctl = window.__PLAB_AUTOPLAY
        ? autopilot()
        : { x: ax.x, z: -ax.y, jumpPressed: input.justPressed(" "), jumpHeld: input.key(" ") };
      const ev = player.step(dt, ctl, level.colliders);
      const p = player.state.pos;
      if (ev.jumped || ev.doubleJumped) fb.jump(tmp.copy(p), ev.doubleJumped);
      if (ev.landed) fb.land(tmp.copy(p), ev.landed);
      if (ev.bounced) fb.bounce(tmp.copy(p));
      if (player.state.grounded && player.state.groundCol?.type === "island") {
        checkpoint.copy(player.state.groundCol.group.position).setY(player.state.groundCol.group.position.y + 0.1);
      }

      // Stars
      for (const s of level.stars) {
        if (s.taken) continue;
        if (s.mesh.position.distanceToSquared(tmp.copy(p).setY(p.y + 0.9)) < 1.3) {
          s.taken = true;
          s.mesh.visible = false;
          got += 1;
          fb.star(s.mesh.position, LOOK.palette.star);
          if (got === TUNING.starsToOpen) {
            level.goal.open = true;
            fb.beaconOpen(level.goal.pos);
            hud.toast("The beacon is open! Climb to the top", 2400);
          }
        }
      }

      // Spinner hazards
      hitCooldown -= dt;
      for (const sp of level.spinners) {
        const top = sp.g.position.y;
        if (p.y > top + 1.3 || p.y < top - 0.2 || hitCooldown > 0) continue;
        const ang = sp.pivot.rotation.y;
        const dir = tmp.set(Math.cos(ang), 0, -Math.sin(ang));
        const rel = new THREE.Vector3(p.x - sp.g.position.x, 0, p.z - sp.g.position.z);
        const along = THREE.MathUtils.clamp(rel.dot(dir), -sp.length, sp.length);
        const closest = dir.clone().multiplyScalar(along);
        if (rel.distanceTo(closest) < 0.6) {
          hitCooldown = 0.8;
          player.knock(sp.g.position.clone().add(closest), TUNING.knockback);
          fb.hit(tmp.copy(p).setY(p.y + 1));
        }
      }

      // Goal
      const g = level.goal.pos;
      if (Math.hypot(p.x - g.x, p.z - g.z) < 2.2 && p.y > g.y - 1.5) {
        if (level.goal.open) {
          state = "Won";
          fb.win(tmp.copy(g).setY(g.y + 4));
          resultDelay = 1.8;
        } else if (beaconToastT <= 0) {
          beaconToastT = 3;
          hud.toast(`The beacon needs ${TUNING.starsToOpen - got} more stars`, 2000);
        }
      }
      beaconToastT -= dt;

      // Falls + timer
      if (p.y < TUNING.killY) {
        lives -= 1;
        fb.fall();
        if (lives <= 0) {
          state = "Lost";
          fb.lose();
          resultDelay = 0.8;
        } else {
          player.reset(checkpoint);
          hud.toast(`${lives} ${lives === 1 ? "life" : "lives"} left`, 1400);
        }
      }
      if (timeLeft <= 0) {
        timeLeft = 0;
        state = "Lost";
        fb.lose();
        resultDelay = 0.8;
      }
    } else if (state === "Won") {
      player.step(dt, { x: 0, z: 0, jumpPressed: false, jumpHeld: false }, level.colliders);
    }

    if (resultDelay > 0) {
      resultDelay -= rawDt;
      if (resultDelay <= 0) {
        const used = TUNING.timeLimit - timeLeft;
        if (state === "Won") hud.showResult("BEACON LIT!", [`Stars ${got}/${level.stars.length}`, `Time ${used.toFixed(1)}s`, "Press R to play again"]);
        else hud.showResult(timeLeft <= 0 ? "TIME UP" : "OUT OF LIVES", [`Stars ${got}/${level.stars.length}`, "Press R to try again"]);
      }
    }

    if (state !== "Intro") follow.update(rawDt);
    hud.update({
      got,
      need: TUNING.starsToOpen,
      total: level.stars.length,
      livesLeft: lives,
      t: Math.max(0, timeLeft),
      altitude01: THREE.MathUtils.clamp(player.state.pos.y / topY, 0, 1),
    });
    fb.update(rawDt, dt);
    input.endFrame();
  };

  engine.onUpdate(frame);
  engine.start();

  window.__plab = {
    get state() {
      return state;
    },
    get info() {
      return { stars: got, lives, time: Math.round(timeLeft), y: +player.state.pos.y.toFixed(1) };
    },
    restart,
  };

  current = {
    dispose() {
      fb.dispose();
      hud.dispose();
      input.dispose();
      level.dispose();
      player.dispose();
      look.dispose();
      sceneKit.dispose();
      engine.dispose();
      delete window.__plab;
    },
  };
  return { sceneKit };
}

export async function unmount() {
  current?.dispose();
  current = null;
}
