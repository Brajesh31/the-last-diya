import * as THREE from 'three';

export interface PlayerCharacterVisual {
  group: THREE.Group;
  update(lightLevel: number, elapsedSeconds: number, deltaSeconds: number, moving: boolean): void;
  dispose(): void;
}

interface CharacterPalette {
  jacket: number;
  trim: number;
  trousers: number;
  skin: number;
  hair: number;
  backpack: number;
}

function paletteFor(identity: string, local: boolean): CharacterPalette {
  if (local) {
    return { jacket: 0x587a73, trim: 0xd4ad68, trousers: 0x343c3b, skin: 0xb98566, hair: 0x302b27, backpack: 0x594c3b };
  }
  const palettes: CharacterPalette[] = [
    { jacket: 0x7a6557, trim: 0xc79c5a, trousers: 0x343b43, skin: 0x996c50, hair: 0x302925, backpack: 0x514136 },
    { jacket: 0x596a82, trim: 0xbca476, trousers: 0x393b38, skin: 0xb6805f, hair: 0x3a3029, backpack: 0x435167 },
    { jacket: 0x7a594f, trim: 0xd1b17c, trousers: 0x3c403d, skin: 0x91694f, hair: 0x2e2926, backpack: 0x55423a },
    { jacket: 0x72765c, trim: 0xc69c5d, trousers: 0x343a35, skin: 0xb88768, hair: 0x342b25, backpack: 0x4b503e },
  ];
  let hash = 0;
  for (let i = 0; i < identity.length; i += 1) hash = (hash * 31 + identity.charCodeAt(i)) >>> 0;
  return palettes[hash % palettes.length];
}

function standard(color: number, roughness = 0.84, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function addMesh<T extends THREE.Mesh>(parent: THREE.Group, mesh: T, position: [number, number, number], scale?: [number, number, number]) {
  mesh.position.set(...position);
  if (scale) mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function capsule(radius: number, length: number, color: number) {
  return new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 3, 8), standard(color));
}

function box(size: [number, number, number], color: number) {
  return new THREE.Mesh(new THREE.BoxGeometry(...size), standard(color));
}

function sphere(radius: number, color: number, segments = 12) {
  return new THREE.Mesh(new THREE.SphereGeometry(radius, segments, Math.max(8, segments - 2)), standard(color));
}

