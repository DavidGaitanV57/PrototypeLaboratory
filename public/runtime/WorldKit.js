/**
 * WorldKit — set dressing from primitives: trees, rocks, bushes, clouds, backdrop mountains, animated water, wind grass, seeded scatter.
 * Makes a level read as a place instead of a test plane.
 */
import * as THREE from "/vendor/three/build/three.module.js";

/** Deterministic RNG (mulberry32). */
export function seededRandom(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const std = (color, opts = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: opts.roughness ?? 0.85, metalness: 0, flatShading: opts.flat ?? true });

function shadowAll(g) {
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  return g;
}

/** style: "round" | "pine" | "palm" | "dead" */
export function makeTree({ style = "round", color = 0x4caf50, trunk = 0x7a5230, scale = 1, seed } = {}) {
  const rnd = seededRandom(seed ?? (Math.random() * 1e9) | 0);
  const g = new THREE.Group();
  g.name = "Tree";
  const tMat = std(trunk);
  const lMat = std(color);
  if (style === "pine") {
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 1.2, 7), tMat);
    tr.position.y = 0.6;
    g.add(tr);
    for (let i = 0; i < 3; i += 1) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(1.3 - i * 0.3, 1.6, 8), lMat);
      c.position.y = 1.4 + i * 0.85;
      c.rotation.y = rnd() * Math.PI;
      g.add(c);
    }
  } else if (style === "palm") {
    const segs = 6;
    let y = 0;
    let x = 0;
    for (let i = 0; i < segs; i += 1) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.6, 7), tMat);
      x += 0.08;
      s.position.set(x, y + 0.3, 0);
      s.rotation.z = -0.12;
      g.add(s);
      y += 0.55;
    }
    for (let i = 0; i < 6; i += 1) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.8, 4), lMat);
      const a = (i / 6) * Math.PI * 2;
      leaf.position.set(x + Math.cos(a) * 0.7, y + 0.1, Math.sin(a) * 0.7);
      leaf.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2);
      g.add(leaf);
    }
  } else if (style === "dead") {
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 2.2, 6), tMat);
    tr.position.y = 1.1;
    g.add(tr);
    for (let i = 0; i < 4; i += 1) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.07, 0.9, 5), tMat);
      b.position.set(0, 1.2 + i * 0.3, 0);
      b.rotation.set(rnd() - 0.5, rnd() * 6, 0.9 + rnd() * 0.4);
      b.translateY(0.4);
      g.add(b);
    }
  } else {
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.4, 7), tMat);
    tr.position.y = 0.7;
    g.add(tr);
    const n = 3 + ((rnd() * 3) | 0);
    for (let i = 0; i < n; i += 1) {
      const r = 0.65 + rnd() * 0.45;
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), lMat);
      b.position.set((rnd() - 0.5) * 1.1, 1.7 + rnd() * 0.8, (rnd() - 0.5) * 1.1);
      g.add(b);
    }
  }
  g.scale.setScalar(scale * (0.85 + rnd() * 0.3));
  g.rotation.y = rnd() * Math.PI * 2;
  return shadowAll(g);
}

export function makeRock({ size = 1, color = 0x8a8f96, seed } = {}) {
  const rnd = seededRandom(seed ?? (Math.random() * 1e9) | 0);
  const geo = new THREE.IcosahedronGeometry(size, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i += 1) {
    const k = 0.75 + rnd() * 0.45;
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.7, p.getZ(i) * k);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, std(color));
  m.name = "Rock";
  m.position.y = size * 0.25;
  m.rotation.y = rnd() * Math.PI * 2;
  m.castShadow = m.receiveShadow = true;
  return m;
}

export function makeBush({ color = 0x3f8f45, size = 0.8, seed } = {}) {
  const rnd = seededRandom(seed ?? (Math.random() * 1e9) | 0);
  const g = new THREE.Group();
  g.name = "Bush";
  const m = std(color);
  for (let i = 0; i < 4; i += 1) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(size * (0.5 + rnd() * 0.4), 1), m);
    b.position.set((rnd() - 0.5) * size, size * 0.35, (rnd() - 0.5) * size);
    g.add(b);
  }
  return shadowAll(g);
}

