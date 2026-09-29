/**
 * Entry — arena survival vertical slice (twin-stick).
 * Flow: Intro orbit → WAVE n title → portals spawn enemies → clear → next wave → all cleared = WIN; HP 0 = LOSE → R restart.
 */
import * as THREE from "/vendor/three/build/three.module.js";
import { createEngine } from "/runtime/Engine.js";
import { installSceneKit } from "/runtime/SceneKit.js";
import { installLook } from "/runtime/LookKit.js";
import { createInput } from "/runtime/Input.js";
import { createFollowCamera, createIntroOrbit } from "/runtime/CameraRig.js";

import { META, TUNING } from "./config.js";
import { LOOK } from "./look.js";
import { createArena } from "./arena.js";
import { createHero, createBullets, createEnemies, createPickups } from "./combat.js";
import { mountHud } from "./hud.js";
import { mountJuice } from "./juice.js";

let current = null;

export async function mount(canvas, { hudRoot } = {}) {
  if (current) await unmount();

  const engine = createEngine(canvas, { fov: 55, far: 400 });
  const { scene, camera } = engine;
  const sceneKit = installSceneKit(scene, { ground: false, mode: "night" });
  const look = installLook(engine, LOOK.look);
  const input = createInput(window);
  const arena = createArena(scene, { LOOK, TUNING });
  const hero = createHero(scene, { LOOK, TUNING });
  const bullets = createBullets(scene, { LOOK, TUNING });
  const enemies = createEnemies(scene, { TUNING });
  const pickups = createPickups(scene, { LOOK });
  const fb = mountJuice({ camera, canvas, scene, look, LOOK });
  const hud = mountHud(hudRoot, { LOOK, onPlayAgain: () => restart() });
  const dashTrail = fb.fx.trail(hero.mesh, { color: LOOK.palette.hero, width: 0.8, length: 14, offset: new THREE.Vector3(0, 0.9, 0) });
  dashTrail.setActive(false);
  look.follow(hero.mesh);

  const follow = createFollowCamera(camera, hero.mesh, { offset: [0, 13, 9.5], look: [0, 0.5, -1], damp: 5 });
  const intro = createIntroOrbit(camera, { center: new THREE.Vector3(), ...LOOK.intro, onDone: () => startWave(0) });
  let state = "Intro"; // Intro → WaveIntro → Fighting → (next) … → Won | Lost
  let waveIdx = 0;
  let queue = [];
  let spawnT = 0;
  let score = 0;
  let combo = 0;
  let comboT = 0;
  let waveIntroT = 0;
  let resultDelay = -1;
  let t = 0;
  hud.title(META.title, META.subtitle, 2600);

  function startWave(i) {
    waveIdx = i;
    const spec = TUNING.waves[i];
    queue = [];
    for (const [type, n] of Object.entries(spec)) for (let k = 0; k < n; k += 1) queue.push(type);
    queue.sort(() => Math.random() - 0.5);
    state = "WaveIntro";
    waveIntroT = 1.6;
    hud.title(i === TUNING.waves.length - 1 ? "FINAL WAVE" : `WAVE ${i + 1}`, `${queue.length} enemies`, 1500);
    fb.wave(i);
  }

  function restart() {
    hud.hideResult();
    enemies.clear();
    bullets.clear();
    pickups.clear();
    hero.reset();
    score = 0;
    combo = 0;
    resultDelay = -1;
    startWave(0);
  }

  const ray = new THREE.Raycaster();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const aimPt = new THREE.Vector3();
  const ndc = new THREE.Vector2();
  const tmp = new THREE.Vector3();

  function aimFromMouse() {
    const m = input.mousePos();
    const rect = canvas.getBoundingClientRect();
    ndc.set(((m.x - rect.left) / rect.width) * 2 - 1, -((m.y - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(ground, aimPt)) {
      tmp.subVectors(aimPt, hero.mesh.position).setY(0);
      if (tmp.lengthSq() > 0.25) hero.state.aim.copy(tmp.normalize());
    }
  }

  function autopilot() {
    let nearest = null;
    let best = Infinity;
    for (const e of enemies.list) {
      const d = e.g.position.distanceToSquared(hero.mesh.position);
      if (d < best) {
        best = d;
        nearest = e;
      }
    }
    const move = new THREE.Vector3();
    if (nearest) {
      tmp.subVectors(nearest.g.position, hero.mesh.position).setY(0).normalize();
      hero.state.aim.copy(tmp);
      // strafe around the nearest enemy, back off when close
      move.set(-tmp.z, 0, tmp.x);
      if (best < 36) move.addScaledVector(tmp, -1);
      if (hero.mesh.position.length() > TUNING.arenaRadius * 0.7) move.addScaledVector(hero.mesh.position.clone().normalize(), -1);
      move.normalize();
    }
    return { move, fire: !!nearest, dash: best < 6 };
  }

  const frame = (rawDt) => {
    const dt = fb.filterDelta(rawDt);
    t += dt;
    if (state === "Intro") {
      intro.update(rawDt);
      if (input.justPressed(" ") || input.justPressed("Enter")) intro.skip();
    }
    if (input.justPressed("r") && state !== "Intro") restart();
    arena.update(dt, t);

    const playing = state === "WaveIntro" || state === "Fighting";
    if (playing) {
      let ctl;
      if (window.__PLAB_AUTOPLAY) ctl = autopilot();
      else {
        const ax = input.axis();
        aimFromMouse();
        ctl = { move: new THREE.Vector3(ax.x, 0, -ax.y), fire: input.mouseButton(0) || input.key(" "), dash: input.justPressed("Shift") };
        if (ctl.move.lengthSq() > 1) ctl.move.normalize();
      }
      const ev = hero.step(dt, ctl);
      arena.collide(hero.mesh.position, 0.45);
      dashTrail.setActive(hero.state.dashT > 0);
      if (ev.dashed) fb.dash(hero.mesh.position);

      if (ctl.fire && hero.state.fireCd <= 0) {
        hero.state.fireCd = 1 / TUNING.fireRate;
        const from = hero.muzzle.getWorldPosition(new THREE.Vector3());
        const spread = (Math.random() - 0.5) * 0.06;
        bullets.fire(from, hero.state.aim.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), spread));
        fb.shoot(from);
      }

      // Spawning
      if (state === "WaveIntro") {
        waveIntroT -= dt;
        if (waveIntroT <= 0) state = "Fighting";
      } else if (queue.length) {
        spawnT -= dt;
        if (spawnT <= 0) {
          spawnT = TUNING.spawnInterval;
          const portal = arena.portals[(Math.random() * arena.portals.length) | 0];
          portal.flare = 1;
          const type = queue.pop();
          enemies.spawn(type, portal.pos.clone());
          fb.portal(portal.pos, TUNING.enemies[type].color);
        }
      }
    }

    bullets.update(dt, arena.blocksBullet);
    enemies.update(dt, hero.mesh.position, arena.collide);
    pickups.update(dt);

    if (playing) {
      // Bullets vs enemies
      for (const b of [...bullets.list]) {
        for (const e of enemies.list) {
          if (e.spawnT > 0) continue;
          if (b.pos.distanceToSquared(tmp.copy(e.g.position).setY(b.pos.y)) < (e.spec.radius + 0.2) ** 2) {
            e.hp -= 1;
            e.hitT = 0.08;
            e.knock.copy(b.vel).setY(0).setLength(e.type === "brute" ? 3 : 9);
            b.life = 0;
            bullets.list.splice(bullets.list.indexOf(b), 1);
            fb.hit(b.pos, e.spec.color);
            if (e.hp <= 0) {
              combo = comboT > 0 ? combo + 1 : 1;
              comboT = TUNING.comboWindow;
              const pts = e.spec.score * Math.min(combo, 10);
              score += pts;
              const p = e.g.position.clone().setY(1);
              fb.kill(p, e.spec.color, pts, combo);
              if (e.type === "brute") fb.bigKill(p, e.spec.color);
              if (Math.random() < TUNING.pickupChance) pickups.drop(p);
              enemies.remove(e);
            }
            break;
          }
        }
      }
      comboT -= dt;
      if (comboT <= 0) combo = 0;

      // Enemies vs hero
      for (const e of enemies.list) {
        if (e.spawnT > 0 || hero.state.invuln > 0) continue;
        if (e.g.position.distanceTo(hero.mesh.position) < e.spec.radius + 0.45) {
          hero.state.hp -= TUNING.contactDamage;
          hero.state.invuln = TUNING.invulnTime;
          hero.state.vel.subVectors(hero.mesh.position, e.g.position).setY(0).setLength(14);
          fb.hurt(hero.mesh.position.clone().setY(1));
          if (hero.state.hp <= 0) {
            state = "Lost";
            fb.lose();
            resultDelay = 1.2;
          }
          break;
        }
      }
      // Pickups
      for (let i = pickups.list.length - 1; i >= 0; i -= 1) {
        if (pickups.list[i].m.position.distanceTo(hero.mesh.position.clone().setY(0.8)) < 1.1) {
          hero.state.hp = Math.min(TUNING.hp, hero.state.hp + TUNING.heal);
          fb.heal(pickups.list[i].m.position);
          pickups.take(i);
        }
      }
      // Wave cleared
      if (state === "Fighting" && !queue.length && !enemies.list.length) {
        if (waveIdx >= TUNING.waves.length - 1) {
          state = "Won";
          fb.win(hero.mesh.position);
          resultDelay = 2;
        } else {
          fb.cleared();
          hud.toast("Wave cleared!", 1200);
          startWave(waveIdx + 1);
        }
      }
    }

    if (resultDelay > 0) {
      resultDelay -= rawDt;
      if (resultDelay <= 0) {
        if (state === "Won") hud.showResult("ARENA CLEARED", [`Score ${score}`, `Health left ${hero.state.hp}/${TUNING.hp}`, "Press R to play again"]);
        else hud.showResult("DEFEATED", [`Score ${score}`, `Reached wave ${waveIdx + 1}/${TUNING.waves.length}`, "Press R to try again"]);
      }
    }

    if (state !== "Intro") follow.update(rawDt);
    hud.update({
      hp01: hero.state.hp / TUNING.hp,
      hpNow: Math.max(0, hero.state.hp),
      hpMax: TUNING.hp,
      scoreNow: score,
      waveNow: waveIdx + 1,
      waves: TUNING.waves.length,
      enemiesLeft: queue.length + enemies.list.length,
      comboNow: combo,
      dash01: 1 - hero.state.dashCd / TUNING.dashCooldown,
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
      return { wave: waveIdx + 1, hp: hero.state.hp, score, enemies: enemies.list.length + queue.length };
    },
    restart,
  };

  current = {
    dispose() {
      dashTrail.dispose();
      fb.dispose();
      hud.dispose();
      input.dispose();
      enemies.clear();
      bullets.dispose();
      pickups.clear();
      hero.dispose();
      arena.dispose();
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
