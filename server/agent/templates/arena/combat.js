/**
 * Combat — hero (move, dash, aim, shoot), pooled bullets, enemy archetypes with separation + knockback, pickups.
 */
import * as THREE from "/vendor/three/build/three.module.js";
import { makeHero, animateCharacter } from "/runtime/Primitives.js";
import { stylized, glow } from "/runtime/MaterialKit.js";

export function createHero(scene, { LOOK, TUNING }) {
  const mesh = makeHero({ body: LOOK.palette.hero, accent: LOOK.palette.heroAccent, accessory: "antenna" });
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.7), stylized(0x1b1f3a, { metalness: 0.6, roughness: 0.3 }));
  gun.position.set(0.38, 0.95, 0.35);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), glow(LOOK.palette.bullet, 3));
  muzzle.position.set(0.38, 0.95, 0.72);
  mesh.add(gun, muzzle);
  scene.add(mesh);
  const s = {
    pos: mesh.position,
    vel: new THREE.Vector3(),
    aim: new THREE.Vector3(0, 0, -1),
    hp: TUNING.hp,
    invuln: 0,
    dashT: 0,
    dashCd: 0,
    fireCd: 0,
  };
  return {
    mesh,
    muzzle,
    state: s,
    reset() {
      mesh.position.set(0, 0, 0);
      s.vel.set(0, 0, 0);
      s.hp = TUNING.hp;
      s.invuln = 0;
      s.dashT = 0;
      s.dashCd = 0;
    },
    /** @returns {{ dashed?: boolean }} */
    step(dt, { move, dash }) {
      const ev = {};
      s.invuln = Math.max(0, s.invuln - dt);
      s.dashCd = Math.max(0, s.dashCd - dt);
      s.fireCd = Math.max(0, s.fireCd - dt);
      if (dash && s.dashCd <= 0 && move.lengthSq() > 0.01) {
        s.dashT = TUNING.dashTime;
        s.dashCd = TUNING.dashCooldown;
        s.invuln = Math.max(s.invuln, TUNING.dashTime + 0.05);
        s.vel.copy(move).setLength(TUNING.dashSpeed);
        ev.dashed = true;
      }
      if (s.dashT > 0) s.dashT -= dt;
      else {
        const target = move.clone().multiplyScalar(TUNING.moveSpeed);
        const diff = target.sub(s.vel);
        const maxStep = TUNING.accel * dt;
        if (diff.length() > maxStep) diff.setLength(maxStep);
        s.vel.add(diff);
      }
      mesh.position.addScaledVector(s.vel, dt);
      mesh.rotation.y = Math.atan2(s.aim.x, s.aim.z);
      animateCharacter(mesh, dt, { speed: s.vel.length(), grounded: true });
      mesh.visible = s.invuln > 0 && s.dashT <= 0 ? Math.floor(s.invuln * 20) % 2 === 0 : true;
      return ev;
    },
    dispose: () => scene.remove(mesh),
  };
}

