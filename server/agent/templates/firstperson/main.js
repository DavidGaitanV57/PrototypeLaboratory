/**
 * Entry — first-person exploration / horror / stealth slice.
 * Flow: Title → click to begin (pointer lock) → find keycards while the stalker hunts → exit opens → reach it = ESCAPED; caught = LOST → R restart.
 */
import * as THREE from "/vendor/three/build/three.module.js";
import { createEngine } from "/runtime/Engine.js";
import { installSceneKit } from "/runtime/SceneKit.js";
import { installLook } from "/runtime/LookKit.js";
import { createInput } from "/runtime/Input.js";

import { META, TUNING } from "./config.js";
import { LOOK } from "./look.js";
import { createMaze } from "./maze.js";
import { createStalker } from "./stalker.js";
import { mountHud } from "./hud.js";
import { mountJuice } from "./juice.js";

let current = null;

export async function mount(canvas, { hudRoot } = {}) {
  if (current) await unmount();

  const engine = createEngine(canvas, { fov: 72, far: 200, near: 0.05 });
  const { scene, camera } = engine;
  const sceneKit = installSceneKit(scene, { ground: false, mode: "night" });
  const look = installLook(engine, LOOK.look);
  const input = createInput(window);
  const maze = createMaze(scene, { LOOK, TUNING, seed: 1337 });
  const stalker = createStalker(scene, { maze, LOOK, TUNING });
  const fb = mountJuice({ camera, canvas, scene, look, LOOK });
  const hud = mountHud(hudRoot, { LOOK, onPlayAgain: () => restart() });

  // Flashlight rig
  scene.add(camera);
  const flashlight = new THREE.SpotLight(0xfff3dc, 40, TUNING.flashlightRange, 0.5, 0.55, 1.6);
  flashlight.position.set(0.15, -0.12, 0);
  flashlight.castShadow = true;
  flashlight.shadow.mapSize.set(1024, 1024);
  flashlight.shadow.bias = -0.0005;
  flashlight.target.position.set(0, -0.2, -5);
  camera.add(flashlight, flashlight.target);

  const player = { pos: new THREE.Vector3(), yaw: 0, pitch: 0, stamina: TUNING.stamina, battery: TUNING.battery, light: true, bob: 0, exhausted: false };
  let state = "Title"; // Title → Playing → Escaped | Caught
  let got = 0;
  let t = 0;
  let resultDelay = -1;
  let stepAcc = 0;
  let autoRoute = [];
  let autoRepath = 0;

  function restart() {
    hud.hideResult();
    maze.reset();
    got = 0;
    player.pos.copy(maze.cellCenter(0, 0));
    player.yaw = Math.PI; // look into the maze (+x/+z quadrant is ahead)
    player.pitch = 0;
    player.stamina = TUNING.stamina;
    player.battery = TUNING.battery;
    player.light = true;
    stalker.reset([maze.exitCell.x, maze.exitCell.y]);
    fb.audio.setIntensity(0.1);
    resultDelay = -1;
    state = "Playing";
  }
  restart();
  state = "Title";
  hud.title(META.title, META.subtitle, 3200);
  hud.toast("Click to begin", 3000);

  const onClick = () => {
    canvas.requestPointerLock?.();
    if (state === "Title") state = "Playing";
  };
  canvas.addEventListener("click", onClick);
  if (window.__PLAB_AUTOPLAY) setTimeout(() => state === "Title" && (state = "Playing"), 1500);

  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const move = new THREE.Vector3();

  function autopilot(dt) {
    autoRepath -= dt;
    if (autoRepath <= 0 || !autoRoute.length) {
      autoRepath = 1;
      const from = maze.toCell(player.pos);
      const targets = maze.keys.filter((k) => !k.taken).map((k) => [k.cx, k.cy]);
      if (!targets.length) targets.push([maze.exitCell.x, maze.exitCell.y]);
      targets.sort((a, b) => Math.abs(a[0] - from[0]) + Math.abs(a[1] - from[1]) - (Math.abs(b[0] - from[0]) + Math.abs(b[1] - from[1])));
      autoRoute = maze.path(from, targets[0]);
    }
    while (autoRoute.length && autoRoute[0].distanceToSquared(player.pos.clone().setY(0)) < 0.5) autoRoute.shift();
    const tgt = autoRoute[0];
    if (!tgt) return { f: 0, s: 0 };
    const want = Math.atan2(-(tgt.x - player.pos.x), -(tgt.z - player.pos.z));
    let d = want - player.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    player.yaw += d * Math.min(1, dt * 5);
    return { f: Math.abs(d) < 0.8 ? 1 : 0.2, s: 0 };
  }

  const frame = (rawDt) => {
    const dt = fb.filterDelta(rawDt);
    t += dt;
    if (input.justPressed("r") && state !== "Title") restart();

    let threat = 0;
    if (state === "Playing") {
      // Look
      const md = input.mouseDelta();
      if (document.pointerLockElement === canvas) {
        player.yaw -= md.x * 0.0022;
        player.pitch = THREE.MathUtils.clamp(player.pitch - md.y * 0.0022, -1.35, 1.35);
      }
      // Move
      const ax = input.axis();
      let f = ax.y;
      let sx = ax.x;
      if (window.__PLAB_AUTOPLAY) ({ f, s: sx } = autopilot(dt));
      const wantsSprint = (input.key("Shift") || window.__PLAB_AUTOPLAY) && (f !== 0 || sx !== 0);
      const sprinting = wantsSprint && !player.exhausted && player.stamina > 0;
      player.stamina = THREE.MathUtils.clamp(player.stamina + (sprinting ? -dt : TUNING.staminaRegen * dt), 0, TUNING.stamina);
      if (player.stamina <= 0) player.exhausted = true;
      if (player.exhausted && player.stamina > TUNING.stamina * 0.35) player.exhausted = false;
      const speed = sprinting ? TUNING.sprintSpeed : TUNING.walkSpeed;
      fwd.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
      right.set(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
      move.set(0, 0, 0).addScaledVector(fwd, f).addScaledVector(right, sx);
      if (move.lengthSq() > 1) move.normalize();
      player.pos.addScaledVector(move, speed * dt);
      maze.collide(player.pos, TUNING.radius);
      const moving = move.lengthSq() > 0.01;
      if (moving) {
        player.bob += dt * (sprinting ? 13 : 8.5);
        stepAcc += speed * dt;
        if (stepAcc > (sprinting ? 2.2 : 1.7)) {
          stepAcc = 0;
          fb.step(sprinting);
        }
      }

      // Flashlight
      if (input.justPressed("f")) {
        player.light = !player.light;
        fb.flashlight();
      }
      if (player.light) player.battery = Math.max(0, player.battery - dt);
      const flick = player.battery < 15 ? (Math.sin(t * 40) > 0.6 ? 0.2 : 1) : 1;
      flashlight.intensity = player.light && player.battery > 0 ? 40 * flick : 0;

      // Keys + exit
      for (const k of maze.keys) {
        if (k.taken) continue;
        if (k.group.position.distanceToSquared(player.pos.clone().setY(1.1)) < 1.4) {
          k.taken = true;
          k.group.visible = false;
          got += 1;
          fb.key(k.group.position);
          if (got === maze.keys.length) {
            maze.setExitOpen(true);
            fb.exitOpen();
            hud.toast("The exit is unlocked", 2400);
          }
        }
      }
      if (got === maze.keys.length && player.pos.distanceTo(maze.exitPos) < 2.2) {
        state = "Escaped";
        fb.escaped();
        resultDelay = 1.6;
      }

      // Stalker
      const ev = stalker.update(dt, { playerPos: player.pos, lightOn: player.light && player.battery > 0, sprinting });
      if (ev.spotted) fb.spotted();
      if (ev.lost) fb.lost();
      if (ev.caught) {
        state = "Caught";
        camera.lookAt(stalker.group.position.clone().setY(2.2));
        fb.caught();
        resultDelay = 1.2;
      }
      const d = stalker.group.position.distanceTo(player.pos);
      threat = stalker.state.state === "Chase" ? 1 : Math.max(0, 1 - d / 14) * (stalker.state.state === "Dormant" ? 0.3 : 1);
    }

    // Camera (skip while showing the catch)
    if (state !== "Caught") {
      const bob = Math.sin(player.bob) * 0.045;
      camera.position.set(player.pos.x, TUNING.eyeHeight + bob, player.pos.z);
      camera.rotation.order = "YXZ";
      camera.rotation.set(player.pitch, player.yaw, Math.sin(player.bob * 0.5) * 0.006);
    }

    maze.update(dt, player.pos, t);

    if (resultDelay > 0) {
      resultDelay -= rawDt;
      if (resultDelay <= 0) {
        document.exitPointerLock?.();
        if (state === "Escaped") hud.showResult("YOU ESCAPED", [`Time ${t.toFixed(1)}s`, "Press R to play again"]);
        else hud.showResult("IT FOUND YOU", [`Keycards ${got}/${maze.keys.length}`, "Press R to try again"]);
      }
    }

    hud.update({
      got,
      total: maze.keys.length,
      stamina01: player.stamina / TUNING.stamina,
      battery01: player.battery / TUNING.battery,
      detect01: stalker.state.detect,
      stalkerState: stalker.state.state,
      exitOpen: got === maze.keys.length,
    });
    fb.update(rawDt, dt, { threat });
    input.endFrame();
  };

  engine.onUpdate(frame);
  engine.start();

  window.__plab = {
    get state() {
      return state;
    },
    get info() {
      return { keys: got, stalker: stalker.state.state, detect: +stalker.state.detect.toFixed(2), battery: Math.round(player.battery), cell: maze.toCell(player.pos), yaw: +player.yaw.toFixed(2), route: autoRoute.length, next: autoRoute[0] ? [autoRoute[0].x, autoRoute[0].z] : null, pos: [+player.pos.x.toFixed(1), +player.pos.z.toFixed(1)] };
    },
    restart,
  };

  current = {
    dispose() {
      canvas.removeEventListener("click", onClick);
      document.exitPointerLock?.();
      fb.dispose();
      hud.dispose();
      input.dispose();
      stalker.dispose();
      maze.dispose();
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
