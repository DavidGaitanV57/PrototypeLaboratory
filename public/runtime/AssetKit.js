/**
 * AssetKit — the lab asset library (`public/assets/**`): models (.glb/.gltf — clone named objects, fit, seat, play clips) and material sets (tiling PBR textures for floors/walls/ceilings — loadMaterial + texturedBox/texturedPlane/tileUv).
 * Paths are relative to the library: loadAsset("props/crate.glb"), loadMaterial("interior/carpet"). Each file is fetched once; clones and surfaces share GPU data.
 */
import * as THREE from "/vendor/three/build/three.module.js";
import { GLTFLoader } from "/vendor/three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "/vendor/three/examples/jsm/libs/meshopt_decoder.module.js";
import * as SkeletonUtils from "/vendor/three/examples/jsm/utils/SkeletonUtils.js";

/** @type {Map<string, Promise<object>>} */
const cache = new Map();
const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _center = new THREE.Vector3();
const UV_ATTR = ["uv", "uv1", "uv2", "uv3"];
const TEX_SLOTS = [
  "map", "emissiveMap", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "alphaMap",
  "bumpMap", "specularColorMap", "specularIntensityMap", "sheenColorMap", "sheenRoughnessMap",
  "clearcoatMap", "clearcoatNormalMap", "clearcoatRoughnessMap", "transmissionMap", "thicknessMap",
];

/** URL for a library path. Resolves against the page, so it works in the lab and next to an exported build. */
export function assetUrl(file) {
  const clean = String(file || "").replace(/\\/g, "/").replace(/^\/+/, "").replace(/^(public\/)?assets\//, "");
  const encoded = clean.split("/").map(encodeURIComponent).join("/");
  return new URL(`assets/${encoded}`, document.baseURI).href;
}

/**
 * DCC exports often put a texture on a uv set three does not keep (it keeps uv–uv3). The mesh then
 * samples nothing and draws black or not at all — fall back to uv0 for those maps.
 */
function repairUvChannels(root) {
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!mat) continue;
      for (const slot of TEX_SLOTS) {
        const tex = mat[slot];
        if (!tex || !tex.channel) continue;
        if (!obj.geometry.attributes[UV_ATTR[tex.channel]]) tex.channel = 0;
      }
    }
    obj.castShadow = true;
    obj.receiveShadow = true;
  });
}

/**
 * Fetch + parse one library file (cached). Resolves to { file, scene, animations, names }.
 * names = the selectable objects (children of the scene root) for cloneNode().
 */
export function loadAsset(file, { onProgress } = {}) {
  const key = String(file || "");
  if (!cache.has(key)) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const pending = new Promise((resolve, reject) => {
      loader.load(
        assetUrl(key),
        (gltf) => {
          try {
            repairUvChannels(gltf.scene);
            resolve({
              file: key,
              scene: gltf.scene,
              animations: gltf.animations || [],
              names: listNodes(gltf.scene),
            });
          } catch (err) {
            reject(err);
          }
        },
        (ev) => {
          if (onProgress && ev.lengthComputable) onProgress(ev.loaded / ev.total);
        },
        (err) => reject(new Error(`AssetKit: cannot load ${key} — ${err?.message || err}`)),
      );
    });
    pending.catch(() => cache.delete(key));
    cache.set(key, pending);
  }
  return cache.get(key);
}

/** Load several files in parallel; onProgress(0..1) across all of them. */
export async function preloadAssets(files, { onProgress } = {}) {
  const list = [...new Set(files || [])];
  const parts = list.map(() => 0);
  const report = () => onProgress?.(parts.reduce((a, b) => a + b, 0) / Math.max(1, parts.length));
  return Promise.all(
    list.map((f, i) =>
      loadAsset(f, {
        onProgress: (p) => {
          parts[i] = p;
          report();
        },
      }).then((a) => {
        parts[i] = 1;
        report();
        return a;
      }),
    ),
  );
}

