/**
 * Arena — glowing ring floor, cover pillars (circle colliders), spawn portals, neon city backdrop.
 */
import * as THREE from "/vendor/three/build/three.module.js";
import { roundedBoxGeometry } from "/runtime/Primitives.js";
import { stylized, glow, tilesTexture } from "/runtime/MaterialKit.js";
import { seededRandom } from "/runtime/WorldKit.js";

export function createArena(scene, { LOOK, TUNING }) {
  const P = LOOK.palette;
  const R = TUNING.arenaRadius;
  const root = new THREE.Group();
  root.name = "Arena";
  scene.add(root);

  const floorTex = tilesTexture({ tile: P.floor, grout: P.floorLine, cells: 4, gap: 0.03 });
  floorTex.repeat.set(R / 2, R / 2);
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 1, 64), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.35, metalness: 0.4 }));
  floor.position.y = -0.5;
  floor.receiveShadow = true;
  root.add(floor);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.18, 12, 96), glow(P.rim, 3));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.05;
  root.add(rim);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.3, R - 2, 6, 64, 1, true), stylized(0x0a0c18, { roughness: 0.8 }));
  skirt.position.y = -3.5;
  root.add(skirt);

  // Cover pillars
  const pillars = [];
  const pMat = stylized(P.pillar, { roughness: 0.4, metalness: 0.5 });
  const pGlow = glow(P.pillarGlow, 2.2);
  const count = 6;
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2 + Math.PI / 6;
    const r = R * 0.52;
    const g = new THREE.Group();
    const body = new THREE.Mesh(roundedBoxGeometry(2.2, 3.4, 2.2, 0.25), pMat);
    body.position.y = 1.7;
    const strip = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.12, 2.26), pGlow);
    strip.position.y = 2.8;
    g.add(body, strip);
    g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    root.add(g);
    pillars.push({ pos: g.position.clone(), radius: 1.45 });
  }

  // Portals at the rim
  const portals = [];
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.12, 8, 40), glow(P.portal, 2.5));
    ring.position.set(Math.cos(a) * (R - 1.8), 1.6, Math.sin(a) * (R - 1.8));
    ring.lookAt(0, 1.6, 0);
    root.add(ring);
    portals.push({ ring, pos: ring.position.clone().setY(0), flare: 0 });
  }

  // Neon city backdrop
  const rnd = seededRandom(21);
  const city = new THREE.Group();
  const cityMat = stylized(P.city, { roughness: 0.9 });
  for (let i = 0; i < 48; i += 1) {
    const a = rnd() * Math.PI * 2;
    const d = R + 34 + rnd() * 60;
    const h = 8 + rnd() * 40;
    const w = 4 + rnd() * 8;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), cityMat);
    b.position.set(Math.cos(a) * d, h / 2 - 8, Math.sin(a) * d);
    city.add(b);
    const rows = Math.floor(h / 4);
    const wm = glow(P.windows[(rnd() * P.windows.length) | 0], 1.6 + rnd());
    for (let r = 0; r < rows; r += 1) {
      if (rnd() < 0.4) continue;
      const strip = new THREE.Mesh(new THREE.BoxGeometry(w * 1.01, 0.3, w * 1.01), wm);
      strip.position.copy(b.position);
      strip.position.y = -8 + 2 + r * 4;
      city.add(strip);
    }
  }
  city.traverse((o) => {
    if (o.isMesh) o.userData.noShadow = true;
  });
  root.add(city);

  /** Keep a circle inside the ring and outside pillars. */
  function collide(pos, radius) {
    const d = Math.hypot(pos.x, pos.z);
    const max = R - 0.6 - radius;
    if (d > max) {
      pos.x *= max / d;
      pos.z *= max / d;
    }
    for (const p of pillars) {
      const dx = pos.x - p.pos.x;
      const dz = pos.z - p.pos.z;
      const dd = Math.hypot(dx, dz);
      const min = p.radius + radius;
      if (dd < min && dd > 1e-4) {
        pos.x = p.pos.x + (dx / dd) * min;
        pos.z = p.pos.z + (dz / dd) * min;
      }
    }
  }

  function blocksBullet(pos) {
    for (const p of pillars) if (Math.hypot(pos.x - p.pos.x, pos.z - p.pos.z) < p.radius - 0.2) return true;
    return Math.hypot(pos.x, pos.z) > R + 1;
  }

  return {
    root,
    radius: R,
    portals,
    collide,
    blocksBullet,
    update(dt, t) {
      rim.material.color.setHex(P.rim).multiplyScalar(2.6 + Math.sin(t * 2) * 0.6);
      for (const pt of portals) {
        pt.flare = Math.max(0, pt.flare - dt * 2);
        pt.ring.rotation.z += dt * (1 + pt.flare * 6);
        pt.ring.scale.setScalar(1 + pt.flare * 0.4);
      }
    },
    dispose() {
      scene.remove(root);
      root.traverse((o) => {
        o.geometry?.dispose?.();
        if (o.material && !Array.isArray(o.material)) o.material.dispose?.();
      });
    },
  };
}
