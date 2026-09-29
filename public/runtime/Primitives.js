/**
 * Primitive composition helpers — readable silhouettes without assets: rounded boxes, animated heroes with eyes, vehicles, pickups, coins, crates, flags, arches.
 */
import * as THREE from "/vendor/three/build/three.module.js";

/** Satin standard material (lit by LookKit environment). Same signature as before. */
export function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.7,
    metalness: opts.metalness ?? 0,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: !!opts.transparent,
    opacity: opts.opacity ?? 1,
    flatShading: !!opts.flat,
  });
}

function toMaterial(colorOrMat, opts) {
  return colorOrMat?.isMaterial ? colorOrMat : mat(colorOrMat, opts);
}

/** Box geometry with rounded edges (smooth normals). */
export function roundedBoxGeometry(w = 1, h = 1, d = 1, radius = 0.08, segments = 3) {
  const r = Math.max(0.0001, Math.min(radius, w / 2, h / 2, d / 2));
  const n = segments + 1;
  const g = new THREE.BoxGeometry(1, 1, 1, n * 2, n * 2, n * 2);
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const half = [w / 2, h / 2, d / 2];
  const v = new THREE.Vector3();
  const inner = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const remap = (u, hw) => {
    // u in [-0.5, 0.5] on a (2n)-step grid → inner steps span the flat part, last n steps span the round
    const t = Math.abs(u) / 0.5;
    const k = Math.round(t * n);
    const a = hw - r;
    const val = k === 0 ? 0 : k === 1 ? a : a + ((k - 1) / (n - 1 || 1)) * r;
    return Math.sign(u) * Math.min(val, hw);
  };
  for (let i = 0; i < pos.count; i += 1) {
    v.set(remap(pos.getX(i), half[0]), remap(pos.getY(i), half[1]), remap(pos.getZ(i), half[2]));
    inner.set(
      THREE.MathUtils.clamp(v.x, -half[0] + r, half[0] - r),
      THREE.MathUtils.clamp(v.y, -half[1] + r, half[1] - r),
      THREE.MathUtils.clamp(v.z, -half[2] + r, half[2] - r),
    );
    dir.subVectors(v, inner);
    if (dir.lengthSq() < 1e-10) dir.set(nor.getX(i), nor.getY(i), nor.getZ(i));
    dir.normalize();
    v.copy(inner).addScaledVector(dir, r);
    pos.setXYZ(i, v.x, v.y, v.z);
    nor.setXYZ(i, dir.x, dir.y, dir.z);
  }
  pos.needsUpdate = true;
  nor.needsUpdate = true;
  g.computeBoundingSphere();
  return g;
}

export function box(w, h, d, color, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toMaterial(color, opts));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Soft-edged box — reads as a designed object instead of a debug block. */
export function roundedBox(w, h, d, color, opts = {}) {
  const m = new THREE.Mesh(roundedBoxGeometry(w, h, d, opts.radius ?? Math.min(w, h, d) * 0.15), toMaterial(color, opts));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function sphere(r, color, opts) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), toMaterial(color, opts));
}

export function cylinder(rTop, rBot, h, color, opts) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, 20), toMaterial(color, opts));
}

export function capsule(r, len, color, opts) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 16), toMaterial(color, opts)));
  return g;
}

/** Character silhouette: capsule body + head (legacy). Prefer makeHero for players. */
export function makeCharacter(color = 0xf2f2f2, accent = 0x3d9b8f) {
  const root = new THREE.Group();
  root.name = "Character";
  const body = capsule(0.35, 0.7, color);
  body.position.y = 0.9;
  const head = sphere(0.28, accent);
  head.position.y = 1.55;
  root.add(body, head);
  return root;
}

/**
 * Chunky hero with eyes, limbs on pivots and an optional accessory. Animate with animateCharacter().
 * @param {{ body?: number, accent?: number, skin?: number, eyes?: boolean, accessory?: "cap"|"antenna"|"horns"|"none", scale?: number }} opts
 */