/** Names of the selectable objects in a loaded scene (unwraps a single root wrapper). */
export function listNodes(scene) {
  let level = scene.children;
  if (level.length === 1 && !level[0].isMesh && level[0].children.length) level = level[0].children;
  return level.map((o) => o.name).filter(Boolean);
}

/**
 * Clone one named object (or the whole scene when name is omitted). Transform is reset so the clone
 * sits at the origin. Skinned meshes are cloned with their skeleton. GPU buffers stay shared.
 */
export function cloneNode(asset, name) {
  let src = asset.scene;
  if (name) {
    src =
      asset.scene.getObjectByName(name) ||
      asset.scene.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name));
    if (!src) return null;
  }
  const obj = SkeletonUtils.clone(src);
  obj.name = name || asset.file;
  if (name) {
    obj.position.set(0, 0, 0);
    obj.quaternion.identity();
    obj.scale.set(1, 1, 1);
  }
  obj.traverse((o) => {
    o.userData.sharedAsset = true;
  });
  obj.userData.asset = { file: asset.file, node: name || null };
  return obj;
}

/** World-space size of an object (Vector3). */
export function measure(obj) {
  obj.updateMatrixWorld(true);
  _box.setFromObject(obj);
  return _box.isEmpty() ? new THREE.Vector3() : _box.getSize(new THREE.Vector3());
}

/**
 * Uniformly scale so the object matches one target: { height } | { width } | { depth } | { maxSize }.
 * Returns the applied scale factor.
 */
export function fitToSize(obj, { height, width, depth, maxSize } = {}) {
  const s = measure(obj);
  let k = 1;
  if (height) k = height / (s.y || 1);
  else if (width) k = width / (s.x || 1);
  else if (depth) k = depth / (s.z || 1);
  else if (maxSize) k = maxSize / (Math.max(s.x, s.y, s.z) || 1);
  if (Number.isFinite(k) && k > 0) obj.scale.multiplyScalar(k);
  return k;
}

/** Move an unparented object so its bounds rest on y = floorY and (optionally) centre it on x/z = 0. */
export function seatOnFloor(obj, { floorY = 0, center = true } = {}) {
  obj.updateMatrixWorld(true);
  _box.setFromObject(obj);
  if (_box.isEmpty()) return obj;
  _box.getCenter(_center);
  obj.position.y += floorY - _box.min.y;
  if (center) {
    obj.position.x -= _center.x;
    obj.position.z -= _center.z;
  }
  return obj;
}

/**
 * One-call placement: load → clone node → fit → seat → wrap in a Group positioned at `position`.
 * The returned Group is safe to move/rotate; the model inside keeps its fitted offset.
 * opts: { node, height | width | depth | maxSize, position:[x,y,z], rotationY, castShadow, receiveShadow }
 */
export async function placeAsset(file, opts = {}) {
  const asset = await loadAsset(file);
  const model = cloneNode(asset, opts.node);
  if (!model) throw new Error(`AssetKit: "${opts.node}" not found in ${file} (has: ${asset.names.join(", ")})`);
  fitToSize(model, opts);
  seatOnFloor(model, { floorY: 0, center: true });
  if (opts.castShadow === false || opts.receiveShadow === false) {
    model.traverse((o) => {
      if (!o.isMesh) return;
      if (opts.castShadow === false) o.castShadow = false;
      if (opts.receiveShadow === false) o.receiveShadow = false;
    });
  }
  const group = new THREE.Group();
  group.name = `${opts.node || file}#placed`;
  group.add(model);
  if (opts.position) group.position.fromArray(opts.position);
  if (opts.rotationY) group.rotation.y = opts.rotationY;
  group.userData.asset = model.userData.asset;
  group.userData.size = measure(group);
  return group;
}

/**
 * Play an animation clip on a clone. Returns { mixer, action, update(dt), play(name), stop() } —
 * call update(dt) every frame. clip = name or index; omitted → first clip.
 */