export function makeCloud({ scale = 1, color = 0xffffff, seed } = {}) {
  const rnd = seededRandom(seed ?? (Math.random() * 1e9) | 0);
  const g = new THREE.Group();
  g.name = "Cloud";
  const m = new THREE.MeshStandardMaterial({ color, roughness: 1, emissive: color, emissiveIntensity: 0.25, flatShading: true });
  const n = 5 + ((rnd() * 4) | 0);
  for (let i = 0; i < n; i += 1) {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(1 + rnd() * 1.2, 1), m);
    s.position.set((i - n / 2) * 1.2 + rnd(), rnd() * 0.8, (rnd() - 0.5) * 1.5);
    s.scale.y = 0.7;
    g.add(s);
  }
  g.scale.setScalar(scale);
  g.traverse((o) => {
    if (o.isMesh) o.userData.noShadow = true;
  });
  return g;
}

/** Ring of low-poly mountains on the horizon (fog tints them into depth). */
export function makeBackdrop({ radius = 140, count = 28, color = 0x5a6f86, height = [18, 45], snow = true, seed = 7 } = {}) {
  const rnd = seededRandom(seed);
  const g = new THREE.Group();
  g.name = "Backdrop";
  const m = std(color, { roughness: 1 });
  const cap = std(0xf2f5f8, { roughness: 1 });
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2 + rnd() * 0.2;
    const h = height[0] + rnd() * (height[1] - height[0]);
    const r = h * (0.9 + rnd() * 0.6);
    const mtn = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5 + ((rnd() * 3) | 0)), m);
    const d = radius * (0.9 + rnd() * 0.2);
    mtn.position.set(Math.cos(a) * d, h / 2 - 2, Math.sin(a) * d);
    mtn.rotation.y = rnd() * Math.PI;
    g.add(mtn);
    if (snow && h > (height[0] + height[1]) / 2) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(r * 0.3, h * 0.3, mtn.geometry.parameters.radialSegments), cap);
      c.position.copy(mtn.position);
      c.position.y = h - 2 - h * 0.15;
      c.rotation.y = mtn.rotation.y;
      g.add(c);
    }
  }
  g.traverse((o) => {
    if (o.isMesh) o.userData.noShadow = true;
  });
  return g;
}

