/**
 * LookKit — presets sunny|candy|dusk|night|neon|liminal|noir|underwater|studio. Tone mapping, soft shadows, IBL, bloom, grade, vignette, grain, auto quality.
 *
 * One call after SceneKit: `const look = installLook(engine, { preset: "sunny" })`.
 * Core Three.js only (no addons) so exports bundle cleanly.
 */
import * as THREE from "/vendor/three/build/three.module.js";
import { getActiveSceneKit } from "/runtime/SceneKit.js";

/** Mood presets. Colors are hex; numbers are linear-ish artist values. */
export const LOOK_PRESETS = {
  sunny: {
    sky: { top: 0x3f8fe0, horizon: 0xcfe6f7, bottom: 0x9fb8a0 },
    sun: { color: 0xfff1d6, intensity: 3.2, elevation: 48, azimuth: 35, disc: true },
    hemi: { sky: 0xcfe6ff, ground: 0x6d7a55, intensity: 0.9 },
    fog: { color: 0xc6ddef, density: 0.006 },
    env: 0.55, exposure: 1.0, tonemap: "aces",
    bloom: { strength: 0.22, threshold: 0.9, radius: 0.7 },
    grade: { contrast: 1.06, saturation: 1.18, temperature: 0.06, tint: 0xffffff, lift: 0x000000 },
    vignette: 0.22, grain: 0.02, chroma: 0,
  },
  candy: {
    sky: { top: 0x7ec8ff, horizon: 0xffd6f0, bottom: 0xffe9c7 },
    sun: { color: 0xfff5e6, intensity: 2.8, elevation: 55, azimuth: 20, disc: true },
    hemi: { sky: 0xffe6fb, ground: 0x9a7fd1, intensity: 1.1 },
    fog: { color: 0xf5dcf5, density: 0.007 },
    env: 0.7, exposure: 1.05, tonemap: "aces",
    bloom: { strength: 0.3, threshold: 0.85, radius: 0.8 },
    grade: { contrast: 1.02, saturation: 1.3, temperature: 0.02, tint: 0xfff4fb, lift: 0x0a0010 },
    vignette: 0.15, grain: 0.01, chroma: 0,
  },
  dusk: {
    sky: { top: 0x2b2d6e, horizon: 0xff8a4c, bottom: 0x4a2c3a },
    sun: { color: 0xffa86b, intensity: 2.6, elevation: 9, azimuth: -60, disc: true },
    hemi: { sky: 0x8a7bd1, ground: 0x3a2430, intensity: 0.7 },
    fog: { color: 0xc77a64, density: 0.012 },
    env: 0.45, exposure: 1.1, tonemap: "agx",
    bloom: { strength: 0.55, threshold: 0.75, radius: 0.85 },
    grade: { contrast: 1.12, saturation: 1.15, temperature: 0.18, tint: 0xffe4d6, lift: 0x100418 },
    vignette: 0.35, grain: 0.03, chroma: 0.0015,
  },
  night: {
    sky: { top: 0x050a1c, horizon: 0x1c2f55, bottom: 0x05070c },
    sun: { color: 0x9db8ff, intensity: 0.9, elevation: 40, azimuth: 120, disc: false },
    hemi: { sky: 0x3a4f80, ground: 0x0a0c12, intensity: 0.45 },
    fog: { color: 0x0b1428, density: 0.022 },
    env: 0.25, exposure: 1.2, tonemap: "agx",
    bloom: { strength: 0.9, threshold: 0.55, radius: 0.9 },
    grade: { contrast: 1.15, saturation: 1.05, temperature: -0.15, tint: 0xdde8ff, lift: 0x02040a },
    vignette: 0.45, grain: 0.025, chroma: 0.002,
  },
  neon: {
    sky: { top: 0x07031a, horizon: 0x3a0c5e, bottom: 0x02020a },
    sun: { color: 0xd8a8ff, intensity: 1.6, elevation: 50, azimuth: 30, disc: false },
    hemi: { sky: 0x7a3fd0, ground: 0x0a2a3a, intensity: 1.1 },
    fog: { color: 0x14062a, density: 0.02 },
    env: 0.45, exposure: 1.2, tonemap: "aces",
    bloom: { strength: 1.2, threshold: 0.5, radius: 0.95 },
    grade: { contrast: 1.18, saturation: 1.35, temperature: -0.05, tint: 0xf0e0ff, lift: 0x06000c },
    vignette: 0.4, grain: 0.015, chroma: 0.003,
  },
  liminal: {
    sky: { top: 0xb8a95a, horizon: 0xd8cc88, bottom: 0x7a6c38 },
    sun: { color: 0xfff2b0, intensity: 0.35, elevation: 80, azimuth: 0, disc: false, shadows: false },
    hemi: { sky: 0xfff0b0, ground: 0x6b5c30, intensity: 1.0 },
    fog: { color: 0xc4b87a, density: 0.035 },
    env: 0.5, exposure: 1.0, tonemap: "agx",
    bloom: { strength: 0.45, threshold: 0.8, radius: 0.9 },
    grade: { contrast: 0.95, saturation: 0.82, temperature: 0.12, tint: 0xfff6c8, lift: 0x0c0a00 },
    vignette: 0.5, grain: 0.05, chroma: 0.0025,
  },
  noir: {
    sky: { top: 0x1a1c20, horizon: 0x5c6068, bottom: 0x101114 },
    sun: { color: 0xf2f4ff, intensity: 2.4, elevation: 22, azimuth: 70, disc: false },
    hemi: { sky: 0x8a90a0, ground: 0x15161a, intensity: 0.35 },
    fog: { color: 0x2a2c32, density: 0.018 },
    env: 0.3, exposure: 1.05, tonemap: "aces",
    bloom: { strength: 0.35, threshold: 0.8, radius: 0.7 },
    grade: { contrast: 1.35, saturation: 0.15, temperature: -0.02, tint: 0xffffff, lift: 0x000000 },
    vignette: 0.55, grain: 0.06, chroma: 0,
  },
  underwater: {
    sky: { top: 0x0a4a6e, horizon: 0x0d6f84, bottom: 0x02131c },
    sun: { color: 0x9ff5ff, intensity: 1.4, elevation: 75, azimuth: 10, disc: false },
    hemi: { sky: 0x4fd6e6, ground: 0x04202a, intensity: 0.7 },
    fog: { color: 0x0b4d62, density: 0.045 },
    env: 0.4, exposure: 1.1, tonemap: "agx",
    bloom: { strength: 0.9, threshold: 0.6, radius: 0.95 },
    grade: { contrast: 1.08, saturation: 1.2, temperature: -0.22, tint: 0xd9fbff, lift: 0x000a0c },
    vignette: 0.45, grain: 0.03, chroma: 0.002,
  },
  studio: {
    sky: { top: 0x9aa4b0, horizon: 0xe4e8ec, bottom: 0x8a9098 },
    sun: { color: 0xffffff, intensity: 2.6, elevation: 50, azimuth: 40, disc: false },
    hemi: { sky: 0xffffff, ground: 0x707880, intensity: 0.8 },
    fog: { color: 0xd4d9de, density: 0.004 },
    env: 0.8, exposure: 1.0, tonemap: "neutral",
    bloom: { strength: 0.12, threshold: 0.95, radius: 0.6 },
    grade: { contrast: 1.05, saturation: 1.05, temperature: 0, tint: 0xffffff, lift: 0x000000 },
    vignette: 0.12, grain: 0.0, chroma: 0,
  },
};