export function playClip(obj, asset, clip, { loop = true, fade = 0.2, timeScale = 1 } = {}) {
  const mixer = new THREE.AnimationMixer(obj);
  const pick = (c) =>
    typeof c === "number"
      ? asset.animations[c]
      : THREE.AnimationClip.findByName(asset.animations, c) || asset.animations[0];
  let action = null;
  const play = (c) => {
    const next = pick(c);
    if (!next) return null;
    const a = mixer.clipAction(next);
    a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    a.clampWhenFinished = !loop;
    a.timeScale = timeScale;
    a.reset().fadeIn(fade).play();
    if (action && action !== a) action.fadeOut(fade);
    action = a;
    return a;
  };
  play(clip);
  return {
    mixer,
    get action() {
      return action;
    },
    update: (dt) => mixer.update(dt),
    play,
    stop: () => mixer.stopAllAction(),
  };
}

/** Dispose what a clone owns (skips shared library buffers). Safe on any subtree. */
export function disposeAssetClone(root) {
  root?.traverse?.((o) => {
    if (o.userData?.sharedAsset) return;
    o.geometry?.dispose?.();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) m.dispose?.();
  });
}

/* ── Material sets (tiling PBR textures from the library) ─────────────────── */

let libraryIndex = null;
/** @type {Map<string, Promise<THREE.Texture>>} */
const texCache = new Map();
/** @type {Map<string, Promise<THREE.MeshStandardMaterial>>} */
const matCache = new Map();

function loadLibraryIndex() {
  if (!libraryIndex) {
    libraryIndex = fetch(assetUrl("library.json"))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .catch((err) => {
        libraryIndex = null;
        throw new Error(`AssetKit: cannot read assets/library.json — ${err.message}`);
      });
  }
  return libraryIndex;
}

/** Ids of every material set in the library (e.g. "backrooms/carpet"). */
export async function listMaterials() {
  return Object.keys((await loadLibraryIndex()).materials || {});
}

function loadTexture(file, srgb) {
  const key = `${file}|${srgb ? "srgb" : "linear"}`;
  if (!texCache.has(key)) {
    const pending = new THREE.TextureLoader().loadAsync(assetUrl(file)).then((tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      tex.anisotropy = 8;
      return tex;
    });
    pending.catch(() => texCache.delete(key));
    texCache.set(key, pending);
  }
  return texCache.get(key);
}

/**
 * PBR material from a library set. Cached per id — every surface shares it; use texturedBox /
 * texturedPlane / tileUv so each mesh tiles at real-world scale with this one material.
 * material.userData = { materialSet, tileSize:[w,h], surfaces }.
 */
export function loadMaterial(id) {
  if (!matCache.has(id)) {
    const pending = (async () => {
      const lib = await loadLibraryIndex();
      const def = lib.materials?.[id];
      if (!def) throw new Error(`AssetKit: material "${id}" not in library (has: ${Object.keys(lib.materials || {}).join(", ")})`);
      const m = def.maps || {};
      const [color, normal, rough, metal, ao, orm, height, emissive, opacity] = await Promise.all([
        m.color && loadTexture(m.color, true),
        m.normal && loadTexture(m.normal, false),
        m.roughness && loadTexture(m.roughness, false),
        m.metalness && loadTexture(m.metalness, false),
        m.ao && loadTexture(m.ao, false),
        m.orm && loadTexture(m.orm, false),
        m.height && def.height?.mode !== "none" && loadTexture(m.height, false),
        m.emissive && loadTexture(m.emissive, true),
        m.opacity && loadTexture(m.opacity, false),
      ]);
      const mat = new THREE.MeshStandardMaterial({
        name: def.name || id,
        color: new THREE.Color(def.tint || "#ffffff"),
        map: color || null,
        normalMap: normal || null,
        // ORM packs AO (R), roughness (G), metalness (B) — the channels three already reads.
        roughnessMap: rough || orm || null,
        metalnessMap: metal || orm || null,
        aoMap: ao || orm || null,
        roughness: def.roughness ?? 1,
        metalness: def.metalness ?? 0,
        emissive: new THREE.Color(def.emissive || "#000000"),
        emissiveMap: emissive || null,
        emissiveIntensity: def.emissiveIntensity ?? 1,
        alphaMap: opacity || null,
        transparent: Boolean(def.transparent || opacity),
        alphaTest: def.alphaTest ?? 0,
        side: def.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
      });
      const ns = def.normalScale ?? 1;
      mat.normalScale.set(ns, def.normalConvention === "dx" ? -ns : ns);
      if (height && def.height.mode === "bump") {
        mat.bumpMap = height;
        mat.bumpScale = def.height.scale ?? 1;
      } else if (height && def.height.mode === "displacement") {
        mat.displacementMap = height;
        mat.displacementScale = def.height.scale ?? 0.05;
      }
      const ts = def.tileSize || [2, 2];
      mat.userData = { materialSet: id, tileSize: Array.isArray(ts) ? ts : [ts, ts], surfaces: def.surfaces || [] };
      return mat;
    })();
    pending.catch(() => matCache.delete(id));
    matCache.set(id, pending);
  }
  return matCache.get(id);
}

