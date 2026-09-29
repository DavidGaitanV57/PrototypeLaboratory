/**
 * Scene kit: procedural sky, lights, fog, ground, day/night. Grid + scale blocks only with `{ editor: true }`.
 * Pair with LookKit (`installLook(engine, { preset })`) for tone mapping, shadows and post.
 */
import * as THREE from "/vendor/three/build/three.module.js";

export const SKY_STORAGE_KEY = "plab.skyMode";

export const SKY_PRESETS = {
  day: {
    top: 0x87b8e0,
    horizon: 0xdce8f0,
    bottom: 0xb0b8a8,
    hemiSky: 0xf0f4fa,
    hemiGround: 0x8a9080,
    hemiIntensity: 1.1,
    dirColor: 0xfff0d8,
    dirIntensity: 1.2,
    fog: 0xb8c4d0,
    fogDensity: 0.012,
  },
  night: {
    top: 0x1b2a48,
    horizon: 0x6a7d9a,
    bottom: 0x2a3038,
    hemiSky: 0xb0bccf,
    hemiGround: 0x22262c,
    hemiIntensity: 1.0,
    dirColor: 0xb8c6dc,
    dirIntensity: 0.65,
    fog: 0x1b2a48,
    fogDensity: 0.018,
  },
};

export function readSkyMode() {
  return readStoredSkyMode() ?? "day";
}

/** @returns {"day" | "night" | null} */
export function readStoredSkyMode() {
  try {
    const v = localStorage.getItem(SKY_STORAGE_KEY);
    if (v === "day" || v === "night") return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function writeSkyMode(mode) {
  try {
    localStorage.setItem(SKY_STORAGE_KEY, mode === "night" ? "night" : "day");
  } catch {
    /* ignore */
  }
}

/** Active kit for lab chrome (day/night) — survives regardless of mount() return shape. */
let activeKit = null;

export function getActiveSceneKit() {
  return activeKit;
}

function makeSkyDome(THREE, preset) {
  const geo = new THREE.SphereGeometry(180, 32, 16);
  const colTop = new THREE.Color(preset.top);
  const colHor = new THREE.Color(preset.horizon);
  const colBot = new THREE.Color(preset.bottom);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: colTop },
      horizon: { value: colHor },
      bottom: { value: colBot },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = normalize(w.xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 top;
      uniform vec3 horizon;
      uniform vec3 bottom;
      varying vec3 vWorld;
      void main() {
        float h = vWorld.y * 0.5 + 0.5;
        vec3 col = mix(bottom, horizon, smoothstep(0.0, 0.45, h));
        col = mix(col, top, smoothstep(0.45, 1.0, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "SkyDome";
  mesh.frustumCulled = false;
  return mesh;
}

function makeGroundTexture(THREE, color) {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const base = new THREE.Color(color);
  g.fillStyle = `#${base.getHexString()}`;
  g.fillRect(0, 0, size, size);
  // Soft mottling so large floors never read as flat debug planes
  for (let i = 0; i < 900; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 2 + Math.random() * 14;
    const k = (Math.random() - 0.5) * 0.12;
    const col = base.clone().offsetHSL(0, 0, k);
    g.globalAlpha = 0.18;
    g.fillStyle = `#${col.getHexString()}`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Install sky, lights, fog and ground into scene.
 * opts: { mode, editor (grid + scale blocks), grid, seedBlocks, ground (false to skip), groundColor, groundSize }
 * @returns {{ setMode(mode:"day"|"night"): void, getMode(): "day"|"night", dispose(): void }}
 */
export function installSceneKit(scene, opts = {}) {
  // Prefer persisted day/night over caller default so the lab toggle sticks across remounts.
  const mode0 = readStoredSkyMode() ?? (opts.mode === "night" ? "night" : opts.mode === "day" ? "day" : "day");
  let mode = mode0 === "night" ? "night" : "day";
  let preset = SKY_PRESETS[mode];

  const sky = makeSkyDome(THREE, preset);
  scene.add(sky);

  const hemi = new THREE.HemisphereLight(preset.hemiSky, preset.hemiGround, preset.hemiIntensity);
  hemi.position.set(0, 20, 0);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(preset.dirColor, preset.dirIntensity);
  dir.position.set(12, 24, 8);
  scene.add(dir);

  scene.fog = new THREE.FogExp2(preset.fog, preset.fogDensity);
  scene.background = new THREE.Color(preset.top);

  const editor = opts.editor === true;
  const grid = new THREE.GridHelper(40, 40, 0x5a6a7a, 0x2e3a48);
  grid.position.y = 0.01;
  if (opts.grid ?? editor) scene.add(grid);

  const groundSize = opts.groundSize ?? (editor ? 40 : 240);
  const groundColor = opts.groundColor ?? 0x6e7570;
  const groundTex = editor ? null : makeGroundTexture(THREE, groundColor);
  if (groundTex) groundTex.repeat.set(groundSize / 12, groundSize / 12);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(groundSize, groundSize),
    new THREE.MeshStandardMaterial({ color: groundTex ? 0xffffff : groundColor, map: groundTex, roughness: 0.95, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = "GrayboxGround";
  if (opts.ground !== false) scene.add(ground);

  // Sample graybox blocks for scale reference (can be cleared by gameplay)
  const blocks = new THREE.Group();
  blocks.name = "GrayboxBlocks";
  const blockMat = new THREE.MeshLambertMaterial({ color: 0x8a9098 });
  const sizes = [
    [2, 1, 2, -8, 0.5, -6],
    [3, 2, 1.5, 7, 1, -4],
    [1.5, 3, 1.5, -4, 1.5, 8],
  ];
  for (const [w, h, d, x, y, z] of sizes) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), blockMat);
    m.position.set(x, y, z);
    blocks.add(m);
  }
  if (opts.seedBlocks ?? editor) scene.add(blocks);

  function applyPreset(p) {
    sky.material.uniforms.top.value.setHex(p.top);
    sky.material.uniforms.horizon.value.setHex(p.horizon);
    sky.material.uniforms.bottom.value.setHex(p.bottom);
    hemi.color.setHex(p.hemiSky);
    hemi.groundColor.setHex(p.hemiGround);
    hemi.intensity = p.hemiIntensity;
    dir.color.setHex(p.dirColor);
    dir.intensity = p.dirIntensity;
    if (scene.fog) {
      scene.fog.color.setHex(p.fog);
      scene.fog.density = p.fogDensity;
    }
    scene.background.setHex(p.top);
  }

  function setMode(next) {
    mode = next === "night" ? "night" : "day";
    preset = SKY_PRESETS[mode];
    applyPreset(preset);
    writeSkyMode(mode);
    window.dispatchEvent(new CustomEvent("plab:sky", { detail: { mode } }));
  }

  function dispose() {
    if (activeKit === api) activeKit = null;
    scene.remove(sky, hemi, dir, grid, ground, blocks);
    sky.geometry.dispose();
    sky.material.dispose();
    ground.geometry.dispose();
    ground.material.dispose();
    groundTex?.dispose();
    grid.geometry?.dispose?.();
    blocks.traverse((c) => {
      c.geometry?.dispose?.();
      c.material?.dispose?.();
    });
  }

  const api = { setMode, getMode: () => mode, dispose, root: { sky, hemi, dir, grid, ground, blocks } };
  activeKit = api;
  return api;
}

/** Toggle and return new mode */
export function toggleSkyMode(sceneKit) {
  const next = sceneKit.getMode() === "day" ? "night" : "day";
  sceneKit.setMode(next);
  return next;
}
