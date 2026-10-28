import * as THREE from 'three';

export function createAtmosphereVfx(scene: THREE.Scene) {
  const count = 140;
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = THREE.MathUtils.randFloatSpread(18);
    positions[i * 3 + 1] = THREE.MathUtils.randFloat(0.4, 4.5);
    positions[i * 3 + 2] = THREE.MathUtils.randFloat(-25, 8);
    velocities[i] = THREE.MathUtils.randFloat(0.08, 0.28);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xd7c8aa,
    size: 0.055,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
  });
  const dust = new THREE.Points(geometry, material);
  scene.add(dust);

  const emberGeometry = new THREE.BufferGeometry();
  const emberPositions = new Float32Array(45 * 3);
  for (let i = 0; i < 45; i += 1) {
    emberPositions[i * 3] = THREE.MathUtils.randFloatSpread(5);
    emberPositions[i * 3 + 1] = THREE.MathUtils.randFloat(0.3, 2.5);
    emberPositions[i * 3 + 2] = THREE.MathUtils.randFloat(-26, -17);
  }
  emberGeometry.setAttribute('position', new THREE.Float32BufferAttribute(emberPositions, 3));
  const emberMaterial = new THREE.PointsMaterial({
    color: 0xffb84d,
    size: 0.08,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const embers = new THREE.Points(emberGeometry, emberMaterial);
  scene.add(embers);
  let lowQuality = false;

  return {
    setLowQuality(enabled: boolean) {
      lowQuality = enabled;
      dust.visible = !enabled;
      embers.visible = !enabled;
    },
    update(lightLevel: number, deltaSeconds: number, elapsedSeconds: number) {
      if (lowQuality) return;
      const dustOpacity = 0.06 + Math.min(lightLevel / 100, 1) * 0.1;
      material.opacity = dustOpacity;
      const positionsAttribute = geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < count; i += 1) {
        const y = positionsAttribute.getY(i) + velocities[i] * deltaSeconds;
        positionsAttribute.setY(i, y > 5 ? 0.35 : y);
        positionsAttribute.setX(i, positionsAttribute.getX(i) + Math.sin(elapsedSeconds * 0.35 + i) * 0.0015);
      }
      positionsAttribute.needsUpdate = true;

      emberMaterial.opacity = Math.max(0, (lightLevel - 55) / 45) * 0.55;
      embers.rotation.y = elapsedSeconds * 0.015;
      embers.position.y = Math.sin(elapsedSeconds * 0.7) * 0.05;
    },
    dispose() {
      scene.remove(dust, embers);
      geometry.dispose();
      material.dispose();
      emberGeometry.dispose();
      emberMaterial.dispose();
    },
  };
}
