/**
 * FxKit — pooled GPU particles (sparks, dust, confetti, smoke, explosion, pickup burst), shockwave rings, ribbon trails, speed lines. Call fx.update(dt) each frame.
 */
import * as THREE from "/vendor/three/build/three.module.js";

const P_VERT = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
varying float vAlpha;
varying vec3 vColor;
uniform float uScale;
void main() {
  vAlpha = aAlpha;
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const P_FRAG = /* glsl */ `
varying float vAlpha;
varying vec3 vColor;
uniform float uSoft;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  if (r > 1.0) discard;
  float a = uSoft > 0.5 ? (1.0 - r * r) : smoothstep(1.0, 0.7, r);
  gl_FragColor = vec4(vColor, a * vAlpha);
}`;

function makePool(scene, max, { additive, soft }) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3);
  const col = new Float32Array(max * 3);
  const size = new Float32Array(max);
  const alpha = new Float32Array(max);
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    vertexShader: P_VERT,
    fragmentShader: P_FRAG,
    uniforms: { uScale: { value: 300 }, uSoft: { value: soft ? 1 : 0 } },
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.userData.noShadow = true;
  points.renderOrder = 5;
  scene.add(points);
  const p = {
    max,
    count: 0,
    points,
    vel: new Float32Array(max * 3),
    life: new Float32Array(max),
    maxLife: new Float32Array(max),
    size0: new Float32Array(max),
    grav: new Float32Array(max),
    drag: new Float32Array(max),
    grow: new Float32Array(max),
  };
  return p;
}

function spawn(pool, x, y, z, vx, vy, vz, color, sizeV, life, gravity, drag, grow) {
  let i = pool.count;
  if (i >= pool.max) i = Math.floor(Math.random() * pool.max);
  else pool.count += 1;
  const g = pool.points.geometry.attributes;
  g.position.array.set([x, y, z], i * 3);
  g.aColor.array.set([color.r, color.g, color.b], i * 3);
  pool.vel.set([vx, vy, vz], i * 3);
  pool.life[i] = life;
  pool.maxLife[i] = life;
  pool.size0[i] = sizeV;
  pool.grav[i] = gravity;
  pool.drag[i] = drag;
  pool.grow[i] = grow;
  g.aSize.array[i] = sizeV;
  g.aAlpha.array[i] = 1;
}

function stepPool(pool, dt) {
  const g = pool.points.geometry.attributes;
  const P = g.position.array;
  const S = g.aSize.array;
  const A = g.aAlpha.array;
  const C = g.aColor.array;
  let i = 0;
  while (i < pool.count) {
    pool.life[i] -= dt;
    if (pool.life[i] <= 0) {
      const last = pool.count - 1;
      if (i !== last) {
        for (let k = 0; k < 3; k += 1) {
          P[i * 3 + k] = P[last * 3 + k];
          C[i * 3 + k] = C[last * 3 + k];
          pool.vel[i * 3 + k] = pool.vel[last * 3 + k];
        }
        pool.life[i] = pool.life[last];
        pool.maxLife[i] = pool.maxLife[last];
        pool.size0[i] = pool.size0[last];
        pool.grav[i] = pool.grav[last];
        pool.drag[i] = pool.drag[last];
        pool.grow[i] = pool.grow[last];
      }
      pool.count -= 1;
      continue;
    }
    const d = Math.exp(-pool.drag[i] * dt);
    pool.vel[i * 3] *= d;
    pool.vel[i * 3 + 1] = pool.vel[i * 3 + 1] * d - pool.grav[i] * dt;
    pool.vel[i * 3 + 2] *= d;
    P[i * 3] += pool.vel[i * 3] * dt;
    P[i * 3 + 1] += pool.vel[i * 3 + 1] * dt;
    P[i * 3 + 2] += pool.vel[i * 3 + 2] * dt;
    const k = pool.life[i] / pool.maxLife[i];
    S[i] = pool.size0[i] * (1 + (1 - k) * pool.grow[i]);
    A[i] = Math.min(1, k * 2.5);
    i += 1;
  }
  g.position.needsUpdate = true;
  g.aSize.needsUpdate = true;
  g.aAlpha.needsUpdate = true;
  g.aColor.needsUpdate = true;
  pool.points.geometry.setDrawRange(0, pool.count);
}

/**
 * @param {THREE.Scene} scene
 * @param {{ camera?: THREE.Camera, max?: number }} [opts]
 */
