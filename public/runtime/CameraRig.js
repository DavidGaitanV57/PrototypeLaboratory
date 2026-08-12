/**
 * Simple follow / orbit / fps camera helpers.
 */
import * as THREE from "/vendor/three/build/three.module.js";

export function createFollowCamera(camera, target, opts = {}) {
  const offset = new THREE.Vector3(...(opts.offset || [0, 5, 10]));
  const look = new THREE.Vector3(...(opts.look || [0, 1, 0]));
  const damp = opts.damp ?? 8;
  const tmp = new THREE.Vector3();
  const lookAt = new THREE.Vector3();

  return {
    update(dt) {
      if (!target) return;
      tmp.copy(target.position).add(offset);
      camera.position.lerp(tmp, 1 - Math.exp(-damp * dt));
      lookAt.copy(target.position).add(look);
      camera.lookAt(lookAt);
    },
    setOffset(x, y, z) {
      offset.set(x, y, z);
    },
  };
}

export function createFpsCamera(camera, input, opts = {}) {
  const yawPitch = { yaw: 0, pitch: 0 };
  const sens = opts.sens ?? 0.002;
  const eye = opts.eyeHeight ?? 1.6;
  const pos = new THREE.Vector3();

  return {
    yawPitch,
    attach(body) {
      this.body = body;
    },
    update(_dt) {
      const d = input.mouseDelta();
      yawPitch.yaw -= d.x * sens;
      yawPitch.pitch -= d.y * sens;
      yawPitch.pitch = Math.max(-1.4, Math.min(1.4, yawPitch.pitch));
      if (this.body) {
        pos.copy(this.body.position);
        pos.y += eye;
        camera.position.copy(pos);
      }
      camera.rotation.order = "YXZ";
      camera.rotation.y = yawPitch.yaw;
      camera.rotation.x = yawPitch.pitch;
    },
  };
}
