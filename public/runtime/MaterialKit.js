/**
 * MaterialKit — stylized, toon, glow and metal materials, procedural canvas textures (checker, stripes, noise, tiles, bricks, carpet), inverted-hull outlines.
 * Everything is generated in code — no image files or URLs.
 */
import * as THREE from "/vendor/three/build/three.module.js";

/** Physically-lit matte/satin surface — reacts to LookKit environment light. */
export function stylized(color = 0xcccccc, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.72,
    metalness: opts.metalness ?? 0,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    map: opts.map || null,
    flatShading: !!opts.flat,
    transparent: !!opts.transparent,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
  });
}

let toonRamps = new Map();
function toonRamp(steps) {
  if (toonRamps.has(steps)) return toonRamps.get(steps);
  const data = new Uint8Array(steps * 4);
  for (let i = 0; i < steps; i += 1) {
    const v = Math.round((0.35 + 0.65 * (i / Math.max(1, steps - 1))) * 255);
    data.set([v, v, v, 255], i * 4);
  }
  const tex = new THREE.DataTexture(data, steps, 1, THREE.RGBAFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  toonRamps.set(steps, tex);
  return tex;
}

/** Cel-shaded material (hard light bands). Pair with addOutline for a cartoon look. */
export function toon(color = 0xcccccc, opts = {}) {
  return new THREE.MeshToonMaterial({
    color,
    gradientMap: toonRamp(opts.steps ?? 3),
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    map: opts.map || null,
  });
}

/** Unlit HDR color — anything brighter than ~1 blooms under LookKit. Neon strips, lamps, pickups, eyes. */
export function glow(color = 0xffffff, intensity = 2.5) {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) });
  m.userData.glow = true;
  return m;
}

export function metal(color = 0xb8bcc4, roughness = 0.28) {
  return new THREE.MeshStandardMaterial({ color, metalness: 1, roughness });
}

export function glass(color = 0xbfe8ff, opacity = 0.35) {
  return new THREE.MeshStandardMaterial({ color, metalness: 0.1, roughness: 0.05, transparent: true, opacity, depthWrite: false });
}

/** Material set from a palette map: `paletteMaterials({ hero: 0xff5a36, wall: 0x2e3a48 }, { kind: "toon" })`. */
export function paletteMaterials(palette = {}, opts = {}) {
  const out = {};
  for (const [k, hex] of Object.entries(palette)) {
    out[k] = opts.kind === "toon" ? toon(hex, opts) : stylized(hex, opts);
  }
  return out;
}

// ── Procedural textures ────────────────────────────────────

function canvasTex(size, draw, repeat = [1, 1]) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  draw(g, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.repeat.set(repeat[0], repeat[1]);
  return tex;
}

const css = (hex) => `#${new THREE.Color(hex).getHexString()}`;