export function createFx(scene, { camera, max = 3000 } = {}) {
  const glowPool = makePool(scene, max, { additive: true, soft: true });
  const solidPool = makePool(scene, Math.floor(max / 2), { additive: false, soft: false });
  const rings = [];
  const trails = [];
  const tmpC = new THREE.Color();
  const rnd = (a, b) => a + Math.random() * (b - a);

  /**
   * Generic burst. glow=true uses additive blending (sparks, magic); false = dust, confetti, smoke.
   */
  function burst(pos, {
    count = 24, color = 0xffd27a, colors = null, speed = 6, spread = 1, up = 0.4, gravity = 9,
    drag = 1.5, life = 0.7, size = 0.25, grow = 0, glow = true, hdr = 2,
  } = {}) {
    const pool = glow ? glowPool : solidPool;
    for (let i = 0; i < count; i += 1) {
      const c = colors ? colors[(Math.random() * colors.length) | 0] : color;
      tmpC.set(c);
      if (glow) tmpC.multiplyScalar(hdr);
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(rnd(-1, 1) * spread);
      const sp = speed * rnd(0.35, 1);
      const vx = Math.sin(ph) * Math.cos(th) * sp;
      const vz = Math.sin(ph) * Math.sin(th) * sp;
      const vy = Math.cos(ph) * sp * (1 - up) + up * sp;
      spawn(pool, pos.x, pos.y, pos.z, vx, vy, vz, tmpC, size * rnd(0.6, 1.2), life * rnd(0.6, 1.2), gravity, drag, grow);
    }
  }

  const sparks = (pos, o = {}) => burst(pos, { count: 28, color: 0xffc46b, speed: 9, gravity: 14, life: 0.45, size: 0.12, ...o });
  const dust = (pos, o = {}) => burst(pos, { count: 14, color: 0xcfc6b4, speed: 2.5, up: 0.7, gravity: -0.5, drag: 3, life: 0.8, size: 0.45, grow: 1.5, glow: false, ...o });
  const confetti = (pos, o = {}) => burst(pos, { count: 90, colors: [0xff4d6d, 0xffd23f, 0x3ddc97, 0x4cc9f0, 0xb388ff], speed: 10, up: 0.8, gravity: 7, drag: 1.2, life: 2.2, size: 0.2, glow: false, ...o });
  const smoke = (pos, o = {}) => burst(pos, { count: 18, color: 0x55585e, speed: 1.6, up: 0.9, gravity: -1.2, drag: 1, life: 1.6, size: 0.9, grow: 2.2, glow: false, ...o });
  const pickup = (pos, color = 0xffd23f, o = {}) => {
    burst(pos, { count: 22, color, speed: 5, up: 0.5, gravity: 2, life: 0.55, size: 0.18, ...o });
    ring(pos, { color, radius: 1.6, life: 0.35 });
  };
  const explosion = (pos, o = {}) => {
    burst(pos, { count: 40, color: 0xff8a3d, speed: 11, gravity: 6, life: 0.6, size: 0.35, hdr: 3, ...o });
    burst(pos, { count: 16, color: 0xfff1b0, speed: 4, gravity: 0, life: 0.3, size: 0.7, grow: 1.5, hdr: 4 });
    smoke(pos, { count: 22 });
    ring(pos, { color: 0xffb36b, radius: 5, life: 0.45 });
  };

  /** Expanding shockwave ring on the ground plane (or facing `normal`). */
  function ring(pos, { color = 0xffffff, radius = 3, life = 0.4, width = 0.18, normal = null } = {}) {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(2),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(1 - width, 1, 48), mat);
    mesh.position.copy(pos);
    if (normal) mesh.lookAt(mesh.position.clone().add(normal));
    else mesh.rotation.x = -Math.PI / 2;
    mesh.position.y += 0.05;
    mesh.userData.noShadow = true;
    mesh.scale.setScalar(0.01);
    scene.add(mesh);
    rings.push({ mesh, t: 0, life, radius });
  }

  /** Ribbon trail behind an object. Returns { setActive(bool), dispose() }. */
  function trail(object3d, { color = 0x9ad1ff, width = 0.35, length = 24, offset = null, glow = true } = {}) {
    const n = Math.max(4, length);
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 2 * 3);
    const alpha = new Float32Array(n * 2);
    const idx = [];
    for (let i = 0; i < n - 1; i += 1) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setIndex(idx);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const c = new THREE.Color(color).multiplyScalar(glow ? 2.2 : 1);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: c } },
      vertexShader: `attribute float aAlpha; varying float vA; void main(){ vA = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
      fragmentShader: `uniform vec3 uColor; varying float vA; void main(){ gl_FragColor = vec4(uColor, vA); }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.userData.noShadow = true;
    scene.add(mesh);
    const hist = [];
    const tr = { object3d, offset, width, n, hist, mesh, active: true, primed: false };
    trails.push(tr);
    return {
      setActive(on) {
        tr.active = !!on;
      },
      dispose() {
        const i = trails.indexOf(tr);
        if (i >= 0) trails.splice(i, 1);
        scene.remove(mesh);
        geo.dispose();
        mat.dispose();
      },
    };
  }

  const wp = new THREE.Vector3();
  const side = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  function stepTrail(tr, dt) {
    void dt;
    tr.object3d.updateWorldMatrix(true, false);
    wp.copy(tr.offset || new THREE.Vector3()).applyMatrix4(tr.object3d.matrixWorld);
    if (!tr.primed) {
      for (let i = 0; i < tr.n; i += 1) tr.hist.push(wp.clone());
      tr.primed = true;
    }
    tr.hist.unshift(tr.active ? wp.clone() : tr.hist[0].clone());
    tr.hist.length = tr.n;
    const P = tr.mesh.geometry.attributes.position.array;
    const A = tr.mesh.geometry.attributes.aAlpha.array;
    if (camera) camera.getWorldDirection(camDir);
    else camDir.set(0, -1, 0);
    for (let i = 0; i < tr.n; i += 1) {
      const a = tr.hist[i];
      const b = tr.hist[Math.min(tr.n - 1, i + 1)];
      side.subVectors(a, b).cross(camDir).normalize();
      if (!Number.isFinite(side.x) || side.lengthSq() < 1e-6) side.set(1, 0, 0);
      const k = 1 - i / (tr.n - 1);
      const w = tr.width * k * 0.5;
      P.set([a.x + side.x * w, a.y + side.y * w, a.z + side.z * w, a.x - side.x * w, a.y - side.y * w, a.z - side.z * w], i * 6);
      const moving = a.distanceToSquared(b) > 1e-6 ? 1 : 0;
      A[i * 2] = A[i * 2 + 1] = k * 0.9 * moving;
    }
    tr.mesh.geometry.attributes.position.needsUpdate = true;
    tr.mesh.geometry.attributes.aAlpha.needsUpdate = true;
  }

  // Speed lines: camera-space streaks for boosts / dashes
  let speedLines = null;
  let speedAmt = 0;
  function speed(amount = 1) {
    speedAmt = Math.max(0, Math.min(1, amount));
    if (!camera || speedLines) return;
    const n = 60;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 2 * 3);
    for (let i = 0; i < n; i += 1) {
      const th = Math.random() * Math.PI * 2;
      const r = 1.2 + Math.random() * 1.6;
      const z = -2 - Math.random() * 6;
      const x = Math.cos(th) * r;
      const y = Math.sin(th) * r;
      pos.set([x, y, z, x * 1.15, y * 1.15, z + 1.8], i * 6);
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    speedLines = new THREE.LineSegments(geo, mat);
    speedLines.frustumCulled = false;
    speedLines.renderOrder = 10;
    camera.add(speedLines);
    if (!camera.parent) scene.add(camera);
  }

  function update(dt) {
    stepPool(glowPool, dt);
    stepPool(solidPool, dt);
    // world-size → pixels: h / (2 tan(fov/2)); dpr because gl_PointSize is in device pixels
    const h = ((typeof window !== "undefined" && window.innerHeight) || 800) * Math.min(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
    const fov = camera?.isPerspectiveCamera ? camera.fov : 60;
    const k = h / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2));
    glowPool.points.material.uniforms.uScale.value = k;
    solidPool.points.material.uniforms.uScale.value = k;
    for (let i = rings.length - 1; i >= 0; i -= 1) {
      const r = rings[i];
      r.t += dt;
      const k = Math.min(1, r.t / r.life);
      const e = 1 - Math.pow(1 - k, 3);
      r.mesh.scale.setScalar(Math.max(0.01, e * r.radius));
      r.mesh.material.opacity = 1 - k;
      if (k >= 1) {
        scene.remove(r.mesh);
        r.mesh.geometry.dispose();
        r.mesh.material.dispose();
        rings.splice(i, 1);
      }
    }
    for (const tr of trails) stepTrail(tr, dt);
    if (speedLines) {
      const m = speedLines.material;
      m.opacity += (speedAmt * 0.55 - m.opacity) * Math.min(1, dt * 8);
      speedLines.rotation.z += dt * 0.5;
      speedLines.visible = m.opacity > 0.01;
    }
  }

  function clear() {
    glowPool.count = 0;
    solidPool.count = 0;
  }

  function dispose() {
    for (const pool of [glowPool, solidPool]) {
      scene.remove(pool.points);
      pool.points.geometry.dispose();
      pool.points.material.dispose();
    }
    for (const r of rings) {
      scene.remove(r.mesh);
      r.mesh.geometry.dispose();
      r.mesh.material.dispose();
    }
    rings.length = 0;
    for (const tr of [...trails]) {
      scene.remove(tr.mesh);
      tr.mesh.geometry.dispose();
      tr.mesh.material.dispose();
    }
    trails.length = 0;
    if (speedLines) {
      speedLines.parent?.remove(speedLines);
      speedLines.geometry.dispose();
      speedLines.material.dispose();
      speedLines = null;
    }
  }

  return { burst, sparks, dust, confetti, smoke, pickup, explosion, ring, trail, speed, update, clear, dispose };
}
