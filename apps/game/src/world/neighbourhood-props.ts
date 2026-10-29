import * as THREE from 'three';

interface LampProp {
  light: THREE.PointLight;
  glow: THREE.Mesh;
  baseIntensity: number;
}

function material(color: number, roughness = 0.85, emissive = 0x000000, emissiveIntensity = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, emissive, emissiveIntensity });
}

function addBox(group: THREE.Group, size: [number, number, number], position: [number, number, number], mat: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addCylinder(group: THREE.Group, radius: number, height: number, position: [number, number, number], mat: THREE.Material, segments = 12) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.08, height, segments), mat);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

export function createNeighbourhoodProps(scene: THREE.Scene) {
  const root = new THREE.Group();
  root.name = 'neighbourhood-props';
  scene.add(root);

  const wood = material(0x513b2c);
  const darkWood = material(0x34261f);
  const plaster = material(0x706052);
  const warmPlaster = material(0x8b7661);
  const cloth = material(0x66513f);
  const clothLight = material(0x9b6d4f);
  const metal = material(0x393a36, 0.55);
  const warm = material(0x7b552b, 0.75, 0x3a1d08, 0.2);
  const clay = material(0x8c5637, 0.9);
  const green = material(0x3d5035, 0.95);
  const lamps: LampProp[] = [];

  const addDoorway = (x: number, z: number, side: number) => {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = side * Math.PI / 2;
    addBox(group, [1.05, 2.1, 0.12], [0, 1.05, 0], darkWood);
    addBox(group, [1.3, 0.16, 0.18], [0, 2.18, 0], wood);
    addBox(group, [0.14, 2.2, 0.18], [-0.62, 1.1, 0], wood);
    addBox(group, [0.14, 2.2, 0.18], [0.62, 1.1, 0], wood);
    addBox(group, [0.08, 0.08, 0.08], [0.28, 1.02, -0.1], metal);
    root.add(group);
  };

  const addWindow = (x: number, z: number, side: number) => {
    const group = new THREE.Group();
    group.position.set(x, 1.7, z);
    group.rotation.y = side * Math.PI / 2;
    addBox(group, [1.25, 0.95, 0.08], [0, 0, 0], plaster);
    addBox(group, [0.95, 0.65, 0.06], [0, 0, -0.05], warm);
    addBox(group, [0.06, 0.7, 0.08], [0, 0, -0.09], darkWood);
    addBox(group, [1, 0.06, 0.08], [0, 0, -0.09], darkWood);
    root.add(group);
  };

  // Architectural dressing turns the simple blockout buildings into a lived-in lane.
  const addBuildingDressing = (x: number, z: number, side: number, variant: number) => {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = side * Math.PI / 2;

    addBox(group, [4.62, 0.18, 4.62], [0, 3.22, 0], warmPlaster);
    addBox(group, [4.78, 0.14, 0.45], [0, 3.32, -1.95], darkWood);
    addBox(group, [4.45, 0.08, 0.25], [0, 3.42, -1.85], clay);

    const awning = addBox(group, [3.4, 0.12, 0.65], [0, 2.35, -2.28], variant % 2 ? clothLight : cloth);
    awning.rotation.x = -0.1;
    for (const px of [-1.45, 1.45]) addBox(group, [0.08, 0.8, 0.08], [px, 2.0, -2.24], metal);

    addBox(group, [3.1, 0.1, 0.12], [0, 2.0, -2.3], darkWood);
    for (const px of [-1.25, 0, 1.25]) addBox(group, [0.72, 0.08, 0.06], [px, 2.55, -2.34], variant % 2 ? warm : clay);

    // Small balcony on alternating homes.
    if (variant % 2 === 0) {
      addBox(group, [2.2, 0.12, 0.9], [0, 2.55, 2.0], darkWood);
      addBox(group, [2.2, 0.08, 0.08], [0, 3.0, 1.58], metal);
      addBox(group, [0.08, 0.55, 0.08], [-0.95, 2.78, 1.58], metal);
      addBox(group, [0.08, 0.55, 0.08], [0.95, 2.78, 1.58], metal);
      for (const px of [-0.48, 0, 0.48]) addBox(group, [0.05, 0.5, 0.05], [px, 2.78, 1.58], metal);
    }
    root.add(group);
  };

  let buildingVariant = 0;
  for (let i = -18; i <= 18; i += 6) {
    addDoorway(-3.72, i + 1.2, 1);
    addDoorway(3.72, i - 1.2, -1);
    addWindow(-3.75, i - 1.3, 1);
    addWindow(3.75, i + 1.3, -1);
    addBuildingDressing(-6, i, 1, buildingVariant++);
    addBuildingDressing(6, i, -1, buildingVariant++);
  }

  const addPlant = (x: number, z: number, scale = 1) => {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.scale.setScalar(scale);
    addCylinder(group, 0.18, 0.28, [0, 0.14, 0], clay, 10);
    for (const [px, py, pz, s] of [[0, 0.55, 0, 1], [-0.18, 0.42, 0.02, 0.75], [0.18, 0.48, 0.01, 0.8]] as number[][]) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.22 * s, 8, 6), material(0x40583a));
      leaf.position.set(px, py, pz);
      leaf.scale.set(1, 1.5, 0.7);
      leaf.castShadow = true;
      group.add(leaf);
    }
    root.add(group);
  };

  for (const [x, z, scale] of [[-3.1, 3.2, 1], [3.15, -2.5, 0.9], [-3.2, -13.8, 1.1], [3.1, 13.2, 1.2]] as number[][]) addPlant(x, z, scale);

  const addBench = (x: number, z: number, rotation = 0) => {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    addBox(group, [1.8, 0.12, 0.42], [0, 0.62, 0], wood);
    addBox(group, [0.12, 0.62, 0.12], [-0.68, 0.3, 0], darkWood);
    addBox(group, [0.12, 0.62, 0.12], [0.68, 0.3, 0], darkWood);
    root.add(group);
  };

  addBench(-2.8, 4.5, Math.PI / 2);
  addBench(2.8, -5.5, Math.PI / 2);
  addBench(-2.8, -14, Math.PI / 2);

  const addMarketStall = (x: number, z: number, rotation = 0) => {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    addBox(group, [1.9, 0.12, 1.05], [0, 1.05, 0], wood);
    addBox(group, [0.1, 1.05, 0.1], [-0.82, 0.52, -0.4], darkWood);
    addBox(group, [0.1, 1.05, 0.1], [0.82, 0.52, -0.4], darkWood);
    addBox(group, [2.15, 0.08, 1.35], [0, 2.05, 0], cloth);
    for (const dx of [-0.55, 0, 0.55]) addBox(group, [0.22, 0.18, 0.22], [dx, 1.28, 0.18], warm);
    root.add(group);
  };

  addMarketStall(3.05, -8.2, Math.PI / 2);
  addMarketStall(-3.05, -10.8, -Math.PI / 2);

  const addStreetLamp = (x: number, z: number) => {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    addBox(group, [0.1, 2.6, 0.1], [0, 1.3, 0], metal);
    addBox(group, [0.7, 0.08, 0.08], [0, 2.6, 0], metal);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffc857, transparent: true, opacity: 0 }));
    glow.position.set(0.28, 2.5, 0);
    group.add(glow);
    const light = new THREE.PointLight(0xffb84d, 0, 5.5, 2);
    light.position.set(0.28, 2.5, 0);
    group.add(light);
    lamps.push({ light, glow, baseIntensity: 0.65 });
    root.add(group);
  };

  for (const z of [-16, -10, -4, 2, 8, 14]) {
    addStreetLamp(-4.25, z);
    addStreetLamp(4.25, z);
  }

  // Festival dressing: rangoli, hanging marigolds and overhead cables give the street a human scale.
  const addRangoli = (x: number, z: number, scale = 1) => {
    const group = new THREE.Group();
    group.position.set(x, 0.025, z);
    group.scale.setScalar(scale);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.52, 24), material(0xc58c4b, 0.9));
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);
    for (let i = 0; i < 8; i += 1) {
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), material(i % 2 ? 0xa85f46 : 0xc58b4c));
      const angle = i * Math.PI / 4;
      petal.position.set(Math.cos(angle) * 0.3, 0.02, Math.sin(angle) * 0.3);
      petal.scale.set(1.4, 0.35, 1.4);
      group.add(petal);
    }
    root.add(group);
  };
  addRangoli(-2.4, 1.2, 1.1);
  addRangoli(2.4, -5.8, 0.85);
  addRangoli(-2.5, -15.8, 0.95);

  const cable = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-6, 3.15, -18),
    new THREE.Vector3(-2, 3.65, -8),
    new THREE.Vector3(2, 3.4, 2),
    new THREE.Vector3(6, 3.65, 12),
  ]);
  const cableMesh = new THREE.Mesh(new THREE.TubeGeometry(cable, 32, 0.025, 6, false), metal);
  cableMesh.castShadow = true;
  root.add(cableMesh);
  const cable2 = cable.clone();
  cable2.points.forEach((point) => { point.x *= -1; });
  root.add(new THREE.Mesh(new THREE.TubeGeometry(cable2, 32, 0.02, 6, false), metal));

  const templeArea = new THREE.Group();
  templeArea.position.set(2.9, 0, -17.2);
  addBox(templeArea, [3.1, 0.22, 1.8], [0, 0.12, 0], plaster);
  addBox(templeArea, [2.4, 0.18, 0.45], [0, 0.35, 0.55], darkWood);
  for (let i = -1; i <= 1; i++) addBox(templeArea, [0.12, 1.25, 0.12], [i * 0.75, 0.85, 0.55], wood);
  addBox(templeArea, [2.2, 0.1, 0.9], [0, 1.55, 0.55], cloth);
  root.add(templeArea);

  const update = (lightLevel: number, elapsedSeconds: number) => {
    const street = THREE.MathUtils.smoothstep(lightLevel, 5, 45);
    for (let i = 0; i < lamps.length; i += 1) {
      const lamp = lamps[i];
      const flicker = 0.92 + Math.sin(elapsedSeconds * 5.2 + i * 1.9) * 0.06;
      lamp.light.intensity = lamp.baseIntensity * street * flicker;
      (lamp.glow.material as THREE.MeshBasicMaterial).opacity = Math.min(0.85, street * 0.9);
      lamp.glow.scale.setScalar(0.8 + street * 0.3);
    }
  };

  return {
    update,
    dispose() {
      root.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const current of materials) current.dispose();
        }
      });
      scene.remove(root);
    },
  };
}