/** Animated stylized water plane. Returns { mesh, update(dt) }. */
export function makeWater({ size = 200, color = 0x1d7fb8, deep = 0x0a3552, foam = 0xdff6ff, opacity = 0.9 } = {}) {
  const geo = new THREE.PlaneGeometry(size, size, 96, 96);
  geo.rotateX(-Math.PI / 2);
  const uniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(color) },
    uDeep: { value: new THREE.Color(deep) },
    uFoam: { value: new THREE.Color(foam) },
    uOpacity: { value: opacity },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, uniforms]),
    transparent: opacity < 1,
    fog: true,
    vertexShader: `
      uniform float uTime; varying float vH; varying vec3 vW; varying vec3 vN;
      #include <fog_pars_vertex>
      void main(){
        vec3 p = position;
        float h = sin(p.x*0.35 + uTime*1.3)*0.18 + sin(p.z*0.28 + uTime*1.1)*0.16 + sin((p.x+p.z)*0.9 + uTime*2.2)*0.05;
        p.y += h; vH = h;
        float dx = cos(p.x*0.35 + uTime*1.3)*0.35*0.18 + cos((p.x+p.z)*0.9+uTime*2.2)*0.9*0.05;
        float dz = cos(p.z*0.28 + uTime*1.1)*0.28*0.16 + cos((p.x+p.z)*0.9+uTime*2.2)*0.9*0.05;
        vN = normalize(vec3(-dx, 1.0, -dz));
        vec4 wp = modelMatrix * vec4(p,1.0); vW = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform vec3 uDeep; uniform vec3 uFoam; uniform float uOpacity; uniform float uTime;
      varying float vH; varying vec3 vW; varying vec3 vN;
      #include <fog_pars_fragment>
      void main(){
        vec3 V = normalize(cameraPosition - vW);
        float fres = pow(1.0 - max(dot(V, vN), 0.0), 3.0);
        vec3 c = mix(uDeep, uColor, smoothstep(-0.3, 0.3, vH));
        c = mix(c, vec3(0.85,0.95,1.0), fres*0.6);
        float f = smoothstep(0.26, 0.34, vH + sin(vW.x*3.0+uTime)*0.02);
        c = mix(c, uFoam, f*0.7);
        vec3 L = normalize(vec3(0.4,0.8,0.3));
        c += pow(max(dot(reflect(-L, vN), V), 0.0), 60.0) * 0.8;
        gl_FragColor = vec4(c, uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  // UniformsUtils.merge clones values; keep live refs
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "Water";
  mesh.userData.noShadow = true;
  mesh.receiveShadow = false;
  return {
    mesh,
    update(dt) {
      mat.uniforms.uTime.value += dt;
    },
  };
}

/** Instanced wind-swayed grass tufts. Returns { mesh, update(dt) }. */
export function makeGrass({ area = 60, count = 4000, color = 0x5fae4a, tip = 0xb8e07a, height = 0.55, avoid = null, seed = 3 } = {}) {
  const rnd = seededRandom(seed);
  const blade = new THREE.ConeGeometry(0.06, height, 3, 1, true);
  blade.translate(0, height / 2, 0);
  const colors = new Float32Array(blade.attributes.position.count * 3);
  const c0 = new THREE.Color(color);
  const c1 = new THREE.Color(tip);
  for (let i = 0; i < blade.attributes.position.count; i += 1) {
    const k = blade.attributes.position.getY(i) / height;
    const c = c0.clone().lerp(c1, k);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  blade.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
  const time = { value: 0 };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vec4 ip = instanceMatrix * vec4(0.0,0.0,0.0,1.0);
        float sway = sin(uTime*2.0 + ip.x*0.35 + ip.z*0.27) * 0.12 + sin(uTime*3.7 + ip.x) * 0.04;
        transformed.x += sway * transformed.y;
        transformed.z += sway * 0.6 * transformed.y;`,
      );
  };
  const mesh = new THREE.InstancedMesh(blade, mat, count);
  mesh.name = "Grass";
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const pp = new THREE.Vector3();
  let placed = 0;
  for (let i = 0; i < count * 3 && placed < count; i += 1) {
    const x = (rnd() - 0.5) * area;
    const z = (rnd() - 0.5) * area;
    if (avoid && avoid(x, z)) continue;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI);
    const k = 0.6 + rnd() * 0.8;
    s.set(k, k, k);
    pp.set(x, 0, z);
    m4.compose(pp, q, s);
    mesh.setMatrixAt(placed, m4);
    placed += 1;
  }
  mesh.count = placed;
  mesh.receiveShadow = true;
  mesh.userData.noShadow = true;
  return {
    mesh,
    update(dt) {
      time.value += dt;
    },
  };
}

/**
 * Place clones of factory() around an area. avoid(x, z) → true skips a spot (keep tracks/paths clear).
 * area: number (square side) or { minX, maxX, minZ, maxZ } or { radius, inner }.
 */
export function scatter(parent, factory, { count = 30, area = 80, avoid = null, seed = 11, scale = [0.8, 1.3], y = 0 } = {}) {
  const rnd = seededRandom(seed);
  const g = new THREE.Group();
  g.name = "Scatter";
  let placed = 0;
  for (let i = 0; i < count * 6 && placed < count; i += 1) {
    let x;
    let z;
    if (typeof area === "number") {
      x = (rnd() - 0.5) * area;
      z = (rnd() - 0.5) * area;
    } else if (area.radius) {
      const a = rnd() * Math.PI * 2;
      const r = (area.inner || 0) + rnd() * (area.radius - (area.inner || 0));
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
    } else {
      x = area.minX + rnd() * (area.maxX - area.minX);
      z = area.minZ + rnd() * (area.maxZ - area.minZ);
    }
    if (avoid && avoid(x, z)) continue;
    const o = factory(rnd, placed);
    o.position.x += x;
    o.position.z += z;
    o.position.y += y;
    o.rotation.y += rnd() * Math.PI * 2;
    o.scale.multiplyScalar(scale[0] + rnd() * (scale[1] - scale[0]));
    g.add(o);
    placed += 1;
  }
  parent.add(g);
  return g;
}
