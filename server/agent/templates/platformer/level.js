/**
 * Level — floating islands, moving platforms, bounce pads, spinner hazards, stars, goal beacon, cloud sea.
 * Platforms are AABB colliders (center + half extents) so physics stays simple and readable.
 */
import * as THREE from "/vendor/three/build/three.module.js";
import { roundedBoxGeometry, makePickup } from "/runtime/Primitives.js";
import { stylized, glow } from "/runtime/MaterialKit.js";
import { makeTree, makeBush, makeRock, makeCloud, makeWater } from "/runtime/WorldKit.js";

// [x, topY, z, width, depth, type, extra]
const LAYOUT = [
  [0, 0, 0, 12, 12, "island"],
  [0, 1.5, -12, 5, 5, "island"],
  [6, 3, -20, 5, 5, "island"],
  [6, 3, -30, 4, 4, "moving", { axis: "x", range: 5, speed: 0.8 }],
  [0, 4.5, -40, 7, 7, "island", { spinner: true }],
  [-8, 6, -48, 4, 4, "island"],
  [-8, 6, -57, 4, 4, "bounce"],
  [-8, 13, -68, 6, 6, "island"],
  [0, 14, -76, 4, 4, "moving", { axis: "z", range: 4, speed: 1 }],
  [8, 15.5, -86, 6, 6, "island", { spinner: true }],
  [8, 17, -97, 4, 4, "moving", { axis: "y", range: 2.5, speed: 1.1 }],
  [0, 19, -108, 10, 10, "goal"],
];