const TONEMAP_ID = { none: 0, aces: 1, agx: 2, neutral: 3 };
const QUALITY = ["low", "medium", "high"];

function deepMerge(base, over) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(over || {})) {
    if (v && typeof v === "object" && !Array.isArray(v) && base?.[k] && typeof base[k] === "object") {
      out[k] = deepMerge(base[k], v);
    } else if (v !== undefined) out[k] = v;
  }
  return out;
}

function resolvePreset(name, overrides) {
  const base = LOOK_PRESETS[String(name || "sunny").toLowerCase()] || LOOK_PRESETS.sunny;
  return deepMerge(base, overrides || {});
}

/** Night variant for the lab day/night toggle when a day preset is active. */
function nightVariant(p) {
  const dark = (hex, f) => new THREE.Color(hex).multiplyScalar(f).getHex();
  return deepMerge(p, {
    sky: { top: dark(p.sky.top, 0.12), horizon: dark(p.sky.horizon, 0.25), bottom: dark(p.sky.bottom, 0.1) },
    sun: { intensity: p.sun.intensity * 0.3, color: 0xa8bcff, disc: false },
    hemi: { intensity: p.hemi.intensity * 0.45 },
    fog: { color: dark(p.fog.color, 0.18), density: p.fog.density * 1.6 },
    env: p.env * 0.4,
    bloom: { strength: Math.max(p.bloom.strength, 0.6), threshold: Math.min(p.bloom.threshold, 0.65) },
    grade: { temperature: p.grade.temperature - 0.2 },
    vignette: Math.max(p.vignette, 0.4),
  });
}

