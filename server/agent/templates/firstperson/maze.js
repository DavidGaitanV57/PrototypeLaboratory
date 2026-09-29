/**
 * Maze — seeded grid maze (backtracker + braiding), instanced walls, lamp fixtures, keycards, exit door,
 * circle-vs-wall collision, grid line-of-sight and BFS paths for the stalker.
 */
import * as THREE from "/vendor/three/build/three.module.js";
import { seededRandom } from "/runtime/WorldKit.js";
import { tilesTexture, noiseTexture, glow, stylized } from "/runtime/MaterialKit.js";

export function createMaze(scene, { LOOK, TUNING, seed = 1234 }) {
  const P = LOOK.palette;
  const { cell: C, gridW: W, gridH: H, wallHeight: WH } = TUNING;
  const rnd = seededRandom(seed);
  const root = new THREE.Group();
  root.name = "Maze";
  scene.add(root);

  // walls: east[x][y] = wall between (x,y) and (x+1,y); south[x][y] between (x,y) and (x,y+1)
  const east = [...Array(W)].map(() => Array(H).fill(true));
  const south = [...Array(W)].map(() => Array(H).fill(true));
  const seen = [...Array(W)].map(() => Array(H).fill(false));
  const stack = [[0, 0]];
  seen[0][0] = true;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([dx, dy]) => [x + dx, y + dy, dx, dy])
      .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < W && ny < H && !seen[nx][ny]);
    if (!n.length) {
      stack.pop();
      continue;
    }
    const [nx, ny, dx, dy] = n[(rnd() * n.length) | 0];
    if (dx === 1) east[x][y] = false;
    if (dx === -1) east[nx][ny] = false;
    if (dy === 1) south[x][y] = false;
    if (dy === -1) south[nx][ny] = false;
    seen[nx][ny] = true;
    stack.push([nx, ny]);
  }

  const open = (x, y, dx, dy) => {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) return false;
    if (dx === 1) return !east[x][y];
    if (dx === -1) return !east[nx][ny];
    if (dy === 1) return !south[x][y];
    return !south[nx][ny];
  };
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const degree = (x, y) => DIRS.filter(([dx, dy]) => open(x, y, dx, dy)).length;

  // Braid: open some dead ends into loops (chases need escape routes)
  for (let x = 0; x < W; x += 1) {
    for (let y = 0; y < H; y += 1) {
      if (degree(x, y) !== 1 || rnd() > TUNING.braid) continue;
      const closed = DIRS.filter(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        return nx >= 0 && ny >= 0 && nx < W && ny < H && !open(x, y, dx, dy);
      });
      if (!closed.length) continue;
      const [dx, dy] = closed[(rnd() * closed.length) | 0];
      if (dx === 1) east[x][y] = false;
      if (dx === -1) east[x - 1][y] = false;
      if (dy === 1) south[x][y] = false;
      if (dy === -1) south[x][y - 1] = false;
    }
  }

  const cellCenter = (x, y, out = new THREE.Vector3()) => out.set((x + 0.5) * C, 0, (y + 0.5) * C);
  const toCell = (p) => [THREE.MathUtils.clamp(Math.floor(p.x / C), 0, W - 1), THREE.MathUtils.clamp(Math.floor(p.z / C), 0, H - 1)];

  // Geometry ─────────────────────────────────────────────
  const T = 0.3;
  const wallBoxes = [];
  const addWall = (cx, cz, sx, sz) => wallBoxes.push({ cx, cz, hx: sx / 2, hz: sz / 2 });
  for (let x = 0; x < W; x += 1) {
    for (let y = 0; y < H; y += 1) {
      if (x === W - 1 || east[x][y]) addWall((x + 1) * C, (y + 0.5) * C, T, C + T);
      if (y === H - 1 || south[x][y]) addWall((x + 0.5) * C, (y + 1) * C, C + T, T);
      if (x === 0) addWall(0, (y + 0.5) * C, T, C + T);
      if (y === 0) addWall((x + 0.5) * C, 0, C + T, T);
    }
  }
  const wallTex = tilesTexture({ tile: P.wallTile, grout: P.grout, cells: 4, gap: 0.04 });
  wallTex.repeat.set(1, 0.8);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: wallTex, roughness: 0.85 });
  const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), wallMat, wallBoxes.length);
  const m4 = new THREE.Matrix4();
  wallBoxes.forEach((b, i) => {
    m4.compose(new THREE.Vector3(b.cx, WH / 2, b.cz), new THREE.Quaternion(), new THREE.Vector3(b.hx * 2, WH, b.hz * 2));
    walls.setMatrixAt(i, m4);
  });
  walls.receiveShadow = true;
  root.add(walls);

  const floorTex = noiseTexture({ base: P.floor, variation: 0.08 });
  floorTex.repeat.set(W, H);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W * C, H * C), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55, metalness: 0.1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((W * C) / 2, 0, (H * C) / 2);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W * C, H * C), stylized(P.ceiling, { roughness: 1 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set((W * C) / 2, WH, (H * C) / 2);
  root.add(floor, ceil);

  // Lamps: glowing panels in ~45% of cells; a small pool of real lights follows the player
  const fixtures = [];
  const lampMat = glow(P.lamp, 3);
  const lampWarmMat = glow(P.lampWarm, 2.4);
  const offMat = new THREE.MeshBasicMaterial({ color: 0x15171a });
  for (let x = 0; x < W; x += 1) {
    for (let y = 0; y < H; y += 1) {
      if (rnd() > 0.45 && !(x === 0 && y === 0)) continue;
      const warm = rnd() < 0.25;
      const panel = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.5), warm ? lampWarmMat : lampMat);
      const p = cellCenter(x, y);
      panel.position.set(p.x, WH - 0.04, p.z);
      root.add(panel);
      fixtures.push({ panel, pos: new THREE.Vector3(p.x, WH - 0.3, p.z), color: warm ? P.lampWarm : P.lamp, on: true, flicker: rnd() < 0.2, mat: panel.material, offMat });
    }
  }
  const pool = [];
  for (let i = 0; i < 5; i += 1) {
    const l = new THREE.PointLight(0xffffff, 0, C * 3, 2);
    root.add(l);
    pool.push(l);
  }

  // Keycards in far dead ends / corners
  const start = [0, 0];
  const dist = bfsDistances(start);
  const candidates = [];
  for (let x = 0; x < W; x += 1) for (let y = 0; y < H; y += 1) candidates.push({ x, y, d: dist[x][y], dead: degree(x, y) === 1 });
  candidates.sort((a, b) => (b.dead - a.dead) * 20 + (b.d - a.d));
  const exitCell = candidates[0];
  const keys = [];
  const used = new Set([`${exitCell.x},${exitCell.y}`, "0,0"]);
  const keyMat = glow(P.key, 2.2);
  for (const c of candidates.slice(1)) {
    if (keys.length >= TUNING.keys) break;
    if (used.has(`${c.x},${c.y}`) || c.d < 5) continue;
    if (keys.some((k) => Math.abs(k.cx - c.x) + Math.abs(k.cy - c.y) < 4)) continue;
    used.add(`${c.x},${c.y}`);
    const g = new THREE.Group();
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.28, 0.03), keyMat);
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.42, 32), glow(P.key, 1.4));
    halo.userData.noShadow = true;
    g.add(card, halo);
    const p = cellCenter(c.x, c.y);
    g.position.set(p.x, 1.1, p.z);
    root.add(g);
    keys.push({ group: g, cx: c.x, cy: c.y, taken: false });
  }

  // Exit door on the outer wall of the exit cell
  const exitPos = cellCenter(exitCell.x, exitCell.y);
  const door = new THREE.Group();
  const frameMat = stylized(0x1a1c20, { roughness: 0.6, metalness: 0.4 });
  const doorSlab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.5, 0.12), stylized(0x2c3036, { roughness: 0.5, metalness: 0.6 }));
  doorSlab.position.y = 1.25;
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.05), glow(P.exitLocked, 2.5));
  sign.position.set(0, 2.85, 0.05);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.7, 0.2), frameMat);
  const post2 = post.clone();
  post.position.set(-0.88, 1.35, 0);
  post2.position.set(0.88, 1.35, 0);
  const exitLight = new THREE.PointLight(P.exitLocked, 3, 7, 2);
  exitLight.position.set(0, 2.4, 0.8);
  door.add(doorSlab, sign, post, post2, exitLight);
  door.position.copy(exitPos);
  root.add(door);
  // Face the door toward the open side of the cell
  const openDir = DIRS.find(([dx, dy]) => open(exitCell.x, exitCell.y, dx, dy)) || [0, -1];
  door.rotation.y = Math.atan2(openDir[0], openDir[1]);
  door.position.x -= openDir[0] * (C / 2 - 0.2);
  door.position.z -= openDir[1] * (C / 2 - 0.2);

  // Queries ─────────────────────────────────────────────
  function bfsDistances([sx, sy]) {
    const d = [...Array(W)].map(() => Array(H).fill(Infinity));
    d[sx][sy] = 0;
    const q = [[sx, sy]];
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of DIRS) {
        if (!open(x, y, dx, dy)) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (d[nx][ny] <= d[x][y] + 1) continue;
        d[nx][ny] = d[x][y] + 1;
        q.push([nx, ny]);
      }
    }
    return d;
  }

  /** Cell path from a to b (inclusive), as world points. */
  function path(a, b) {
    const prev = new Map();
    const key = (x, y) => x * 1000 + y;
    const q = [a];
    prev.set(key(...a), null);
    while (q.length) {
      const [x, y] = q.shift();
      if (x === b[0] && y === b[1]) break;
      for (const [dx, dy] of DIRS) {
        if (!open(x, y, dx, dy)) continue;
        const k = key(x + dx, y + dy);
        if (prev.has(k)) continue;
        prev.set(k, [x, y]);
        q.push([x + dx, y + dy]);
      }
    }
    const out = [];
    let cur = b;
    if (!prev.has(key(...b))) return out;
    while (cur) {
      out.unshift(cellCenter(cur[0], cur[1]));
      cur = prev.get(key(...cur));
    }
    return out;
  }

  /** Grid line of sight (walls block). */
  function lineOfSight(a, b) {
    const steps = Math.ceil(a.distanceTo(b) / 0.25);
    let [cx, cy] = toCell(a);
    const p = new THREE.Vector3();
    for (let i = 1; i <= steps; i += 1) {
      p.lerpVectors(a, b, i / steps);
      const [nx, ny] = toCell(p);
      if (nx !== cx || ny !== cy) {
        const dx = Math.sign(nx - cx);
        const dy = Math.sign(ny - cy);
        if (dx && dy) {
          if (!((open(cx, cy, dx, 0) && open(cx + dx, cy, 0, dy)) || (open(cx, cy, 0, dy) && open(cx, cy + dy, dx, 0)))) return false;
        } else if (!open(cx, cy, dx, dy)) return false;
        cx = nx;
        cy = ny;
      }
    }
    return true;
  }

  /** Push a circle out of walls (XZ). */
  function collide(pos, r) {
    for (const b of wallBoxes) {
      const qx = THREE.MathUtils.clamp(pos.x, b.cx - b.hx, b.cx + b.hx);
      const qz = THREE.MathUtils.clamp(pos.z, b.cz - b.hz, b.cz + b.hz);
      const dx = pos.x - qx;
      const dz = pos.z - qz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        const d = Math.sqrt(d2) || 1e-4;
        pos.x += (dx / d) * (r - d);
        pos.z += (dz / d) * (r - d);
      }
    }
  }

  let lightT = 0;
  function updateLights(dt, playerPos, t) {
    lightT -= dt;
    for (const f of fixtures) {
      if (!f.flicker) continue;
      const on = Math.sin(t * 13 + f.pos.x) + Math.sin(t * 7.3 + f.pos.z) > -1.1;
      f.panel.material = on ? f.mat : f.offMat;
      f.on = on;
    }
    if (lightT > 0) return;
    lightT = 0.25;
    const near = fixtures
      .filter((f) => f.on)
      .map((f) => ({ f, d: f.pos.distanceToSquared(playerPos) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, pool.length);
    pool.forEach((l, i) => {
      const n = near[i];
      if (!n) {
        l.intensity = 0;
        return;
      }
      l.position.copy(n.f.pos);
      l.color.setHex(n.f.color);
      l.intensity = 9;
    });
  }

  function setExitOpen(isOpen) {
    sign.material.color.copy(new THREE.Color(isOpen ? P.exitOpen : P.exitLocked).multiplyScalar(2.5));
    exitLight.color.setHex(isOpen ? P.exitOpen : P.exitLocked);
  }

  return {
    root,
    cellCenter,
    toCell,
    path,
    lineOfSight,
    collide,
    keys,
    exitPos,
    exitCell,
    fixtures,
    size: { w: W * C, h: H * C },
    randomCell: () => [(rnd() * W) | 0, (rnd() * H) | 0],
    setExitOpen,
    update(dt, playerPos, t) {
      updateLights(dt, playerPos, t);
      for (const k of keys) {
        if (k.taken) continue;
        k.group.rotation.y += dt * 1.8;
        k.group.position.y = 1.1 + Math.sin(t * 2 + k.cx) * 0.08;
      }
    },
    reset() {
      for (const k of keys) {
        k.taken = false;
        k.group.visible = true;
      }
      setExitOpen(false);
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