export function createLevel(scene, { LOOK }) {
  const P = LOOK.palette;
  const root = new THREE.Group();
  root.name = "Level";
  scene.add(root);
  const colliders = [];
  const movers = [];
  const spinners = [];
  const stars = [];
  const bouncers = [];
  const matGrass = stylized(P.grass, { roughness: 0.8 });
  const matEarth = stylized(P.earth, { roughness: 0.9, flat: true });
  const matMove = stylized(P.moving, { roughness: 0.4 });
  const matBounce = stylized(P.bounce, { roughness: 0.35, emissive: P.bounce, emissiveIntensity: 0.25 });
  const route = [];
  let goal = null;

  for (const [x, top, z, w, d, type, extra = {}] of LAYOUT) {
    const g = new THREE.Group();
    g.position.set(x, top, z);
    root.add(g);
    const h = type === "island" || type === "goal" ? 2.4 : 0.8;
    if (type === "island" || type === "goal") {
      const turf = new THREE.Mesh(roundedBoxGeometry(w, 0.6, d, 0.25), matGrass);
      turf.position.y = -0.3;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(w, d) * 0.55, Math.min(w, d) * 0.2, 3.2, 7), matEarth);
      body.position.y = -2.1;
      body.scale.set(w / Math.min(w, d), 1, d / Math.min(w, d));
      g.add(turf, body);
      if (w >= 6) {
        const tree = makeTree({ style: "round", color: 0x5fcf80, seed: x * 31 + z });
        tree.position.set(-w / 2 + 1.2, 0, -d / 2 + 1.2);
        tree.scale.multiplyScalar(0.8);
        g.add(tree);
        const bush = makeBush({ seed: z * 7 });
        bush.position.set(w / 2 - 1, 0, d / 2 - 1.2);
        g.add(bush);
      }
    } else {
      const slab = new THREE.Mesh(roundedBoxGeometry(w, h, d, 0.2), type === "bounce" ? matBounce : matMove);
      slab.position.y = -h / 2;
      g.add(slab);
      if (type === "bounce") {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(Math.min(w, d) * 0.32, 0.12, 8, 32), glow(P.bounce, 2.5));
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.05;
        g.add(ring);
        bouncers.push({ group: g, ring });
      }
    }
    const col = {
      group: g,
      half: new THREE.Vector3(w / 2, type === "island" || type === "goal" ? 0.6 : h / 2, d / 2),
      center: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      type,
      topOffset: 0,
    };
    col.update = () => {
      col.center.set(g.position.x, g.position.y - col.half.y, g.position.z);
    };
    col.update();
    colliders.push(col);
    route.push(g.position.clone());

    if (type === "moving") {
      movers.push({ g, col, base: g.position.clone(), ...extra, t: Math.random() * 6 });
    }
    if (extra.spinner) {
      const pivot = new THREE.Group();
      pivot.position.y = 0.7;
      const bar = new THREE.Mesh(roundedBoxGeometry(w * 0.9, 0.35, 0.35, 0.12), stylized(P.hazard, { emissive: P.hazard, emissiveIntensity: 0.4 }));
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.8, 16), stylized(0x2b2d42));
      hub.position.y = -0.3;
      pivot.add(bar, hub);
      g.add(pivot);
      spinners.push({ pivot, g, length: w * 0.45, speed: 1.6 + Math.random() * 0.6 });
    }
    if (type === "goal") {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 5, 20), stylized(0xf5f5ff, { roughness: 0.3 }));
      pillar.position.y = 2.5;
      const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 1), glow(P.beacon, 1.2));
      orb.position.y = 5.8;
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 60, 16, 1, true),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(P.beacon).multiplyScalar(2), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
      beam.position.y = 36;
      beam.userData.noShadow = true;
      g.add(pillar, orb, beam);
      goal = { g, orb, beam, pos: g.position.clone().setY(g.position.y + 1), open: false };
    }
  }

  // Stars along the route (arcs between consecutive platforms + clusters on islands)
  const starGeo = new THREE.OctahedronGeometry(0.38, 0);
  for (let i = 0; i < route.length - 1; i += 1) {
    const a = route[i];
    const b = route[i + 1];
    for (let k = 1; k <= 2; k += 1) {
      const t = k / 3;
      const p = a.clone().lerp(b, t);
      p.y = THREE.MathUtils.lerp(a.y, b.y, t) + 1.4 + Math.sin(t * Math.PI) * 1.6;
      addStar(p);
    }
  }
  addStar(new THREE.Vector3(3, 1.2, 3));
  addStar(new THREE.Vector3(-3, 1.2, 3));
  addStar(new THREE.Vector3(-8, 16.5, -57)); // bonus above bounce pad

  function addStar(p) {
    const m = makePickup(P.star);
    m.geometry.dispose();
    m.geometry = starGeo;
    m.position.copy(p);
    root.add(m);
    stars.push({ mesh: m, base: p.clone(), taken: false });
  }

  // Cloud sea + sky clouds
  const sea = makeWater({ size: 400, color: P.sea, deep: P.seaDeep, foam: 0xffffff, opacity: 1 });
  sea.mesh.position.y = -9;
  root.add(sea.mesh);
  for (let i = 0; i < 16; i += 1) {
    const c = makeCloud({ seed: i * 5 + 1, scale: 1.5 + (i % 3) });
    const side = i % 2 ? 1 : -1;
    c.position.set(side * (30 + ((i * 37) % 45)), -6 + (i % 4) * 8, -((i * 23) % 150) + 10);
    root.add(c);
  }
  for (let i = 0; i < 8; i += 1) {
    const r = makeRock({ size: 1.5 + (i % 3), color: 0xb9a6d9, seed: i });
    r.position.set(((i * 53) % 90) - 45, -8.5, -((i * 41) % 140));
    root.add(r);
  }

  const spawn = new THREE.Vector3(0, 0.1, 3);

  return {
    root,
    colliders,
    stars,
    goal,
    spawn,
    route,
    bouncers,
    spinners,
    update(dt, t) {
      for (const m of movers) {
        m.t += dt * m.speed;
        const prev = m.g.position.clone();
        const off = Math.sin(m.t) * m.range;
        m.g.position.copy(m.base);
        m.g.position[m.axis] += off;
        m.col.vel.subVectors(m.g.position, prev).divideScalar(Math.max(1e-4, dt));
        m.col.update();
      }
      for (const s of spinners) s.pivot.rotation.y += dt * s.speed;
      for (const s of stars) {
        if (s.taken) continue;
        s.mesh.rotation.y += dt * 2.2;
        s.mesh.position.y = s.base.y + Math.sin(t * 2.5 + s.base.x) * 0.15;
      }
      for (const b of bouncers) b.ring.scale.setScalar(1 + Math.sin(t * 6) * 0.08);
      if (goal) {
        goal.orb.rotation.y += dt;
        goal.orb.position.y = 5.8 + Math.sin(t * 1.5) * 0.25;
        const target = goal.open ? 0.35 : 0;
        goal.beam.material.opacity += (target - goal.beam.material.opacity) * Math.min(1, dt * 3);
      }
      sea.update(dt);
    },
    reset() {
      for (const s of stars) {
        s.taken = false;
        s.mesh.visible = true;
        s.mesh.scale.setScalar(1);
      }
      if (goal) goal.open = false;
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
