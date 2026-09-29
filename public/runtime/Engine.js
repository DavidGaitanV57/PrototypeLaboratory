/**
 * Core Three.js engine — loop, resize, dispose.
 */
import * as THREE from "/vendor/three/build/three.module.js";

export { THREE };

export function createEngine(canvas, opts = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: opts.antialias !== false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    opts.fov ?? 60,
    (canvas.clientWidth || window.innerWidth) / Math.max(1, canvas.clientHeight || window.innerHeight),
    opts.near ?? 0.1,
    opts.far ?? 500,
  );
  camera.position.set(0, 8, 14);

  const clock = new THREE.Clock();
  const updaters = [];
  const resizeHooks = [];
  let running = false;
  /** Optional render override (LookKit installs its post chain here). */
  let renderFn = null;

  function onResize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = Math.max(1, canvas.clientHeight || window.innerHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    for (const fn of resizeHooks) fn(w, h);
  }

  window.addEventListener("resize", onResize);

  function animate() {
    const dt = Math.min(clock.getDelta(), 0.1);
    for (const fn of updaters) fn(dt);
    if (renderFn) renderFn(dt);
    else renderer.render(scene, camera);
  }

  function start() {
    if (running) return;
    running = true;
    clock.start();
    renderer.setAnimationLoop(animate);
  }

  function stop() {
    running = false;
    renderer.setAnimationLoop(null);
  }

  function onUpdate(fn) {
    updaters.push(fn);
    return () => {
      const i = updaters.indexOf(fn);
      if (i >= 0) updaters.splice(i, 1);
    };
  }

  /** Replace the default `renderer.render(scene, camera)` (null restores it). */
  function setRenderFn(fn) {
    renderFn = typeof fn === "function" ? fn : null;
  }

  function onResizeHook(fn) {
    resizeHooks.push(fn);
    return () => {
      const i = resizeHooks.indexOf(fn);
      if (i >= 0) resizeHooks.splice(i, 1);
    };
  }

  function disposeObject(obj) {
    obj.traverse?.((child) => {
      if (child.geometry) child.geometry.dispose?.();
      if (child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const m of mats) {
          m.map?.dispose?.();
          m.dispose?.();
        }
      }
    });
  }

  function dispose() {
    stop();
    renderFn = null;
    resizeHooks.length = 0;
    window.removeEventListener("resize", onResize);
    while (scene.children.length) {
      const c = scene.children.pop();
      disposeObject(c);
    }
    renderer.dispose();
  }

  return {
    THREE,
    renderer,
    scene,
    camera,
    clock,
    start,
    stop,
    onUpdate,
    setRenderFn,
    onResizeHook,
    dispose,
    onResize,
  };
}
