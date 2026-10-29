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

  const ribbon = new THREE.Mesh(
    new THREE.TorusGeometry(2.8, 0.018, 6, 64),
    new THREE.MeshBasicMaterial({ color: 0xffc857, transparent: true, opacity: 0 }),
  );
  ribbon.position.set(0, 0.16, -24);
  ribbon.rotation.x = Math.PI / 2;
  group.add(ribbon);

  const particleCount = 48;
  const particlePositions = new Float32Array(particleCount * 3);
  const particleVelocity = new Float32Array(particleCount);
  for (let index = 0; index < particleCount; index += 1) {
    particlePositions[index * 3] = THREE.MathUtils.randFloatSpread(8);
    particlePositions[index * 3 + 1] = THREE.MathUtils.randFloat(0.5, 2.2);
    particlePositions[index * 3 + 2] = THREE.MathUtils.randFloat(-27, -20);
    particleVelocity[index] = THREE.MathUtils.randFloat(0.15, 0.45);
  }
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3));
  const particleMaterial = new THREE.PointsMaterial({
    color: 0xffc857,
    size: 0.07,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  group.add(particles);

  let elapsed = 0;
  let active = false;

  return {
    update(deltaSeconds) {
      if (!active) return;
      elapsed += deltaSeconds;
      const celebrationProgress = Math.min(1, elapsed / 2.4);

      for (let index = 0; index < lights.length; index += 1) {
        const phase = Math.max(0, Math.min(1, (elapsed - index * 0.12) / 0.8));
        const pulse = 0.82 + Math.sin(elapsed * 5 + index) * 0.08;
        lights[index].intensity = phase * pulse;
        (lamps[index].material as THREE.MeshStandardMaterial).emissiveIntensity = phase;
      }

      ribbon.material.opacity = celebrationProgress * 0.35;
      ribbon.scale.setScalar(0.75 + celebrationProgress * 0.45 + Math.sin(elapsed * 2) * 0.025);
      ribbon.rotation.z = elapsed * 0.25;
      particleMaterial.opacity = celebrationProgress * 0.75;

      const positions = particleGeometry.getAttribute('position') as THREE.BufferAttribute;
      for (let index = 0; index < particleCount; index += 1) {
        const y = positions.getY(index) + particleVelocity[index] * deltaSeconds;
        positions.setY(index, y > 3.2 ? 0.55 : y);
        positions.setX(index, positions.getX(index) + Math.sin(elapsed * 1.5 + index) * 0.0018);
      }
      positions.needsUpdate = true;
      particles.rotation.y = elapsed * 0.06;
    },
    trigger() {
      active = true;
      elapsed = 0;
      group.visible = true;
      ribbon.scale.setScalar(0.75);
      particleMaterial.opacity = 0;
      for (const light of lights) light.intensity = 0;
    },
    dispose() {
      for (const light of lights) light.dispose();
      for (const child of group.children) {
        if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
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