const FS_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const BRIGHT_FRAG = /* glsl */ `
uniform sampler2D tInput; uniform float threshold; uniform float knee;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tInput, vUv).rgb;
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - threshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 1e-4);
  float contrib = max(soft, br - threshold) / max(br, 1e-4);
  gl_FragColor = vec4(min(c * contrib, vec3(24.0)), 1.0);
}
`;

const DOWN_FRAG = /* glsl */ `
uniform sampler2D tInput; uniform vec2 texel;
varying vec2 vUv;
void main() {
  vec3 s = texture2D(tInput, vUv).rgb * 4.0;
  s += texture2D(tInput, vUv + vec2(-1.0, -1.0) * texel).rgb;
  s += texture2D(tInput, vUv + vec2( 1.0, -1.0) * texel).rgb;
  s += texture2D(tInput, vUv + vec2(-1.0,  1.0) * texel).rgb;
  s += texture2D(tInput, vUv + vec2( 1.0,  1.0) * texel).rgb;
  gl_FragColor = vec4(s / 8.0, 1.0);
}
`;

const UP_FRAG = /* glsl */ `
uniform sampler2D tLow; uniform sampler2D tHigh; uniform vec2 texel; uniform float radius;
varying vec2 vUv;
void main() {
  vec2 o = texel * radius;
  vec3 s = texture2D(tLow, vUv + vec2(-2.0, 0.0) * o).rgb;
  s += texture2D(tLow, vUv + vec2(2.0, 0.0) * o).rgb;
  s += texture2D(tLow, vUv + vec2(0.0, -2.0) * o).rgb;
  s += texture2D(tLow, vUv + vec2(0.0, 2.0) * o).rgb;
  s += texture2D(tLow, vUv + vec2(-1.0, -1.0) * o).rgb * 2.0;
  s += texture2D(tLow, vUv + vec2(1.0, -1.0) * o).rgb * 2.0;
  s += texture2D(tLow, vUv + vec2(-1.0, 1.0) * o).rgb * 2.0;
  s += texture2D(tLow, vUv + vec2(1.0, 1.0) * o).rgb * 2.0;
  gl_FragColor = vec4(texture2D(tHigh, vUv).rgb + s / 12.0, 1.0);
}
`;

const COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D tScene; uniform sampler2D tBloom;
uniform float bloomStrength; uniform float useBloom;
uniform float exposure; uniform float tonemap;
uniform float contrast; uniform float saturation; uniform float temperature;
uniform vec3 tint; uniform vec3 lift;
uniform float vignette; uniform float grain; uniform float chroma; uniform float time;
varying vec2 vUv;