export function makeHero(opts = {}) {
  const { body = 0xff5a36, accent = 0x2b2d42, skin = 0xffd9b8, eyes = true, accessory = "cap", scale = 1 } = opts;
  const root = new THREE.Group();
  root.name = "Hero";
  const rig = new THREE.Group();
  root.add(rig);
  const mBody = mat(body, { roughness: 0.55 });
  const mAccent = mat(accent, { roughness: 0.6 });
  const mSkin = mat(skin, { roughness: 0.65 });

  const hips = new THREE.Group();
  hips.position.y = 0.55;
  rig.add(hips);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.35, 6, 16), mBody);
  torso.position.y = 0.32;
  hips.add(torso);

  const head = new THREE.Group();
  head.position.y = 0.95;
  hips.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 16), mSkin);
  head.add(skull);

  const eyeParts = [];
  if (eyes) {
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const pupil = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 });
    for (const sx of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(0.12 * sx, 0.05, 0.28);
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), white);
      w.scale.z = 0.6;
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), pupil);
      p.position.z = 0.045;
      eye.add(w, p);
      head.add(eye);
      eyeParts.push(eye);
    }
  }

  if (accessory === "cap") {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.36, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mAccent);
    cap.position.y = 0.06;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 20, 1, false, -Math.PI / 2, Math.PI), mAccent);
    brim.position.set(0, 0.07, 0.3);
    brim.scale.z = 0.8;
    head.add(cap, brim);
  } else if (accessory === "antenna") {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6), mAccent);
    stick.position.y = 0.45;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(body).multiplyScalar(2.5) }));
    tip.position.y = 0.62;
    head.add(stick, tip);
  } else if (accessory === "horns") {
    for (const sx of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.25, 10), mAccent);
      horn.position.set(0.2 * sx, 0.3, 0);
      horn.rotation.z = -0.4 * sx;
      head.add(horn);
    }
  }

  const limb = (r, len, material) => {
    const pivot = new THREE.Group();
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), material);
    m.position.y = -(len / 2 + r * 0.6);
    pivot.add(m);
    return pivot;
  };
  const armL = limb(0.09, 0.3, mBody);
  const armR = limb(0.09, 0.3, mBody);
  armL.position.set(-0.38, 0.52, 0);
  armR.position.set(0.38, 0.52, 0);
  armL.rotation.z = -0.15;
  armR.rotation.z = 0.15;
  hips.add(armL, armR);
  const legL = limb(0.11, 0.25, mAccent);
  const legR = limb(0.11, 0.25, mAccent);
  legL.position.set(-0.15, 0, 0);
  legR.position.set(0.15, 0, 0);
  hips.add(legL, legR);

  root.scale.setScalar(scale);
  root.userData.parts = { rig, hips, torso, head, armL, armR, legL, legR, eyes: eyeParts };
  root.userData.anim = { phase: 0, squash: 0, blinkT: 2 + Math.random() * 3, breathe: 0 };
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return root;
}

/**
 * Procedural walk / run / jump / idle for makeHero rigs. Call every frame.
 * @param {THREE.Object3D} hero
 * @param {number} dt
 * @param {{ speed?: number, grounded?: boolean, vy?: number }} state speed in m/s
 */