/** Load several material sets in parallel → { id: material }. */
export async function preloadMaterials(ids) {
  const list = [...new Set(ids || [])];
  const mats = await Promise.all(list.map((id) => loadMaterial(id)));
  return Object.fromEntries(list.map((id, i) => [id, mats[i]]));
}

const _scale = new THREE.Vector3();

/**
 * Rewrite a mesh's UVs as a box projection in metres ÷ tileSize, using the mesh's world scale.
 * Result: one shared material tiles correctly on a 1 m crate and a 40 m wall alike. Works on a
 * Mesh or any subtree. Call after the mesh is scaled/parented; the geometry is cloned first.
 * tileSize defaults to the material's userData.tileSize.
 */
export function tileUv(target, tileSize) {
  target.updateWorldMatrix?.(true, true);
  target.traverse((mesh) => {
    if (!mesh.isMesh || !mesh.geometry?.attributes?.position) return;
    const ts = tileSize ?? (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material)?.userData?.tileSize ?? [2, 2];
    const [tw, th] = Array.isArray(ts) ? ts : [ts, ts];
    const geo = mesh.geometry.clone();
    if (!geo.attributes.normal) geo.computeVertexNormals();
    mesh.getWorldScale(_scale);
    const pos = geo.attributes.position;
    const nrm = geo.attributes.normal;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i) * _scale.x;
      const y = pos.getY(i) * _scale.y;
      const z = pos.getZ(i) * _scale.z;
      const ax = Math.abs(nrm.getX(i));
      const ay = Math.abs(nrm.getY(i));
      const az = Math.abs(nrm.getZ(i));
      let u;
      let v;
      if (ax >= ay && ax >= az) [u, v] = [z, y];
      else if (ay >= az) [u, v] = [x, z];
      else [u, v] = [x, y];
      uv[i * 2] = u / tw;
      uv[i * 2 + 1] = v / th;
    }
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    mesh.geometry = geo;
  });
  return target;
}

/**
 * Box (wall, slab, pillar, crate) with tiled UVs. size = [width, height, depth] in metres.
 * Bottom sits on y = 0 unless { center: true }. Casts and receives shadows.
 */
export function texturedBox(material, [w, h, d] = [1, 1, 1], { center = false } = {}) {
  const geo = new THREE.BoxGeometry(w, h, d);
  if (!center) geo.translate(0, h / 2, 0);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = mesh.receiveShadow = true;
  return tileUv(mesh);
}

/**
 * Horizontal surface (floor, ground, ceiling) with tiled UVs. size = [width, depth] in metres.
 * facing "up" = floor; "down" = ceiling (place it at the ceiling height).
 */
export function texturedPlane(material, [w, d] = [10, 10], { facing = "up", segments = 1 } = {}) {
  const geo = new THREE.PlaneGeometry(w, d, segments, segments);
  geo.rotateX(facing === "down" ? Math.PI / 2 : -Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  return tileUv(mesh);
}

/** Drop cached files (e.g. on unmount when memory matters). Clones already in the scene keep working. */
export function clearAssetCache() {
  cache.clear();
  texCache.clear();
  matCache.clear();
  libraryIndex = null;
}