export function createBullets(scene, { LOOK, TUNING, max = 120 }) {
  const geo = new THREE.CapsuleGeometry(0.09, 0.5, 4, 8);
  geo.rotateX(Math.PI / 2);
  const mat = glow(LOOK.palette.bullet, 3.2);
  const mesh = new THREE.InstancedMesh(geo, mat, max);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.userData.noShadow = true;
  scene.add(mesh);
  const list = [];
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const Z = new THREE.Vector3(0, 0, 1);
  return {
    list,
    fire(from, dir) {
      if (list.length >= max) list.shift();
      list.push({ pos: from.clone(), vel: dir.clone().setY(0).normalize().multiplyScalar(TUNING.bulletSpeed), life: TUNING.bulletLife });
    },
    update(dt, blocks) {
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const b = list[i];
        b.life -= dt;
        b.pos.addScaledVector(b.vel, dt);
        if (b.life <= 0 || blocks(b.pos)) {
          b.dead = true;
          list.splice(i, 1);
        }
      }
      mesh.count = list.length;
      list.forEach((b, i) => {
        q.setFromUnitVectors(Z, b.vel.clone().normalize());
        m4.compose(b.pos, q, one);
        mesh.setMatrixAt(i, m4);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
    clear() {
      list.length = 0;
      mesh.count = 0;
    },
    dispose() {
      scene.remove(mesh);
      geo.dispose();
      mat.dispose();
    },
  };
}

export function createEnemies(scene, { TUNING }) {
  const list = [];
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  const black = new THREE.MeshStandardMaterial({ color: 0x0b0b10, roughness: 0.3 });

  function makeBody(type) {
    const spec = TUNING.enemies[type];
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.35, emissive: spec.color, emissiveIntensity: 0.25, flatShading: type !== "grunt" });
    const r = spec.radius;
    const body =
      type === "brute"
        ? new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), bodyMat)
        : type === "dasher"
          ? new THREE.Mesh(new THREE.ConeGeometry(r, r * 2.2, 5), bodyMat)
          : new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), bodyMat);
    if (type === "dasher") body.rotation.x = Math.PI / 2;
    body.position.y = r + 0.1;
    g.add(body);
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(r * 0.22, 10, 8), white);
      e.position.set(sx * r * 0.35, r * 1.25, r * 0.78);
      const p = new THREE.Mesh(new THREE.SphereGeometry(r * 0.11, 8, 6), black);
      p.position.set(0, 0, r * 0.14);
      e.add(p);
      g.add(e);
    }
    g.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    return { g, body, bodyMat };
  }

  return {
    list,
    spawn(type, pos) {
      const spec = TUNING.enemies[type];
      const { g, body, bodyMat } = makeBody(type);
      g.position.copy(pos);
      g.scale.setScalar(0.01);
      scene.add(g);
      const e = { type, spec, g, body, bodyMat, hp: spec.hp, vel: new THREE.Vector3(), knock: new THREE.Vector3(), spawnT: 0.35, hitT: 0, t: Math.random() * 10 };
      list.push(e);
      return e;
    },
    update(dt, target, collide) {
      const tmp = new THREE.Vector3();
      for (const e of list) {
        e.t += dt;
        if (e.spawnT > 0) {
          e.spawnT -= dt;
          e.g.scale.setScalar(1 - Math.max(0, e.spawnT) / 0.35);
          continue;
        }
        tmp.subVectors(target, e.g.position).setY(0);
        const d = tmp.length();
        let speed = e.spec.speed;
        if (e.type === "dasher") speed *= 0.6 + Math.max(0, Math.sin(e.t * 3)) * 1.2;
        if (d > 0.01) e.vel.copy(tmp.divideScalar(d)).multiplyScalar(speed);
        // Separation
        for (const o of list) {
          if (o === e) continue;
          tmp.subVectors(e.g.position, o.g.position).setY(0);
          const dd = tmp.length();
          const min = e.spec.radius + o.spec.radius;
          if (dd < min && dd > 1e-4) e.g.position.addScaledVector(tmp.divideScalar(dd), (min - dd) * 0.5);
        }
        e.g.position.addScaledVector(e.vel, dt).addScaledVector(e.knock, dt);
        e.knock.multiplyScalar(Math.exp(-dt * 8));
        collide(e.g.position, e.spec.radius);
        e.g.rotation.y = Math.atan2(e.vel.x, e.vel.z);
        const hop = Math.abs(Math.sin(e.t * (e.type === "brute" ? 4 : 9))) * 0.18;
        e.body.position.y = e.spec.radius + 0.1 + hop;
        if (e.hitT > 0) {
          e.hitT -= dt;
          e.bodyMat.emissiveIntensity = 2.5;
        } else e.bodyMat.emissiveIntensity = 0.25;
      }
    },
    remove(e) {
      const i = list.indexOf(e);
      if (i >= 0) list.splice(i, 1);
      scene.remove(e.g);
      e.g.traverse((o) => o.geometry?.dispose?.());
      e.bodyMat.dispose();
    },
    clear() {
      for (const e of [...list]) this.remove(e);
    },
  };
}

export function createPickups(scene, { LOOK }) {
  const list = [];
  const geo = new THREE.OctahedronGeometry(0.35, 0);
  const mat = glow(LOOK.palette.heal, 2.2);
  return {
    list,
    drop(pos) {
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(pos).setY(0.8);
      scene.add(m);
      list.push({ m, t: 8 });
    },
    update(dt) {
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const p = list[i];
        p.t -= dt;
        p.m.rotation.y += dt * 3;
        p.m.visible = p.t > 2 || Math.floor(p.t * 8) % 2 === 0;
        if (p.t <= 0) {
          scene.remove(p.m);
          list.splice(i, 1);
        }
      }
    },
    take(i) {
      scene.remove(list[i].m);
      list.splice(i, 1);
    },
    clear() {
      for (const p of list) scene.remove(p.m);
      list.length = 0;
    },
  };
}