export function animateCharacter(hero, dt, { speed = 0, grounded = true, vy = 0 } = {}) {
  const parts = hero?.userData?.parts;
  const a = hero?.userData?.anim;
  if (!parts || !a) return;
  const run = Math.min(1, speed / 6);
  a.phase += dt * (4 + speed * 1.6);
  a.breathe += dt * 2.2;
  const s = Math.sin(a.phase);

  if (grounded) {
    const swing = 0.9 * run;
    parts.legL.rotation.x = s * swing;
    parts.legR.rotation.x = -s * swing;
    parts.armL.rotation.x = -s * swing * 0.8;
    parts.armR.rotation.x = s * swing * 0.8;
    parts.hips.position.y = 0.55 + Math.abs(Math.cos(a.phase)) * 0.06 * run + Math.sin(a.breathe) * 0.01 * (1 - run);
    parts.rig.rotation.x = 0.18 * run;
  } else {
    const up = THREE.MathUtils.clamp(vy / 8, -1, 1);
    parts.legL.rotation.x = 0.6;
    parts.legR.rotation.x = -0.2;
    parts.armL.rotation.x = -2.4 * Math.max(0, up) - 0.4;
    parts.armR.rotation.x = -2.4 * Math.max(0, up) - 0.4;
    parts.rig.rotation.x = -0.1 * up;
  }
  parts.armL.rotation.z = -0.15 - (grounded ? 0 : 0.5);
  parts.armR.rotation.z = 0.15 + (grounded ? 0 : 0.5);

  // Squash & stretch
  a.squash *= Math.exp(-dt * 10);
  const sq = a.squash;
  parts.rig.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);

  // Blink
  a.blinkT -= dt;
  const blink = a.blinkT < 0.12 ? 0.1 : 1;
  if (a.blinkT < 0) a.blinkT = 2 + Math.random() * 4;
  for (const e of parts.eyes) e.scale.y = blink;
}

/** Trigger squash (positive, landing) or stretch (negative, jump) on a makeHero rig. */
export function squashCharacter(hero, amount = 0.25) {
  if (hero?.userData?.anim) hero.userData.anim.squash = amount;
}

/** Kart / car silhouette with rounded body, rims, driver, spoiler and glowing headlights. */
export function makeVehicle(color = 0xd4a24e, opts = {}) {
  const root = new THREE.Group();
  root.name = "Vehicle";
  const body = new THREE.Group();
  root.add(body);
  const paint = mat(color, { roughness: 0.35, metalness: 0.2 });
  const dark = mat(0x22252b, { roughness: 0.8 });
  const chassis = new THREE.Mesh(roundedBoxGeometry(1.4, 0.38, 2.2, 0.14), paint);
  chassis.position.y = 0.42;
  const nose = new THREE.Mesh(roundedBoxGeometry(1.1, 0.25, 0.6, 0.1), paint);
  nose.position.set(0, 0.38, 1.15);
  const seat = new THREE.Mesh(roundedBoxGeometry(0.8, 0.45, 0.6, 0.12), dark);
  seat.position.set(0, 0.75, -0.35);
  body.add(chassis, nose, seat);

  if (opts.driver !== false) {
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 14), mat(opts.helmet ?? 0xffffff, { roughness: 0.3 }));
    helmet.position.set(0, 1.12, -0.2);
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3), mat(0x111820, { roughness: 0.1, metalness: 0.5 }));
    visor.rotation.x = Math.PI / 2;
    visor.position.set(0, 1.12, 0.0);
    body.add(helmet, visor);
  }
  const spoiler = new THREE.Mesh(roundedBoxGeometry(1.3, 0.06, 0.35, 0.03), paint);
  spoiler.position.set(0, 0.95, -1.05);
  const strutL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.1), dark);
  strutL.position.set(-0.45, 0.78, -1.05);
  const strutR = strutL.clone();
  strutR.position.x = 0.45;
  body.add(spoiler, strutL, strutR);

  const lightMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff4d0).multiplyScalar(3) });
  for (const sx of [-0.4, 0.4]) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), lightMat);
    l.position.set(sx, 0.45, 1.45);
    body.add(l);
  }

  const wheels = [];
  const tire = mat(0x1a1a1a, { roughness: 0.9 });
  const rim = mat(0xd9dde3, { roughness: 0.25, metalness: 0.9 });
  for (const [x, z, front] of [[-0.78, 0.75, true], [0.78, 0.75, true], [-0.78, -0.75, false], [0.78, -0.75, false]]) {
    const steer = new THREE.Group();
    steer.position.set(x, 0.32, z);
    const spin = new THREE.Group();
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.28, 20), tire);
    t.rotation.z = Math.PI / 2;
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.3, 12), rim);
    h.rotation.z = Math.PI / 2;
    spin.add(t, h);
    steer.add(spin);
    root.add(steer);
    wheels.push({ steer, spin, front });
  }
  root.userData.wheels = wheels;
  root.userData.body = body;
  root.traverse((o) => {
    if (o.isMesh && !o.material.isMeshBasicMaterial) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return root;
}

/** Spin wheels, steer front wheels, roll/pitch the body. speed m/s, steer -1..1. */
export function animateVehicle(vehicle, dt, { speed = 0, steer = 0, accel = 0 } = {}) {
  const wheels = vehicle?.userData?.wheels;
  if (!wheels) return;
  for (const w of wheels) {
    w.spin.rotation.x += (speed / 0.32) * dt;
    if (w.front) w.steer.rotation.y = steer * 0.45;
  }
  const body = vehicle.userData.body;
  if (body) {
    body.rotation.z = THREE.MathUtils.lerp(body.rotation.z, -steer * Math.min(1, Math.abs(speed) / 15) * 0.12, 1 - Math.exp(-dt * 8));
    body.rotation.x = THREE.MathUtils.lerp(body.rotation.x, -accel * 0.02, 1 - Math.exp(-dt * 6));
  }
}

/** Collectible gem — HDR emissive so it blooms. */
export function makePickup(color = 0xd4a24e) {
  const m = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.38, 0),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.4, roughness: 0.25, metalness: 0.1, flatShading: true }),
  );
  m.name = "Pickup";
  m.castShadow = true;
  return m;
}