function mottle(g, size, amount = 0.08, count = 600, base = 0x808080) {
  const b = new THREE.Color(base);
  for (let i = 0; i < count; i += 1) {
    g.globalAlpha = 0.15;
    g.fillStyle = css(b.clone().offsetHSL(0, 0, (Math.random() - 0.5) * amount * 2).getHex());
    g.beginPath();
    g.arc(Math.random() * size, Math.random() * size, 1 + Math.random() * (size / 24), 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

export function checkerTexture({ a = 0xf2f2f2, b = 0x1c1c1c, cells = 8, repeat } = {}) {
  return canvasTex(256, (g, s) => {
    const cs = s / cells;
    for (let y = 0; y < cells; y += 1) {
      for (let x = 0; x < cells; x += 1) {
        g.fillStyle = css((x + y) % 2 ? a : b);
        g.fillRect(x * cs, y * cs, cs, cs);
      }
    }
  }, repeat);
}

export function stripesTexture({ a = 0xe53935, b = 0xf5f5f5, count = 8, vertical = false, repeat } = {}) {
  return canvasTex(256, (g, s) => {
    const w = s / count;
    for (let i = 0; i < count; i += 1) {
      g.fillStyle = css(i % 2 ? a : b);
      if (vertical) g.fillRect(i * w, 0, w, s);
      else g.fillRect(0, i * w, s, w);
    }
  }, repeat);
}

export function noiseTexture({ base = 0x7a7a7a, variation = 0.12, repeat } = {}) {
  return canvasTex(256, (g, s) => {
    g.fillStyle = css(base);
    g.fillRect(0, 0, s, s);
    mottle(g, s, variation, 1400, base);
  }, repeat);
}

export function tilesTexture({ tile = 0xd8d2b8, grout = 0x8a8470, cells = 4, gap = 0.06, repeat } = {}) {
  return canvasTex(256, (g, s) => {
    g.fillStyle = css(grout);
    g.fillRect(0, 0, s, s);
    const cs = s / cells;
    const gp = cs * gap;
    const t = new THREE.Color(tile);
    for (let y = 0; y < cells; y += 1) {
      for (let x = 0; x < cells; x += 1) {
        g.fillStyle = css(t.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.05).getHex());
        g.fillRect(x * cs + gp, y * cs + gp, cs - gp * 2, cs - gp * 2);
      }
    }
  }, repeat);
}

export function bricksTexture({ brick = 0x9a4a36, mortar = 0xcfc4b4, rows = 8, repeat } = {}) {
  return canvasTex(256, (g, s) => {
    g.fillStyle = css(mortar);
    g.fillRect(0, 0, s, s);
    const rh = s / rows;
    const bw = rh * 2;
    const b = new THREE.Color(brick);
    for (let r = 0; r < rows; r += 1) {
      const off = r % 2 ? bw / 2 : 0;
      for (let x = -bw; x < s + bw; x += bw) {
        g.fillStyle = css(b.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.1).getHex());
        g.fillRect(x + off + 2, r * rh + 2, bw - 4, rh - 4);
      }
    }
  }, repeat);
}

export function carpetTexture({ base = 0xa89060, repeat } = {}) {
  return canvasTex(256, (g, s) => {
    g.fillStyle = css(base);
    g.fillRect(0, 0, s, s);
    const b = new THREE.Color(base);
    for (let i = 0; i < 9000; i += 1) {
      g.fillStyle = css(b.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.14).getHex());
      g.fillRect(Math.random() * s, Math.random() * s, 1.5, 1.5);
    }
  }, repeat);
}

export function gradientTexture({ top = 0xffffff, bottom = 0x000000 } = {}) {
  return canvasTex(64, (g, s) => {
    const gr = g.createLinearGradient(0, 0, 0, s);
    gr.addColorStop(0, css(top));
    gr.addColorStop(1, css(bottom));
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
  });
}

/** Stylized material with a procedural map. `textured(checkerTexture(), { repeat: [4, 4] })` */
export function textured(texture, opts = {}) {
  const map = texture.clone();
  map.needsUpdate = true;
  if (opts.repeat) map.repeat.set(opts.repeat[0], opts.repeat[1]);
  return stylized(opts.color ?? 0xffffff, { ...opts, map });
}

// ── Outline (inverted hull) ───────────────────────────────

const OUTLINE_VERT = `
uniform float thickness;
void main() {
  vec3 p = position + normal * thickness;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const OUTLINE_FRAG = `
uniform vec3 color;
void main() { gl_FragColor = vec4(color, 1.0); }`;

/**
 * Cartoon outline on every mesh under object3d (shares geometry). Returns { setColor, setThickness, dispose }.
 */
export function addOutline(object3d, { color = 0x101014, thickness = 0.035 } = {}) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, thickness: { value: thickness } },
    vertexShader: OUTLINE_VERT,
    fragmentShader: OUTLINE_FRAG,
    side: THREE.BackSide,
  });
  const hulls = [];
  const meshes = [];
  object3d.traverse((o) => {
    if (o.isMesh && !o.userData.isOutline && o.geometry?.attributes?.normal) meshes.push(o);
  });
  for (const m of meshes) {
    const hull = new THREE.Mesh(m.geometry, mat);
    hull.userData.isOutline = true;
    hull.userData.noShadow = true;
    hull.raycast = () => {};
    m.add(hull);
    hulls.push(hull);
  }
  return {
    setColor(hex) {
      mat.uniforms.color.value.setHex(hex);
    },
    setThickness(t) {
      mat.uniforms.thickness.value = t;
    },
    dispose() {
      for (const h of hulls) h.parent?.remove(h);
      mat.dispose();
    },
  };
}
