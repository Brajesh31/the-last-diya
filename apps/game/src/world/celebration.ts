import * as THREE from 'three';

export interface CelebrationController {
  update(deltaSeconds: number): void;
  trigger(): void;
  dispose(): void;
}

export function createCelebration(scene: THREE.Scene): CelebrationController {
  const group = new THREE.Group();
  group.name = 'final-celebration';
  group.visible = false;
  scene.add(group);

  const lights: THREE.PointLight[] = [];
  const lamps: THREE.Mesh[] = [];
  for (let index = 0; index < 14; index += 1) {
    const x = ((index % 7) - 3) * 2.4;
    const z = -18 - Math.floor(index / 7) * 3.5;
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xd89a42, emissive: 0x6b3e0c, emissiveIntensity: 0 }),
    );
    lamp.position.set(x, 1.3, z);
    group.add(lamp);
    lamps.push(lamp);

    const light = new THREE.PointLight(0xffb84d, 0, 5);
    light.position.copy(lamp.position);
    group.add(light);
    lights.push(light);
  }

  let elapsed = 0;
  let active = false;

  return {
    update(deltaSeconds) {
      if (!active) return;
      elapsed += deltaSeconds;
      for (let index = 0; index < lights.length; index += 1) {
        const phase = Math.max(0, Math.min(1, (elapsed - index * 0.12) / 0.8));
        const intensity = phase * (0.8 + Math.sin(elapsed * 5 + index) * 0.08);
        lights[index].intensity = Math.max(0, intensity);
        (lamps[index].material as THREE.MeshStandardMaterial).emissiveIntensity = Math.max(0, phase);
      }
    },
    trigger() {
      active = true;
      elapsed = 0;
      group.visible = true;
    },
    dispose() {
      for (const light of lights) light.dispose();
      for (const child of group.children) {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          const material = child.material;
          if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
          else material.dispose();
        }
      }
      scene.remove(group);
    },
  };
}