export function makeCoin(color = 0xffc93c) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 0.08, 24),
    new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: 0.25, emissive: color, emissiveIntensity: 0.35 }),
  );
  m.rotation.x = Math.PI / 2;
  const g = new THREE.Group();
  g.name = "Coin";
  g.add(m);
  m.castShadow = true;
  return g;
}

export function makeCrate(size = 1, color = 0xb07a45) {
  const g = new THREE.Group();
  g.name = "Crate";
  const wood = mat(color, { roughness: 0.85 });
  const trim = mat(new THREE.Color(color).multiplyScalar(0.6).getHex(), { roughness: 0.9 });
  const core = new THREE.Mesh(roundedBoxGeometry(size, size, size, size * 0.05), wood);
  g.add(core);
  const t = size * 0.08;
  for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(t, t, size * 1.02), trim);
    bar.position.set((x * (size - t)) / 2, (y * (size - t)) / 2, 0);
    g.add(bar);
  }
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  return g;
}

/** Checkpoint / finish flag on a pole. */
export function makeFlag(color = 0xe53935, height = 3) {
  const g = new THREE.Group();
  g.name = "Flag";
  const pole = cylinder(0.06, 0.06, height, 0xe8e8e8, { metalness: 0.6, roughness: 0.3 });
  pole.position.y = height / 2;
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7, 8, 4), new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.8 }));
  cloth.position.set(0.58, height - 0.4, 0);
  g.add(pole, cloth);
  g.userData.cloth = cloth;
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return g;
}

/** Gate / finish arch with a glowing banner — strong landmark for races and exits. */
export function makeArch(width = 10, height = 5, color = 0x2b2d42, glowColor = 0xffd23f) {
  const g = new THREE.Group();
  g.name = "Arch";
  const m = mat(color, { roughness: 0.5 });
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(roundedBoxGeometry(0.8, height, 0.8, 0.12), m);
    post.position.set((sx * width) / 2, height / 2, 0);
    g.add(post);
  }
  const beam = new THREE.Mesh(roundedBoxGeometry(width + 0.8, 1.1, 0.9, 0.15), m);
  beam.position.y = height + 0.2;
  const strip = new THREE.Mesh(new THREE.BoxGeometry(width * 0.9, 0.3, 0.05), new THREE.MeshBasicMaterial({ color: new THREE.Color(glowColor).multiplyScalar(3) }));
  strip.position.set(0, height + 0.2, 0.46);
  g.add(beam, strip);
  g.traverse((o) => {
    if (o.isMesh && !o.material.isMeshBasicMaterial) o.castShadow = o.receiveShadow = true;
  });
  return g;
}

/** Graybox prop pillar */
export function makePillar(h = 2, color = 0x8a9098) {
  const m = roundedBox(1, h, 1, color, { radius: 0.08 });
  m.position.y = h / 2;
  return m;
}
