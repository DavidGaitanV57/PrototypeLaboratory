/**
 * Entry — kart race vertical slice.
 * Flow: Intro orbit → 3-2-1-GO → Race (laps via PathKit progress) → Finish (slow-mo, confetti, result) → R restart.
 */
import * as THREE from "/vendor/three/build/three.module.js";
import { createEngine } from "/runtime/Engine.js";
import { installSceneKit } from "/runtime/SceneKit.js";
import { installLook } from "/runtime/LookKit.js";
import { createInput } from "/runtime/Input.js";
import { createChaseCamera, createIntroOrbit } from "/runtime/CameraRig.js";

import { META, TUNING } from "./config.js";
import { LOOK } from "./look.js";
import { createTrack } from "./track.js";
import { createKart, createDriver } from "./kart.js";
import { mountHud } from "./hud.js";
import { mountJuice } from "./juice.js";

let current = null;

export async function mount(canvas, { hudRoot } = {}) {
  if (current) await unmount();

  const engine = createEngine(canvas, { fov: 68, far: 900 });
  const { scene, camera } = engine;
  const sceneKit = installSceneKit(scene, { groundColor: LOOK.groundColor, groundSize: 520 });
  const look = installLook(engine, LOOK.look);
  const input = createInput(window);
  const track = createTrack(scene, { LOOK, TUNING });
  const fb = mountJuice({ camera, canvas, scene, look, LOOK });

  const player = createKart(scene, { color: LOOK.palette.player, TUNING, name: "Player" });
  const rivals = [];
  const drivers = [];
  for (let i = 0; i < TUNING.rivals; i += 1) {
    rivals.push(createKart(scene, { color: LOOK.palette.rivals[i % LOOK.palette.rivals.length], helmet: 0x222222, TUNING, name: `Rival ${i + 1}` }));
    drivers.push(createDriver(track.path, { skill: TUNING.aiSkill[i % TUNING.aiSkill.length], lane: (i - 1) * 2.5 }));
  }
  const karts = [player, ...rivals];
  const autoDriver = createDriver(track.path, { skill: 1.02, lane: 0 });
  look.follow(player.mesh);

  const hud = mountHud(hudRoot, { LOOK, onPlayAgain: () => restart() });
  hud.setTrack(track.path, track.bounds);

  const chase = createChaseCamera(camera, player.mesh, { distance: 8.5, height: 3.6, lookAhead: 5, fovBase: 66 });
  let intro = null;
  let state = "Intro"; // Intro → Countdown → Racing → Finished
  let raceTime = 0;
  let finishDelay = 0;
  let cancelCountdown = null;
  const archPos = track.path.pointAtT(0);

  function gridUp() {
    karts.forEach((k, i) => {
      const st = track.startTransform(karts.length - 1 - i);
      k.place(st.position, st.yaw, st.t);
      k.state._lap = 0;
    });
    raceTime = 0;
    for (const b of track.itemBoxes) {
      b.cooldown = 0;
      b.mesh.visible = true;
    }
  }

  function startCountdown() {
    state = "Countdown";
    chase.snap();
    cancelCountdown = hud.countdown(TUNING.countdown, {
      onTick: () => fb.countdownTick(),
      onGo: () => {
        state = "Racing";
        fb.go();
        hud.toast("Hold SPACE while turning to drift", 2200);
      },
    });
  }

  function restart() {
    cancelCountdown?.();
    hud.hideResult();
    fb.audio.setIntensity(0.5);
    gridUp();
    startCountdown();
  }

  gridUp();
  intro = createIntroOrbit(camera, { center: archPos, ...LOOK.intro, onDone: () => startCountdown() });
  hud.title(META.title, META.subtitle, 2600);

  const tmp = new THREE.Vector3();

  function standings() {
    return [...karts].sort((a, b) => {
      const A = a.state;
      const B = b.state;
      if (A.finished && B.finished) return A.finishTime - B.finishTime;
      if (A.finished) return -1;
      if (B.finished) return 1;
      return B.progress - A.progress;
    });
  }

  function useItem(k) {
    const s = k.state;
    if (!s.item) return;
    if (s.item === "turbo") {
      s.boostT = Math.max(s.boostT, TUNING.turboItemTime);
      if (k === player) fb.boost(k.mesh.position, 2);
    } else if (s.item === "shock") {
      for (const o of karts) if (o !== k && o.state.progress > s.progress) o.state.slowT = TUNING.shockSlowTime;
      if (k === player) fb.shock(k.mesh.position);
    }
    s.item = null;
  }

  function simulate(dt) {
    const order = standings();
    const leader = order[0].state.progress;
    for (let i = 0; i < karts.length; i += 1) {
      const k = karts[i];
      const s = k.state;
      const racingNow = state === "Racing";
      let ctl = { throttle: 0, steer: 0, drift: false };
      if (racingNow || (state === "Finished" && s.finished)) {
        if (k === player && !s.finished && !window.__PLAB_AUTOPLAY) {
          const ax = input.axis();
          ctl = { throttle: ax.y, steer: ax.x, drift: input.key(" ") };
          if (input.justPressed("e")) useItem(k);
        } else {
          const drv = k === player ? autoDriver : drivers[i - 1];
          const behind = leader - s.progress;
          const rubber = k === player ? 0 : THREE.MathUtils.clamp(player.state.progress - s.progress, -1, 1) * TUNING.rubberBand + (behind > 0.3 ? 0.04 : 0);
          ctl = drv.control(s, dt, { rubber });
          if (s.item && Math.random() < dt * 0.6) useItem(k);
        }
      }
      const near = track.path.nearestT(k.mesh.position);
      const offroad = near.distance > track.width / 2 + 0.8;
      const ev = k.step(dt, ctl, { offroad });
      if (k === player) {
        if (ev.driftRelease) fb.boost(k.mesh.position, ev.driftRelease);
        if (s.drift) fb.drifting(k.mesh, player.driftTier, dt);
        if (offroad && Math.abs(s.speed) > 5) fb.offroad(k.mesh.position);
      }

      // Soft barrier
      if (near.distance > track.width / 2 + 12) {
        tmp.copy(track.path.pointAtT(near.t));
        k.mesh.position.lerp(tmp, Math.min(1, dt * 3));
        s.speed *= 0.97;
      }

      // Progress + laps
      const nt = track.path.nearestT(k.mesh.position).t;
      s.progress += track.path.progressDelta(s.lastT, nt);
      s.lastT = nt;
      const lapNow = Math.floor(s.progress);
      if (!s._lap) s._lap = 0;
      if (lapNow > s._lap && racingNow) {
        s._lap = lapNow;
        s.lapTimes.push(raceTime - s.lapStart);
        s.lapStart = raceTime;
        if (k === player && lapNow < TUNING.laps) fb.lap(lapNow + 1, TUNING.laps, tmp.copy(k.mesh.position).setY(2.5));
      }
      if (!s.finished && s.progress >= TUNING.laps && (racingNow || state === "Finished")) {
        s.finished = true;
        s.finishTime = raceTime;
        if (k === player) finishRace();
      }

      // Item boxes + boost pads
      for (const b of track.itemBoxes) {
        if (b.cooldown > 0) continue;
        if (b.mesh.position.distanceToSquared(k.mesh.position) < 6) {
          b.cooldown = TUNING.itemBoxRespawn;
          b.mesh.visible = false;
          if (!s.item) s.item = Math.random() < 0.65 ? "turbo" : "shock";
          if (k === player) fb.itemBox(b.mesh.position);
        }
      }
      for (const pad of track.boostPads) {
        if (pad.pos.distanceToSquared(k.mesh.position) < pad.radius * pad.radius && s.boostT < 0.5) {
          s.boostT = 0.9;
          if (k === player) fb.boost(k.mesh.position, 1);
        }
      }
    }

    // Kart vs kart bumps
    for (let i = 0; i < karts.length; i += 1) {
      for (let j = i + 1; j < karts.length; j += 1) {
        const a = karts[i];
        const b = karts[j];
        tmp.subVectors(a.mesh.position, b.mesh.position).setY(0);
        const d = tmp.length();
        if (d > 0.001 && d < 2.3) {
          tmp.divideScalar(d);
          const push = (2.3 - d) * 0.5;
          a.mesh.position.addScaledVector(tmp, push);
          b.mesh.position.addScaledVector(tmp, -push);
          a.state.bumpV.addScaledVector(tmp, 4);
          b.state.bumpV.addScaledVector(tmp, -4);
          if (a === player || b === player) fb.bump(tmp.copy(a.mesh.position).lerp(b.mesh.position, 0.5).setY(0.8));
        }
      }
    }
  }

  function finishRace() {
    state = "Finished";
    const place = standings().indexOf(player) + 1;
    fb.finish(place === 1, archPos);
    finishDelay = 1.6;
  }

  function showResultNow() {
    const place = standings().indexOf(player) + 1;
    const best = Math.min(...player.state.lapTimes.slice(0, TUNING.laps));
    const title = place === 1 ? "1ST PLACE!" : place <= 3 ? `${["", "", "2ND", "3RD"][place]} PLACE` : `${place}TH PLACE`;
    hud.showResult(title, [`Time ${hud.fmt(player.state.finishTime)}`, `Best lap ${Number.isFinite(best) ? hud.fmt(best) : "—"}`, "Press R to race again"]);
  }

  const frame = (rawDt) => {
    const dt = fb.filterDelta(rawDt);
    if (input.justPressed("r") && state !== "Intro") restart();
    if (state === "Intro" && (input.justPressed(" ") || input.justPressed("Enter"))) intro.skip();

    if (state === "Racing" || state === "Finished") {
      raceTime += state === "Racing" ? dt : 0;
      simulate(dt);
    } else if (state === "Countdown") {
      for (const k of karts) k.step(dt, { throttle: 0, steer: 0, drift: false });
      fb.engine(input.key("w") ? 0.8 : 0.15);
    }
    track.update(dt);

    if (state === "Intro") intro.update(rawDt);
    else chase.update(rawDt, { speed: player.state.speed });

    if (state === "Racing") fb.engine(Math.abs(player.state.speed) / TUNING.boostSpeed);
    if (state === "Finished" && finishDelay > 0) {
      finishDelay -= rawDt;
      if (finishDelay <= 0) showResultNow();
    }

    const order = standings();
    const s = player.state;
    hud.update({
      position: order.indexOf(player) + 1,
      total: karts.length,
      lapNow: Math.max(1, Math.floor(s.progress) + 1),
      laps: TUNING.laps,
      t: state === "Finished" ? s.finishTime : raceTime,
      kmh: Math.abs(s.speed) * 3.6,
      boost01: s.boostT > 0 ? 1 : Math.min(1, s.driftT / TUNING.miniTurbo[1]),
      itemIcon: s.item === "turbo" ? "🔥 TURBO" : s.item === "shock" ? "⚡ SHOCK" : "",
      markers: karts.map((k) => ({ x: k.mesh.position.x, z: k.mesh.position.z, color: k === player ? "#ff4d3d" : "#ffffff", r: k === player ? 5 : 3.5 })),
    });
    fb.fx.speed(s.boostT > 0 ? 1 : Math.max(0, (s.speed - 24) / 20));
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
      return { lap: Math.floor(player.state.progress) + 1, laps: TUNING.laps, speed: player.state.speed, position: standings().indexOf(player) + 1 };
    },
    restart,
  };

  current = {
    dispose() {
      cancelCountdown?.();
      fb.dispose();
      hud.dispose();
      input.dispose();
      track.dispose();
      for (const k of karts) k.dispose();
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
