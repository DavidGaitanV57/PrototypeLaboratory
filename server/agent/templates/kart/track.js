/**
 * Track — PathKit spline turned into an asphalt ribbon with curbs, start arch, item boxes, boost pads and scenery.
 */
import * as THREE from "/vendor/three/build/three.module.js";
import { createPath } from "/runtime/PathKit.js";
import { makeArch, makePickup, makeFlag } from "/runtime/Primitives.js";
import { noiseTexture, stripesTexture, checkerTexture, glow } from "/runtime/MaterialKit.js";
import { makeTree, makeRock, makeBackdrop, makeCloud, makeGrass, scatter } from "/runtime/WorldKit.js";

const CONTROL_POINTS = [
  [0, 0, 60], [38, 0, 58], [70, 0, 34], [74, 0, -6], [52, 0, -30], [22, 0, -22],
  [0, 0, -48], [-36, 0, -60], [-70, 0, -34], [-66, 0, 4], [-40, 0, 20], [-34, 0, 48],
];

function ribbon(path, width, offset, y, segments = 480) {
  const pos = [];
  const uv = [];
  const idx = [];
  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3();
  let dist = 0;
  let prev = null;
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const p = path.pointAtT(t);
    const tan = path.tangentAtT(t);
    side.crossVectors(tan, up).normalize();
    if (prev) dist += p.distanceTo(prev);
    prev = p;
    const a = p.clone().addScaledVector(side, offset - width / 2);
    const b = p.clone().addScaledVector(side, offset + width / 2);
    pos.push(a.x, y, a.z, b.x, y, b.z);
    uv.push(0, dist / width, 1, dist / width);
    if (i < segments) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function createTrack(scene, { LOOK, TUNING }) {
  const root = new THREE.Group();
  root.name = "Track";
  scene.add(root);
  const P = LOOK.palette;
  const path = createPath(CONTROL_POINTS, { closed: true, tension: 0.5 });
  const W = TUNING.trackWidth;

  const asphaltTex = noiseTexture({ base: P.asphalt, variation: 0.035 });
  const road = new THREE.Mesh(
    ribbon(path, W, 0, 0.03),
    new THREE.MeshStandardMaterial({ color: 0xffffff, map: asphaltTex, roughness: 0.92 }),
  );
  asphaltTex.repeat.set(2, 2);
  road.receiveShadow = true;
  root.add(road);

  const curbTex = stripesTexture({ a: P.curbA, b: P.curbB, count: 2 });
  curbTex.repeat.set(1, 3);
  for (const side of [-1, 1]) {
    const curb = new THREE.Mesh(
      ribbon(path, 1.2, side * (W / 2 + 0.5), 0.06),
      new THREE.MeshStandardMaterial({ color: 0xffffff, map: curbTex, roughness: 0.7 }),
    );
    curb.receiveShadow = true;
    root.add(curb);
  }

  // Start/finish line + arch
  const start = path.pointAtT(0);
  const tan0 = path.tangentAtT(0);
  const yaw0 = Math.atan2(tan0.x, tan0.z);
  const line = new THREE.Mesh(
    new THREE.PlaneGeometry(W, 2.2),
    new THREE.MeshStandardMaterial({ map: checkerTexture({ cells: 8, a: 0xf5f5f5, b: 0x151515, repeat: [2, 0.5] }), roughness: 0.8 }),
  );
  line.rotation.set(-Math.PI / 2, 0, yaw0);
  line.position.set(start.x, 0.07, start.z);
  root.add(line);
  const arch = makeArch(W + 2, 6, P.arch, P.archGlow);
  arch.position.copy(start);
  arch.rotation.y = yaw0;
  root.add(arch);

  // Flags every few meters on the outside
  for (let i = 0; i < 18; i += 1) {
    const t = i / 18 + 0.02;
    const p = path.pointAtT(t);
    const s = new THREE.Vector3().crossVectors(path.tangentAtT(t), new THREE.Vector3(0, 1, 0)).normalize();
    const f = makeFlag(i % 2 ? P.curbA : P.itemBox, 3.5);
    f.position.copy(p).addScaledVector(s, (i % 2 ? 1 : -1) * (W / 2 + 3));
    root.add(f);
  }

  // Item boxes (rows across the track)
  const itemBoxes = [];
  for (const t of [0.22, 0.55, 0.8]) {
    const p = path.pointAtT(t);
    const s = new THREE.Vector3().crossVectors(path.tangentAtT(t), new THREE.Vector3(0, 1, 0)).normalize();
    for (const o of [-4, 0, 4]) {
      const m = makePickup(P.itemBox);
      m.scale.setScalar(1.6);
      m.position.copy(p).addScaledVector(s, o);
      m.position.y = 1.2;
      root.add(m);
      itemBoxes.push({ mesh: m, t, cooldown: 0 });
    }
  }

  // Boost pads (glowing chevrons)
  const boostPads = [];
  const padMat = glow(P.boostPad, 2.2);
  for (const t of [0.12, 0.43, 0.68]) {
    const p = path.pointAtT(t);
    const tan = path.tangentAtT(t);
    const pad = new THREE.Group();
    for (let i = 0; i < 3; i += 1) {
      const chev = new THREE.Mesh(new THREE.ConeGeometry(1.4, 1.2, 3), padMat);
      chev.rotation.x = -Math.PI / 2;
      chev.scale.z = 0.08;
      chev.position.z = i * 1.3 - 1.3;
      pad.add(chev);
    }
    pad.position.set(p.x, 0.1, p.z);
    pad.rotation.y = Math.atan2(tan.x, tan.z);
    root.add(pad);
    boostPads.push({ mesh: pad, pos: p.clone(), radius: 2.6 });
  }

  // Scenery — keep the road clear
  const clear = (x, z) => path.nearestT(new THREE.Vector3(x, 0, z)).distance < W / 2 + 5;
  const trees = scatter(root, (r) => makeTree({ style: r() < 0.6 ? "round" : "pine", color: P.trees[(r() * P.trees.length) | 0], seed: (r() * 1e6) | 0 }), {
    count: 90, area: 210, avoid: clear, seed: 4, scale: [1.1, 1.9],
  });
  scatter(root, (r) => makeRock({ size: 1 + r() * 1.5, seed: (r() * 1e6) | 0 }), { count: 26, area: 190, avoid: clear, seed: 9 });
  const grass = makeGrass({ area: 200, count: 9000, avoid: (x, z) => clear(x, z) || Math.hypot(x, z) > 100, seed: 5 });
  root.add(grass.mesh);
  root.add(makeBackdrop({ radius: 190, height: [25, 60] }));
  for (let i = 0; i < 10; i += 1) {
    const c = makeCloud({ seed: i + 3, scale: 2 + (i % 3) });
    const a = (i / 10) * Math.PI * 2;
    c.position.set(Math.cos(a) * 130, 45 + (i % 4) * 6, Math.sin(a) * 130);
    root.add(c);
  }

  const bounds = new THREE.Box3().setFromPoints(path.lut.map((l) => l.point));

  /** Grid placement behind the start line (index 0 = pole). */
  function startTransform(i) {
    const row = Math.floor(i / 2);
    const col = i % 2 ? 1 : -1;
    const len = path.length;
    const t = path.tAtLength(len - 6 - row * 5.5);
    const p = path.pointAtT(t);
    const tan = path.tangentAtT(t);
    const s = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0)).normalize();
    p.addScaledVector(s, col * 3);
    return { position: p, yaw: Math.atan2(tan.x, tan.z), t };
  }

  return {
    root,
    path,
    width: W,
    bounds,
    itemBoxes,
    boostPads,
    trees,
    startTransform,
    update(dt) {
      grass.update(dt);
      for (const b of itemBoxes) {
        b.mesh.rotation.y += dt * 1.5;
        b.mesh.rotation.x += dt * 0.7;
        if (b.cooldown > 0) {
          b.cooldown -= dt;
          b.mesh.visible = b.cooldown <= 0;
        }
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
