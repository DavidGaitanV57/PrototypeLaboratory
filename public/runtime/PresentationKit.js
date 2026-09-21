/**
 * Presentation ceiling — fog, grade-ish overlays, grain, vignette, VHS, genre accents.
 * Use when the TDD defines art direction / atmosphere / palette / post. Graybox meshes stay
 * primitives; this kit raises *look* without glTF/PBR textures.
 */
import * as THREE from "/vendor/three/build/three.module.js";

/**
 * @param {{ canvas?: HTMLCanvasElement, parent?: HTMLElement }} opts
 */
export function createPresentation(opts = {}) {
  const canvas = opts.canvas || null;
  const parent = opts.parent || canvas?.parentElement || null;

  /** @type {HTMLElement | null} */
  let root = null;
  /** @type {HTMLElement | null} */
  let vignette = null;
  /** @type {HTMLElement | null} */
  let grain = null;
  /** @type {HTMLCanvasElement | null} */
  let grainCanvas = null;
  /** @type {CanvasRenderingContext2D | null} */
  let grainCtx = null;
  /** @type {HTMLElement | null} */
  let vhs = null;
  /** @type {HTMLElement | null} */
  let wash = null;
  let grainTick = 0;
  let grainOpacity = 0.12;
  let disposed = false;

  if (parent) {
    const cs = getComputedStyle(parent);
    if (cs.position === "static") parent.style.position = "relative";

    root = document.createElement("div");
    root.className = "plab-presentation";
    Object.assign(root.style, {
      position: "absolute",
      inset: "0",
      pointerEvents: "none",
      zIndex: "2",
      overflow: "hidden",
    });

    vignette = document.createElement("div");
    Object.assign(vignette.style, {
      position: "absolute",
      inset: "0",
      boxShadow: "inset 0 0 120px 40px rgba(0,0,0,0.35)",
      transition: "box-shadow 0.35s ease",
    });

    grain = document.createElement("div");
    Object.assign(grain.style, {
      position: "absolute",
      inset: "0",
      opacity: String(grainOpacity),
      mixBlendMode: "overlay",
    });
    grainCanvas = document.createElement("canvas");
    grainCanvas.width = 160;
    grainCanvas.height = 90;
    Object.assign(grainCanvas.style, { width: "100%", height: "100%", display: "block" });
    grain.appendChild(grainCanvas);
    grainCtx = grainCanvas.getContext("2d");

    vhs = document.createElement("div");
    Object.assign(vhs.style, {
      position: "absolute",
      inset: "0",
      display: "none",
      opacity: "0.45",
      background:
        "repeating-linear-gradient(0deg, rgba(0,0,0,0.12) 0 1px, transparent 1px 3px)",
    });

    wash = document.createElement("div");
    Object.assign(wash.style, {
      position: "absolute",
      inset: "0",
      opacity: "0",
      background: "#C9B45A",
      mixBlendMode: "color",
      transition: "opacity 0.4s ease",
    });

    root.append(vignette, grain, vhs, wash);
    parent.appendChild(root);
  }

  function setVignette(strength = 0.35, color = "0,0,0") {
    if (!vignette) return;
    const s = Math.max(0, Math.min(1, strength));
    const blur = Math.round(80 + s * 140);
    const spread = Math.round(24 + s * 90);
    vignette.style.boxShadow = `inset 0 0 ${blur}px ${spread}px rgba(${color},${(0.2 + s * 0.55).toFixed(2)})`;
  }

  function setGrain(opacity = 0.12) {
    grainOpacity = Math.max(0, Math.min(0.45, opacity));
    if (grain) grain.style.opacity = String(grainOpacity);
  }

  function setVhs(on = false) {
    if (!vhs) return;
    vhs.style.display = on ? "block" : "none";
  }

  /** Soft color grade wash (hex or css color). */
  function setWash(color = "#C9B45A", opacity = 0.08) {
    if (!wash) return;
    wash.style.background = color;
    wash.style.opacity = String(Math.max(0, Math.min(0.35, opacity)));
  }

  /**
   * Linear fog matching TDD AtmosphereDirector-style numbers.
   * @param {THREE.Scene} scene
   * @param {{ near?: number, far?: number, color?: number|string, background?: number|string }} cfg
   */
  function applyFog(scene, cfg = {}) {
    if (!scene) return;
    const near = cfg.near ?? 8;
    const far = cfg.far ?? 42;
    const color = new THREE.Color(cfg.color ?? 0xc4b87a);
    scene.fog = new THREE.Fog(color, near, far);
    if (cfg.background != null) scene.background = new THREE.Color(cfg.background);
    else scene.background = color.clone().multiplyScalar(0.65);
  }

  function clearFog(scene) {
    if (!scene) return;
    scene.fog = null;
  }

  /**
   * Reactive look for sanity / damage / low fuel style meters (0–1 stress).
   * @param {number} stress 0 = calm, 1 = critical
   */
  function setStress(stress = 0) {
    const s = Math.max(0, Math.min(1, stress));
    setVignette(0.28 + s * 0.45, s > 0.55 ? "60,10,40" : "0,0,0");
    setGrain(0.1 + s * 0.18);
  }

  function updateGrainFrame() {
    if (!grainCtx || !grainCanvas || grainOpacity < 0.02) return;
    if (++grainTick % 3) return;
    const w = grainCanvas.width;
    const h = grainCanvas.height;
    const id = grainCtx.createImageData(w, h);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() * 255) | 0;
      d[i] = d[i + 1] = d[i + 2] = n;
      d[i + 3] = 255;
    }
    grainCtx.putImageData(id, 0, 0);
  }

  /** Call once per frame from the game loop (optional). */
  function update(_dt = 0) {
    if (disposed) return;
    updateGrainFrame();
  }

  /**
   * Simple boost / drift trail ribbon behind a world position (race juice).
   * @returns {{ mesh: THREE.Mesh, push(pos: THREE.Vector3): void, dispose(): void }}
   */
  function createTrail({ color = 0x4fc3f7, maxPoints = 18, width = 0.35 } = {}) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(maxPoints * 6 * 3);
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setDrawRange(0, 0);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    /** @type {THREE.Vector3[]} */
    const pts = [];

    function push(pos) {
      if (!pos) return;
      pts.push(pos.clone());
      if (pts.length > maxPoints) pts.shift();
      let o = 0;
      for (let i = 0; i < pts.length - 1; i += 1) {
        const a = pts[i];
        const b = pts[i + 1];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const len = Math.hypot(dx, dz) || 1;
        const px = (-dz / len) * width * 0.5;
        const pz = (dx / len) * width * 0.5;
        const y = a.y + 0.15;
        const y2 = b.y + 0.15;
        // quad as two tris
        const verts = [
          a.x - px, y, a.z - pz,
          a.x + px, y, a.z + pz,
          b.x + px, y2, b.z + pz,
          a.x - px, y, a.z - pz,
          b.x + px, y2, b.z + pz,
          b.x - px, y2, b.z - pz,
        ];
        for (const v of verts) positions[o++] = v;
      }
      geo.attributes.position.needsUpdate = true;
      geo.setDrawRange(0, Math.max(0, (pts.length - 1) * 6));
    }

    function disposeTrail() {
      geo.dispose();
      mat.dispose();
      mesh.removeFromParent();
    }

    return { mesh, push, dispose: disposeTrail };
  }

  /**
   * Alternating curb stripe boxes along a polyline (XZ), for race tracks.
   * @param {THREE.Scene|THREE.Object3D} parentObj
   * @param {Array<{x:number,z:number}>} points
   */
  function addCurbStripes(parentObj, points, { height = 0.25, width = 0.35, colorA = 0xffffff, colorB = 0xe53935 } = {}) {
    if (!parentObj || !points?.length) return [];
    const meshes = [];
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      const mx = (a.x + b.x) * 0.5;
      const mz = (a.z + b.z) * 0.5;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz) || 0.01;
      const geo = new THREE.BoxGeometry(width, height, len);
      const mat = new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? colorA : colorB,
        roughness: 0.85,
        metalness: 0,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(mx, height * 0.5, mz);
      mesh.rotation.y = Math.atan2(dx, dz);
      parentObj.add(mesh);
      meshes.push(mesh);
    }
    return meshes;
  }

  function dispose() {
    disposed = true;
    root?.remove();
    root = null;
    vignette = grain = vhs = wash = null;
    grainCanvas = null;
    grainCtx = null;
  }

  return {
    setVignette,
    setGrain,
    setVhs,
    setWash,
    setStress,
    applyFog,
    clearFog,
    createTrail,
    addCurbStripes,
    update,
    dispose,
    get root() {
      return root;
    },
  };
}
