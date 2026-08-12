/**
 * Primitive composition helpers — graybox silhouettes without assets.
 */
import * as THREE from "/vendor/three/build/three.module.js";

export function mat(color, opts = {}) {
  return new THREE.MeshLambertMaterial({
    color,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: !!opts.transparent,
    opacity: opts.opacity ?? 1,
  });
}

export function box(w, h, d, color, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.castShadow = false;
  return m;
}

export function sphere(r, color, opts) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat(color, opts));
}

export function cylinder(rTop, rBot, h, color, opts) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, 12), mat(color, opts));
}

export function capsule(r, len, color, opts) {
  // Approximate capsule with cylinder + spheres
  const g = new THREE.Group();
  const body = cylinder(r, r, len, color, opts);
  const top = sphere(r, color, opts);
  const bot = sphere(r, color, opts);
  top.position.y = len / 2;
  bot.position.y = -len / 2;
  g.add(body, top, bot);
  return g;
}

/** Character silhouette: capsule body + head */
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

/** Simple vehicle / kart silhouette */
export function makeVehicle(color = 0xd4a24e) {
  const root = new THREE.Group();
  root.name = "Vehicle";
  const chassis = box(1.4, 0.35, 2.2, color);
  chassis.position.y = 0.35;
  const cabin = box(1.0, 0.4, 1.0, 0x333940);
  cabin.position.set(0, 0.7, -0.2);
  const wheelMat = 0x222222;
  for (const [x, z] of [
    [-0.7, 0.7],
    [0.7, 0.7],
    [-0.7, -0.7],
    [0.7, -0.7],
  ]) {
    const w = cylinder(0.28, 0.28, 0.2, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.28, z);
    root.add(w);
  }
  root.add(chassis, cabin);
  return root;
}

/** Collectible pickup */
export function makePickup(color = 0xd4a24e) {
  const m = box(0.55, 0.55, 0.55, color, { emissive: color, emissiveIntensity: 0.35 });
  m.name = "Pickup";
  return m;
}

/** Graybox prop pillar */
export function makePillar(h = 2, color = 0x8a9098) {
  const m = box(1, h, 1, color);
  m.position.y = h / 2;
  return m;
}