function createLowDetailRemoteCharacter(identity: string, palette: CharacterPalette): PlayerCharacterVisual {
  const group = new THREE.Group();
  group.name = `player-character-${identity}-low-detail`;
  const bodyMaterial = new THREE.MeshLambertMaterial({ color: palette.jacket, flatShading: true });
  const skinMaterial = new THREE.MeshLambertMaterial({ color: palette.skin, flatShading: true });
  const hairMaterial = new THREE.MeshLambertMaterial({ color: palette.hair, flatShading: true });
  const packMaterial = new THREE.MeshLambertMaterial({ color: palette.backpack, flatShading: true });
  const trimMaterial = new THREE.MeshLambertMaterial({ color: palette.trim, flatShading: true });
  const legMaterial = new THREE.MeshLambertMaterial({ color: palette.trousers, flatShading: true });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.205, 0.40, 2, 6), bodyMaterial);
  body.position.set(0, 0.10, 0);
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.145, 8, 6), skinMaterial);
  head.position.set(0, 0.55, 0.02);
  group.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.148, 8, 5), hairMaterial);
  hair.scale.set(1.02, 0.55, 0.98);
  hair.position.set(0, 0.62, -0.005);
  group.add(hair);
  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.36, 0.13), packMaterial);
  backpack.position.set(0, 0.04, -0.19);
  group.add(backpack);
  const armPivots: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.225, 0.22, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.28, 2, 5), side === 1 ? trimMaterial : bodyMaterial);
    arm.position.y = -0.145;
    pivot.add(arm);
    group.add(pivot);
    armPivots.push(pivot);
  }
  const legPivots: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.095, -0.25, 0);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.28, 2, 5), legMaterial);
    leg.position.y = -0.20;
    pivot.add(leg);
    group.add(pivot);
    legPivots.push(pivot);
  }
  const flame = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 6, 5),
    new THREE.MeshBasicMaterial({ color: 0xffc857 }),
  );
  flame.position.set(0.30, -0.16, 0.08);
  group.add(flame);
  // Crowd LOD deliberately avoids per-avatar point lights and shadow-map passes.
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = false;
      object.receiveShadow = false;
    }
  });
  const update = (lightLevel: number, elapsedSeconds: number, deltaSeconds: number, moving: boolean) => {
    const gait = moving ? Math.sin(elapsedSeconds * 9.5) : 0;
    body.rotation.z = moving ? Math.sin(elapsedSeconds * 9.5) * 0.025 : 0;
    head.rotation.y = Math.sin(elapsedSeconds * 0.65) * 0.025;
    armPivots[0].rotation.x = gait * 0.30;
    armPivots[1].rotation.x = gait * 0.07;
    legPivots[0].rotation.x = gait * 0.5;
    legPivots[1].rotation.x = -gait * 0.5;
    flame.visible = lightLevel > 0;
    void deltaSeconds;
  };
  return {
    group,
    update,
    dispose() {
      group.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const material of materials) material.dispose();
        }
      });
    },
  };
}
export function createPlayerCharacter(identity: string, local = false, lowDetailRemote = false): PlayerCharacterVisual {
  const palette = paletteFor(identity, local);
  if (!local && lowDetailRemote) return createLowDetailRemoteCharacter(identity, palette);
  const group = new THREE.Group();
  group.name = local ? 'player-character-local' : `player-character-${identity}`;

  // The root is centered at the avatar's hips. The network transform remains unchanged.
  const torso = new THREE.Group();
  torso.position.set(0, 0.03, 0);
  group.add(torso);
  addMesh(torso, capsule(0.235, 0.48, palette.jacket), [0, 0.06, 0]);
  addMesh(torso, box([0.24, 0.12, 0.07], palette.trim), [0, -0.12, 0.205]);
  addMesh(torso, box([0.055, 0.44, 0.07], palette.trim), [-0.115, 0.045, 0.205]);

  const neck = new THREE.Group();
  neck.position.set(0, 0.39, 0.015);
  torso.add(neck);
  addMesh(neck, sphere(0.085, palette.skin, 10), [0, 0, 0]);

  const head = new THREE.Group();
  head.position.set(0, 0.56, 0.02);
  group.add(head);
  addMesh(head, sphere(0.16, palette.skin, 14), [0, 0, 0.025]);
  addMesh(head, sphere(0.165, palette.hair, 12), [0, 0.085, -0.012], [1.02, 0.55, 0.98]);
  addMesh(head, sphere(0.045, palette.hair, 10), [-0.118, 0.015, 0.005], [0.65, 1.0, 0.7]);
  const eyeMaterial = standard(0x25211e, 0.65);
  for (const x of [-0.052, 0.052]) {
    addMesh(head, new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), eyeMaterial), [x, -0.018, 0.176]);
  }

  const armPivots: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.235, 0.22, 0);
    group.add(pivot);
    addMesh(pivot, capsule(0.07, 0.31, palette.jacket), [0, -0.17, 0]);
    addMesh(pivot, sphere(0.064, palette.skin, 8), [0, -0.36, 0.025]);
    armPivots.push(pivot);
  }

  const legPivots: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.105, -0.27, 0);
    group.add(pivot);
    addMesh(pivot, capsule(0.082, 0.31, palette.trousers), [0, -0.19, 0]);
    addMesh(pivot, box([0.15, 0.08, 0.24], 0x282a28), [0, -0.44, 0.055]);
    legPivots.push(pivot);
  }

  // Compact travel pack and shoulder straps make the player distinct from local residents.
  addMesh(group, box([0.34, 0.43, 0.16], palette.backpack), [0, 0.02, -0.22]);
  addMesh(group, box([0.18, 0.12, 0.04], palette.trim), [0, -0.11, -0.31]);
  for (const side of [-1, 1]) {
    const strap = box([0.055, 0.4, 0.045], palette.trim);
    addMesh(group, strap, [side * 0.16, 0.07, 0.13]).rotation.z = side * -0.22;
  }

  // A small carried diya warms up as the neighbourhood regains its light.
  const lantern = new THREE.Group();
  lantern.position.set(0.035, -0.37, 0.09);
  armPivots[1].add(lantern);
  const bowlMaterial = standard(0x956438, 0.58, 0.12);
  addMesh(lantern, new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), bowlMaterial), [0, -0.01, 0.015], [1, 0.42, 0.9]);
  const flameMaterial = new THREE.MeshBasicMaterial({ color: 0xffc857, transparent: true, opacity: 0 });
  const heldFlame = addMesh(lantern, new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), flameMaterial), [0, 0.045, 0.015], [0.72, 1.7, 0.72]);
  const lanternLight = new THREE.PointLight(0xffb84d, 0, 2.8, 2);
  lanternLight.position.set(0, 0.08, 0.03);
  lantern.add(lanternLight);

  // Remote avatars can be numerous. Keep primitive avatar parts out of shadow-map passes.
  // The local avatar and authored/procedural environment retain their existing shadows.
  if (!local) {
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = false;
        object.receiveShadow = false;
      }
    });
  }

  const update = (lightLevel: number, elapsedSeconds: number, deltaSeconds: number, moving: boolean) => {
    const activity = THREE.MathUtils.smoothstep(lightLevel, 0, 45);
    const gait = moving ? Math.sin(elapsedSeconds * 9.5) : 0;
    torso.position.y = 0.03 + Math.sin(elapsedSeconds * (moving ? 19 : 2.2)) * (moving ? 0.018 : 0.006);
    head.rotation.y = Math.sin(elapsedSeconds * 0.65) * 0.025;
    head.rotation.x = moving ? Math.sin(elapsedSeconds * 9.5) * 0.018 : Math.sin(elapsedSeconds * 1.3) * 0.008;
    armPivots[0].rotation.x = gait * (moving ? 0.3 : 0.025);
    armPivots[1].rotation.x = gait * (moving ? 0.07 : 0.012);
    armPivots[0].rotation.z = Math.sin(elapsedSeconds * (moving ? 9.5 : 1.5)) * (moving ? 0.07 : 0.018);
    armPivots[1].rotation.z = -0.08 + Math.sin(elapsedSeconds * (moving ? 9.5 : 1.4) + 1) * (moving ? 0.025 : 0.012);
    legPivots[0].rotation.x = gait * (moving ? 0.62 : 0.015);
    legPivots[1].rotation.x = -gait * (moving ? 0.62 : 0.015);
    lantern.rotation.z = -0.08 + Math.sin(elapsedSeconds * (moving ? 9.5 : 1.9)) * (moving ? 0.035 : 0.012);
    lantern.rotation.x = Math.sin(elapsedSeconds * 2.0) * 0.025;
    heldFlame.material.opacity = activity;
    heldFlame.scale.y = 1.5 + Math.sin(elapsedSeconds * 11) * 0.15;
    lanternLight.intensity = activity * (local ? 0.75 : 0.42) * (0.9 + Math.sin(elapsedSeconds * 7) * 0.07);
    lanternLight.distance = 1.8 + activity * 1.6;
    void deltaSeconds;
  };

  return {
    group,
    update,
    dispose() {
      group.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const current of materials) current.dispose();
        }
      });
    },
  };
}