vec3 acesFitted(vec3 x) {
  const float a = 2.51; const float b = 0.03; const float c = 2.43; const float d = 0.59; const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
vec3 agxContrast(vec3 x) {
  vec3 x2 = x * x; vec3 x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}
vec3 agx(vec3 v) {
  const mat3 m = mat3(0.842479062253094, 0.0423282422610123, 0.0423756549057051,
                      0.0784335999999992, 0.878468636469772, 0.0784336,
                      0.0792237451477643, 0.0791661274605434, 0.879142973793104);
  const mat3 mi = mat3(1.19687900512017, -0.0528968517574562, -0.0529716355144438,
                       -0.0980208811401368, 1.15190312990417, -0.0980434501171241,
                       -0.0990297440797205, -0.0989611768448433, 1.15107367264116);
  const float lo = -12.47393; const float hi = 4.026069;
  v = m * max(v, vec3(1e-10));
  v = clamp(log2(v), lo, hi);
  v = (v - lo) / (hi - lo);
  v = agxContrast(v);
  v = mi * v;
  return pow(max(v, vec3(0.0)), vec3(2.2));
}
vec3 neutral(vec3 c) {
  const float startC = 0.8 - 0.04; const float desat = 0.15;
  float x = min(c.r, min(c.g, c.b));
  float off = x < 0.08 ? x - 6.25 * x * x : 0.04;
  c -= off;
  float peak = max(c.r, max(c.g, c.b));
  if (peak < startC) return c;
  float d = 1.0 - startC;
  float np = 1.0 - d * d / (peak + d - startC);
  c *= np / peak;
  float g = 1.0 - 1.0 / (desat * (peak - np) + 1.0);
  return mix(c, vec3(np), g);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  vec2 uv = vUv;
  vec2 dc = uv - 0.5;
  vec3 col;
  if (chroma > 0.0) {
    vec2 off = dc * chroma * 2.0;
    col = vec3(texture2D(tScene, uv + off).r, texture2D(tScene, uv).g, texture2D(tScene, uv - off).b);
  } else {
    col = texture2D(tScene, uv).rgb;
  }
  if (useBloom > 0.5) col += texture2D(tBloom, uv).rgb * bloomStrength;

  // Grade (scene-linear, pre-tonemap)
  col *= exposure;
  col *= tint;
  col *= vec3(1.0 + temperature * 0.35, 1.0, 1.0 - temperature * 0.35);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = max(mix(vec3(l), col, saturation), vec3(0.0));
  col = 0.18 * pow(col / 0.18 + 1e-6, vec3(contrast));
  col += lift;

  if (tonemap > 2.5) col = neutral(col);
  else if (tonemap > 1.5) col = agx(col);
  else if (tonemap > 0.5) col = acesFitted(col);

  float r = length(dc * vec2(1.0, 0.85));
  col *= mix(1.0, smoothstep(0.85, 0.2, r), vignette);
  float n = hash(uv * 1000.0 + fract(time) * 37.0) - 0.5;
  float lp = clamp(dot(col, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
  col += n * grain * (0.15 + 0.85 * sqrt(lp)); // film grain lives in midtones, not in black
  col += (hash(uv * 733.0 + time) - 0.5) / 255.0;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  #include <colorspace_fragment>
}
`;

function makeSkyEnvScene(p) {
  const s = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(p.sky.top) },
      horizon: { value: new THREE.Color(p.sky.horizon) },
      bottom: { value: new THREE.Color(p.hemi.ground) },
    },
    vertexShader: `varying vec3 vW; void main(){ vW = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; varying vec3 vW;
      void main(){ float h = vW.y; vec3 c = h > 0.0 ? mix(horizon, top, smoothstep(0.0, 0.7, h)) : mix(horizon, bottom, smoothstep(0.0, 0.25, -h));
      gl_FragColor = vec4(c, 1.0); }`,
  });
  s.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), mat));
  const sunDir = sunDirection(p);
  const blob = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 16, 8),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(p.sun.color).multiplyScalar(6 + p.sun.intensity * 2) }),
  );
  blob.position.copy(sunDir).multiplyScalar(8);
  s.add(blob);
  // Soft fill panels = studio-like readable forms on primitives
  const panelMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(p.sky.horizon).multiplyScalar(1.6), side: THREE.DoubleSide });
  for (const [x, y, z] of [[-7, 3, 2], [6, 2, -5]]) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), panelMat);
    pl.position.set(x, y, z);
    pl.lookAt(0, 0, 0);
    s.add(pl);
  }
  return s;
}

function sunDirection(p) {
  const el = THREE.MathUtils.degToRad(p.sun.elevation ?? 45);
  const az = THREE.MathUtils.degToRad(p.sun.azimuth ?? 30);
  return new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
}

function readQualityParam() {
  try {
    const q = new URLSearchParams(window.location.search).get("quality");
    if (QUALITY.includes(q)) return q;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Install the look on an Engine (from createEngine). Idempotent per engine.
 * @param {object} engine createEngine() result
 * @param {object} [opts] { preset, quality:"auto"|"high"|"medium"|"low", shadows, shadowSize, autoShadows, ...presetOverrides }
 */
export function installLook(engine, opts = {}) {
  const { renderer, scene, camera } = engine;
  if (engine.__look) engine.__look.dispose();

  const {
    preset: presetName = "sunny",
    quality: qualityOpt = "auto",
    shadows = true,
    shadowSize = 40,
    autoShadows = true,
    ...overrides
  } = opts;

  let basePreset = resolvePreset(presetName, overrides);
  let presetId = String(presetName);
  let p = basePreset;
  let quality = readQualityParam() || (qualityOpt === "auto" ? "high" : qualityOpt);
  const autoQuality = !readQualityParam() && qualityOpt === "auto";

  // ── Renderer ──────────────────────────────────────────────
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = !!shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // ── Lights: reuse SceneKit's sun/hemi when present ────────
  const kit = getActiveSceneKit();
  const owned = [];
  let sun = kit?.root?.dir || null;
  let hemi = kit?.root?.hemi || null;
  if (!sun) {
    sun = new THREE.DirectionalLight(0xffffff, 1);
    scene.add(sun);
    owned.push(sun);
  }
  if (!hemi) {
    hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    scene.add(hemi);
    owned.push(hemi);
  }
  scene.add(sun.target);
  sun.castShadow = !!shadows;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  let followTarget = null;
  const followPos = new THREE.Vector3();

  function configureShadowCam() {
    const s = shadowSize;
    const cam = sun.shadow.camera;
    cam.left = -s; cam.right = s; cam.top = s; cam.bottom = -s;
    cam.near = 0.5; cam.far = 220;
    cam.updateProjectionMatrix();
    const size = quality === "high" ? 2048 : quality === "medium" ? 1024 : 512;
    if (sun.shadow.mapSize.x !== size) {
      sun.shadow.mapSize.set(size, size);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
  }
  configureShadowCam();

  // Own sky dome when SceneKit is absent
  let ownSky = null;
  if (!kit?.root?.sky) {
    ownSky = new THREE.Mesh(
      new THREE.SphereGeometry(180, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color() },
          horizon: { value: new THREE.Color() },
          bottom: { value: new THREE.Color() },
        },
        vertexShader: `varying vec3 vWorld; void main(){ vWorld = normalize((modelMatrix * vec4(position,1.0)).xyz); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
        fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; varying vec3 vWorld;
          void main(){ float h = vWorld.y * 0.5 + 0.5; vec3 c = mix(bottom, horizon, smoothstep(0.0, 0.5, h)); c = mix(c, top, smoothstep(0.5, 1.0, h)); gl_FragColor = vec4(c,1.0);} `,
      }),
    );
    ownSky.name = "SkyDome";
    ownSky.frustumCulled = false;
    scene.add(ownSky);
  }
  const skyMesh = kit?.root?.sky || ownSky;

  // Sun disc (HDR so bloom catches it)
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(7, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, transparent: true, depthWrite: false }),
  );
  sunDisc.name = "LookSunDisc";
  sunDisc.userData.noShadow = true;
  sunDisc.frustumCulled = false;
  scene.add(sunDisc);

  // ── Environment (PMREM from a generated sky scene) ────────
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null;
  function rebuildEnv() {
    const envScene = makeSkyEnvScene(p);
    envRT?.dispose();
    envRT = pmrem.fromScene(envScene, 0.035);
    scene.environment = envRT.texture;
    if ("environmentIntensity" in scene) scene.environmentIntensity = p.env;
    envScene.traverse((o) => {
      o.geometry?.dispose?.();
      o.material?.dispose?.();
    });
  }

  // ── Post chain ────────────────────────────────────────────
  const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const fsGeo = new THREE.PlaneGeometry(2, 2);
  const fsMesh = new THREE.Mesh(fsGeo);
  fsMesh.frustumCulled = false;
  const fsScene = new THREE.Scene();
  fsScene.add(fsMesh);

  const mk = (frag, uniforms) =>
    new THREE.ShaderMaterial({ vertexShader: FS_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, toneMapped: false });
  const brightMat = mk(BRIGHT_FRAG, { tInput: { value: null }, threshold: { value: 1 }, knee: { value: 0.5 } });
  const downMat = mk(DOWN_FRAG, { tInput: { value: null }, texel: { value: new THREE.Vector2() } });
  const upMat = mk(UP_FRAG, { tLow: { value: null }, tHigh: { value: null }, texel: { value: new THREE.Vector2() }, radius: { value: 1 } });
  const compositeMat = mk(COMPOSITE_FRAG, {
    tScene: { value: null },
    tBloom: { value: null },
    bloomStrength: { value: 0 },
    useBloom: { value: 1 },
    exposure: { value: 1 },
    tonemap: { value: 1 },
    contrast: { value: 1 },
    saturation: { value: 1 },
    temperature: { value: 0 },
    tint: { value: new THREE.Color(1, 1, 1) },
    lift: { value: new THREE.Color(0, 0, 0) },
    vignette: { value: 0 },
    grain: { value: 0 },
    chroma: { value: 0 },
    time: { value: 0 },
  });

  const rtOpts = { type: THREE.HalfFloatType, colorSpace: THREE.LinearSRGBColorSpace, depthBuffer: false };
  let sceneRT = null;
  let downs = [];
  let ups = [];
  let sizeKey = "";
  const MIPS = 5;

  function disposeTargets() {
    sceneRT?.dispose();
    for (const t of [...downs, ...ups]) t.dispose();
    sceneRT = null;
    downs = [];
    ups = [];
    sizeKey = "";
  }

  const drawSize = new THREE.Vector2();
  function ensureTargets() {
    renderer.getDrawingBufferSize(drawSize);
    const w = Math.max(1, drawSize.x | 0);
    const h = Math.max(1, drawSize.y | 0);
    const key = `${w}x${h}:${quality}`;
    if (key === sizeKey) return;
    disposeTargets();
    sizeKey = key;
    sceneRT = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      colorSpace: THREE.LinearSRGBColorSpace,
      samples: quality === "high" ? 4 : 0,
    });
    let bw = Math.max(1, w >> 1);
    let bh = Math.max(1, h >> 1);
    const mips = quality === "high" ? MIPS : 4;
    for (let i = 0; i < mips; i += 1) {
      downs.push(new THREE.WebGLRenderTarget(bw, bh, rtOpts));
      ups.push(new THREE.WebGLRenderTarget(bw, bh, rtOpts));
      bw = Math.max(1, bw >> 1);
      bh = Math.max(1, bh >> 1);
    }
  }

  function pass(material, target) {
    fsMesh.material = material;
    renderer.setRenderTarget(target);
    renderer.render(fsScene, fsCam);
  }

  // ── Pulses (juice → grade) ───────────────────────────────
  const pulses = [];
  function pulse({ exposure = 0, chroma = 0, saturation = 0, bloom = 0, vignette = 0, duration = 0.35 } = {}) {
    pulses.push({ exposure, chroma, saturation, bloom, vignette, t: 0, duration: Math.max(0.05, duration) });
  }

  function pulseSum() {
    const s = { exposure: 0, chroma: 0, saturation: 0, bloom: 0, vignette: 0 };
    for (const q of pulses) {
      const k = 1 - q.t / q.duration;
      const e = k * k;
      s.exposure += q.exposure * e;
      s.chroma += q.chroma * e;
      s.saturation += q.saturation * e;
      s.bloom += q.bloom * e;
      s.vignette += q.vignette * e;
    }
    return s;
  }

  // ── Apply preset ─────────────────────────────────────────
  function applyPreset() {
    const sky = skyMesh?.material?.uniforms;
    if (sky?.top) {
      sky.top.value.setHex(p.sky.top);
      sky.horizon.value.setHex(p.sky.horizon);
      sky.bottom.value.setHex(p.sky.bottom);
    }
    scene.background = new THREE.Color(p.sky.top);
    hemi.color.setHex(p.hemi.sky);
    hemi.groundColor.setHex(p.hemi.ground);
    hemi.intensity = p.hemi.intensity;
    sun.color.setHex(p.sun.color);
    sun.intensity = p.sun.intensity;
    sun.castShadow = !!shadows && p.sun.shadows !== false && quality !== "low";
    if (scene.fog?.isFogExp2) {
      scene.fog.color.setHex(p.fog.color);
      scene.fog.density = p.fog.density;
    } else {
      scene.fog = new THREE.FogExp2(p.fog.color, p.fog.density);
    }
    sunDisc.visible = !!p.sun.disc;
    sunDisc.material.color.setHex(p.sun.color).multiplyScalar(3.5);
    rebuildEnv();
    const u = compositeMat.uniforms;
    u.tonemap.value = TONEMAP_ID[p.tonemap] ?? 1;
    u.contrast.value = p.grade.contrast;
    u.saturation.value = p.grade.saturation;
    u.temperature.value = p.grade.temperature;
    u.tint.value.setHex(p.grade.tint ?? 0xffffff);
    u.lift.value.setHex(p.grade.lift ?? 0x000000);
    brightMat.uniforms.threshold.value = p.bloom.threshold;
    brightMat.uniforms.knee.value = Math.max(0.05, p.bloom.threshold * 0.5);
    upMat.uniforms.radius.value = 0.6 + p.bloom.radius;
    applyQualityRenderer();
  }

  function applyQualityRenderer() {
    const dpr = window.devicePixelRatio || 1;
    renderer.setPixelRatio(quality === "high" ? Math.min(dpr, 2) : quality === "medium" ? Math.min(dpr, 1.25) : 1);
    renderer.setSize(renderer.domElement.clientWidth || window.innerWidth, renderer.domElement.clientHeight || window.innerHeight, false);
    // Low tier renders straight to screen with built-in tone mapping
    if (quality === "low") {
      renderer.toneMapping = p.tonemap === "agx" ? THREE.AgXToneMapping : p.tonemap === "neutral" ? THREE.NeutralToneMapping : THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = p.exposure;
    } else {
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.toneMappingExposure = 1;
    }
    sun.castShadow = !!shadows && p.sun.shadows !== false && quality !== "low";
    configureShadowCam();
  }

  function onSky(ev) {
    const mode = ev?.detail?.mode;
    p = mode === "night" && !/^(night|neon|noir|liminal|underwater)$/.test(presetId) ? nightVariant(basePreset) : basePreset;
    applyPreset();
  }
  window.addEventListener("plab:sky", onSky);
  // Respect the lab's stored day/night choice at mount
  if (kit?.getMode?.() === "night" && !/^(night|neon|noir|liminal|underwater)$/.test(presetId)) {
    p = nightVariant(basePreset);
  }
  applyPreset();

  // ── Auto shadows ─────────────────────────────────────────
  let shadowScanT = 0;
  function refreshShadows(root = scene) {
    root.traverse((o) => {
      if (!o.isMesh || o.userData.__lookShadow) return;
      o.userData.__lookShadow = true;
      if (o === skyMesh || o === sunDisc || o.userData.noShadow) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!m || m.transparent || m.depthWrite === false || m.isShaderMaterial || m.isMeshBasicMaterial) return;
      o.castShadow = o.userData.castShadow !== false;
      o.receiveShadow = o.userData.receiveShadow !== false;
    });
  }

  function follow(object3d) {
    followTarget = object3d || null;
  }

  // ── Frame ────────────────────────────────────────────────
  let time = 0;
  let emaDt = 1 / 60;
  let dwell = 0;
  const sunDir = new THREE.Vector3();

  function render(dt = 1 / 60) {
    time += dt;
    for (let i = pulses.length - 1; i >= 0; i -= 1) {
      pulses[i].t += dt;
      if (pulses[i].t >= pulses[i].duration) pulses.splice(i, 1);
    }

    // Auto quality: step down when frames are slow, back up when fast.
    if (autoQuality && dt > 0) {
      emaDt = emaDt * 0.95 + Math.min(dt, 0.1) * 0.05;
      dwell += dt;
      if (dwell > 3) {
        const qi = QUALITY.indexOf(quality);
        if (emaDt > 1 / 38 && qi > 0) setQuality(QUALITY[qi - 1], true);
        else if (emaDt < 1 / 58 && qi < QUALITY.length - 1 && dwell > 12) setQuality(QUALITY[qi + 1], true);
      }
    }

    if (autoShadows) {
      shadowScanT -= dt;
      if (shadowScanT <= 0) {
        shadowScanT = 0.5;
        refreshShadows();
      }
    }

    // Sun + shadow frustum follow the camera/player
    sunDir.copy(sunDirection(p));
    if (followTarget) followTarget.getWorldPosition(followPos);
    else followPos.copy(camera.position);
    sun.target.position.copy(followPos);
    sun.position.copy(followPos).addScaledVector(sunDir, 80);
    sun.target.updateMatrixWorld();
    sunDisc.position.copy(camera.position).addScaledVector(sunDir, 160);
    sunDisc.lookAt(camera.position);
    if (skyMesh && skyMesh === ownSky) skyMesh.position.copy(camera.position);

    const ps = pulseSum();
    if (quality === "low") {
      renderer.toneMappingExposure = p.exposure * (1 + ps.exposure);
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
      return;
    }

    ensureTargets();
    renderer.setRenderTarget(sceneRT);
    renderer.render(scene, camera);

    const strength = Math.max(0, p.bloom.strength + ps.bloom);
    const useBloom = strength > 0.001;
    if (useBloom) {
      brightMat.uniforms.tInput.value = sceneRT.texture;
      pass(brightMat, downs[0]);
      for (let i = 1; i < downs.length; i += 1) {
        downMat.uniforms.tInput.value = downs[i - 1].texture;
        downMat.uniforms.texel.value.set(1 / downs[i - 1].width, 1 / downs[i - 1].height);
        pass(downMat, downs[i]);
      }
      let low = downs[downs.length - 1];
      for (let i = downs.length - 2; i >= 0; i -= 1) {
        upMat.uniforms.tLow.value = low.texture;
        upMat.uniforms.tHigh.value = downs[i].texture;
        upMat.uniforms.texel.value.set(1 / low.width, 1 / low.height);
        pass(upMat, ups[i]);
        low = ups[i];
      }
      compositeMat.uniforms.tBloom.value = low.texture;
    }

    const u = compositeMat.uniforms;
    u.tScene.value = sceneRT.texture;
    u.useBloom.value = useBloom ? 1 : 0;
    u.bloomStrength.value = strength / Math.max(1, downs.length * 0.6);
    u.exposure.value = p.exposure * (1 + ps.exposure);
    u.saturation.value = Math.max(0, p.grade.saturation + ps.saturation);
    u.vignette.value = Math.min(1, p.vignette + ps.vignette);
    u.grain.value = p.grain;
    u.chroma.value = Math.max(0, (p.chroma || 0) + ps.chroma);
    u.time.value = time;
    pass(compositeMat, null);
  }

  function setQuality(q, fromAuto = false) {
    if (!QUALITY.includes(q) || q === quality) return;
    quality = q;
    dwell = 0;
    if (!fromAuto) emaDt = 1 / 60;
    sizeKey = "";
    applyQualityRenderer();
  }

  /** Swap mood at runtime (e.g. level change, boss, win screen). */
  function setPreset(name, over = {}) {
    presetId = String(name);
    basePreset = resolvePreset(name, over);
    p = kit?.getMode?.() === "night" && !/^(night|neon|noir|liminal|underwater)$/.test(presetId) ? nightVariant(basePreset) : basePreset;
    applyPreset();
  }

  /** Tweak the active look (partial preset object). */
  function set(partial = {}) {
    basePreset = deepMerge(basePreset, partial);
    p = deepMerge(p, partial);
    applyPreset();
  }

  engine.setRenderFn?.(render);

  function dispose() {
    window.removeEventListener("plab:sky", onSky);
    engine.setRenderFn?.(null);
    disposeTargets();
    envRT?.dispose();
    pmrem.dispose();
    for (const m of [brightMat, downMat, upMat, compositeMat]) m.dispose();
    fsGeo.dispose();
    scene.remove(sunDisc);
    sunDisc.geometry.dispose();
    sunDisc.material.dispose();
    if (ownSky) {
      scene.remove(ownSky);
      ownSky.geometry.dispose();
      ownSky.material.dispose();
    }
    for (const o of owned) scene.remove(o);
    if (scene.environment === envRT?.texture) scene.environment = null;
    renderer.toneMapping = THREE.NoToneMapping;
    if (engine.__look === api) engine.__look = null;
  }

  const api = {
    get preset() {
      return presetId;
    },
    get params() {
      return p;
    },
    get quality() {
      return quality;
    },
    sun,
    hemi,
    setPreset,
    set,
    pulse,
    follow,
    refreshShadows,
    setQuality,
    render,
    dispose,
  };
  engine.__look = api;
  return api;
}
