import * as THREE from 'three';

export interface NeighbourhoodState {
  level: number;
  lamps: THREE.PointLight[];
  lampMeshes: THREE.Mesh[];
  marketLights: THREE.PointLight[];
  marketMeshes: THREE.Mesh[];
  houseLights: THREE.PointLight[];
  gateLight: THREE.PointLight;
}

export function createNeighbourhoodState(scene: THREE.Scene): NeighbourhoodState {
  const lamps: THREE.PointLight[] = [];
  const lampMeshes: THREE.Mesh[] = [];
  const marketLights: THREE.PointLight[] = [];
  const marketMeshes: THREE.Mesh[] = [];
  const houseLights: THREE.PointLight[] = [];
  const lanternMaterial = new THREE.MeshStandardMaterial({ color: 0x5b4a35, emissive: 0x120d08, emissiveIntensity: 0.2 });

  for (const x of [-3.6, 3.6]) {
    for (const z of [-2, -6, -10, -14, -18]) {
      const lamp = new THREE.PointLight(0xffb45b, 0, 6);
      lamp.position.set(x, 2.5, z);
      scene.add(lamp);
      lamps.push(lamp);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), lanternMaterial.clone());
      mesh.position.copy(lamp.position);
      scene.add(mesh);
      lampMeshes.push(mesh);
    }
  }

  for (const z of [-8, -9.5, -11]) {
    const light = new THREE.PointLight(0xffc66d, 0, 5);
    light.position.set(0, 2.1, z);
    scene.add(light);
    marketLights.push(light);
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.18), lanternMaterial.clone());
    mesh.position.copy(light.position);
    scene.add(mesh);
    marketMeshes.push(mesh);
  }

  for (const x of [-6, 6]) {
    for (const z of [-18, -12, -6, 0, 6, 12, 18]) {
      const light = new THREE.PointLight(0xff9d45, 0, 5);
      light.position.set(x, 2.2, z);
      scene.add(light);
      houseLights.push(light);
    }
  }

  const gateLight = new THREE.PointLight(0xffa347, 0, 10);
  gateLight.position.set(0, 2.5, -19.5);
  scene.add(gateLight);

  return { level: 0, lamps, lampMeshes, marketLights, marketMeshes, houseLights, gateLight };
}

export function applyNeighbourhoodLight(state: NeighbourhoodState, level: number) {
  state.level = Math.max(0, Math.min(100, level));
  const normalized = state.level / 100;
  const street = Math.min(1, state.level / 40);
  const market = Math.max(0, Math.min(1, (state.level - 30) / 30));
  const homes = Math.max(0, Math.min(1, (state.level - 50) / 40));
  const gate = Math.max(0, Math.min(1, (state.level - 80) / 20));

  state.lamps.forEach((light, index) => {
    const intensity = street * (0.7 + (index % 3) * 0.08);
    light.intensity = intensity;
    const material = state.lampMeshes[index].material as THREE.MeshStandardMaterial;
    material.emissiveIntensity = street * 1.4;
    material.emissive.set(street > 0.5 ? 0x7a4318 : 0x120d08);
  });
  state.marketLights.forEach((light, index) => {
    light.intensity = market * (1.2 + index * 0.15);
    const material = state.marketMeshes[index].material as THREE.MeshStandardMaterial;
    material.emissiveIntensity = market * 1.8;
    material.emissive.set(market > 0.4 ? 0x8a4f1b : 0x120d08);
  });
  state.houseLights.forEach((light, index) => {
    light.intensity = homes * (0.65 + (index % 4) * 0.06);
  });
  state.gateLight.intensity = gate * 2.5;

  const targetExposure = 0.7 + normalized * 0.3;
  return { street, market, homes, gate, targetExposure };
}

export function disposeNeighbourhoodState(state: NeighbourhoodState, scene: THREE.Scene) {
  [...state.lamps, ...state.marketLights, ...state.houseLights, state.gateLight].forEach((light) => scene.remove(light));
  [...state.lampMeshes, ...state.marketMeshes].forEach((mesh) => {
    scene.remove(mesh);
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  });
}
