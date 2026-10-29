import * as THREE from 'three';

export interface EnvironmentStoryState {
  group: THREE.Group;
  update(lightLevel: number, elapsedSeconds: number): void;
  dispose(): void;
}

function makeLamp(x: number, z: number) {
  const group = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.8, 8), new THREE.MeshStandardMaterial({ color: 0x3b3027, roughness: 0.9 }));
  post.position.y = 0.9;
  post.castShadow = true;
  group.add(post);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.1, 0.08, 12), new THREE.MeshStandardMaterial({ color: 0x2a211c, roughness: 0.65, metalness: 0.25 }));
  cap.position.y = 1.78;
  cap.castShadow = true;
  group.add(cap);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffc857, transparent: true, opacity: 0 }));
  glow.position.y = 1.75;
  group.add(glow);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 10), new THREE.MeshBasicMaterial({ color: 0xffb84d, transparent: true, opacity: 0, depthWrite: false }));
  halo.position.y = 1.75;
  group.add(halo);
  const light = new THREE.PointLight(0xffb84d, 0, 5.5, 2);
  light.position.y = 1.65;
  group.add(light);
  group.position.set(x, 0, z);
  return { group, glow, halo, light };
}

function makeDoorway(x: number, z: number, rotation = 0) {
  const group = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.9, 0.12), new THREE.MeshStandardMaterial({ color: 0x5a4638, roughness: 0.85 }));
  frame.position.y = 0.95;
  frame.castShadow = true;
  group.add(frame);
  const warmth = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 1.35), new THREE.MeshBasicMaterial({ color: 0xffb84d, transparent: true, opacity: 0 }));
  warmth.position.set(0, 0.9, 0.07);
  group.add(warmth);
  const light = new THREE.PointLight(0xffa64d, 0, 3.5, 2);
  light.position.set(0, 1.05, 0.3);
  group.add(light);
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  return { group, warmth, light };
}

function makeClue(x: number, z: number, rotation = 0) {
  const group = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 0.06), new THREE.MeshStandardMaterial({ color: 0x66584b, roughness: 1 }));
  wall.position.y = 0.65;
  group.add(wall);
  const mark = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.15, 12), new THREE.MeshStandardMaterial({ color: 0xb88a55, emissive: 0x5a3512, emissiveIntensity: 0.8, transparent: true, opacity: 0 }));
  mark.position.set(0, 0.67, 0.04);
  group.add(mark);
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  return { group, mark };
}

export function createEnvironmentStory(scene: THREE.Scene): EnvironmentStoryState {
  const group = new THREE.Group();
  group.name = 'environment-story';
  const lamps = [-16, -10, -4, 2, 8, 14].map((z, index) => makeLamp(index % 2 === 0 ? -4.4 : 4.4, z));
  lamps.forEach(({ group: lamp }) => group.add(lamp));
  const doorways = [makeDoorway(-3.62, -12, Math.PI / 2), makeDoorway(3.62, -6, -Math.PI / 2), makeDoorway(-3.62, 6, Math.PI / 2), makeDoorway(3.62, 12, -Math.PI / 2)];
  doorways.forEach(({ group: doorway }) => group.add(doorway));
  const clues = [makeClue(-3.55, -15, Math.PI / 2), makeClue(3.55, -3, -Math.PI / 2), makeClue(-3.55, 9, Math.PI / 2)];
  clues.forEach(({ group: clue }) => group.add(clue));
  scene.add(group);
  return {
    group,
    update(lightLevel, elapsedSeconds) {
      const streetProgress = THREE.MathUtils.smoothstep(lightLevel, 5, 45);
      const homeProgress = THREE.MathUtils.smoothstep(lightLevel, 35, 80);
      const memoryProgress = THREE.MathUtils.smoothstep(lightLevel, 60, 100);
      lamps.forEach(({ glow, halo, light }, index) => {
        const threshold = 8 + index * 5;
        const amount = THREE.MathUtils.smoothstep(lightLevel, threshold, threshold + 18);
        const flicker = 0.92 + Math.sin(elapsedSeconds * (2.2 + index * 0.17) + index) * 0.06;
        light.intensity = amount * 1.25 * flicker;
        glow.material.opacity = amount * 0.9;
        halo.material.opacity = amount * 0.08;
        halo.scale.setScalar(0.92 + Math.sin(elapsedSeconds * 1.4 + index) * 0.04);
      });
      doorways.forEach(({ warmth, light }, index) => {
        const delay = index * 0.08;
        const amount = Math.max(0, homeProgress - delay);
        warmth.material.opacity = amount * 0.72;
        light.intensity = amount * (0.75 + Math.sin(elapsedSeconds * 1.2 + index) * 0.05);
      });
      clues.forEach(({ mark }, index) => {
        const reveal = Math.max(0, memoryProgress - index * 0.15);
        mark.material.opacity = reveal * 0.75;
        mark.rotation.z = elapsedSeconds * (index % 2 === 0 ? 0.15 : -0.12);
      });
      group.visible = streetProgress > 0.01;
    },
    dispose() {
      group.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((material) => material.dispose());
        }
      });
      scene.remove(group);
    },
  };
}
