import * as THREE from 'three';
import type { NpcDefinition, NpcId } from '@the-last-diya/game-core';

export interface NPCCharacterVisual {
  group: THREE.Group;
  update(lightLevel: number, elapsedSeconds: number, deltaSeconds: number, moving: boolean): void;
  dispose(): void;
}

interface Palette {
  body: number;
  accent: number;
  secondary: number;
  skin: number;
  hair: number;
  metal: number;
}

const PALETTES: Record<NpcId, Palette> = {
  'sharma-aunty': { body: 0x9a5548, accent: 0x713b38, secondary: 0xc18b5b, skin: 0xa97659, hair: 0x4d4038, metal: 0xc69a52 },
  'mithai-seller': { body: 0xd8c7a6, accent: 0x35664e, secondary: 0xc98537, skin: 0x996b50, hair: 0x3e3027, metal: 0xc69a52 },
  'chai-seller': { body: 0x367b78, accent: 0xd6a453, secondary: 0xa9c5b8, skin: 0xb17f60, hair: 0x332820, metal: 0xb7b7ab },
  'temple-caretaker': { body: 0xa7834e, accent: 0xd7c6a4, secondary: 0x6c5541, skin: 0x9b7155, hair: 0x766b5b, metal: 0x9f8d70 },
  'unknown-stranger': { body: 0x313b4b, accent: 0x202735, secondary: 0x596271, skin: 0x8c7465, hair: 0x25262a, metal: 0x626775 },
};

function standard(color: number, roughness = 0.86, metalness = 0) {
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

function box(size: [number, number, number], color: number) {
  return new THREE.Mesh(new THREE.BoxGeometry(...size), standard(color));
}

function sphere(radius: number, color: number, segments = 12) {
  return new THREE.Mesh(new THREE.SphereGeometry(radius, segments, Math.max(8, segments - 2)), standard(color));
}

function capsule(radius: number, length: number, color: number) {
  return new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 3, 8), standard(color));
}

export function createNPCCharacter(npc: NpcDefinition): NPCCharacterVisual {
  const palette = PALETTES[npc.id];
  const group = new THREE.Group();
  group.name = `npc-character-${npc.id}`;

  // Keep the body as the first child: the NPC activity controller animates it.
  const body = capsule(0.29, 0.62, palette.body);
  addMesh(group, body, [0, 0.72, 0]);

  const head = new THREE.Group();
  head.position.set(0, 1.45, 0.015);
  group.add(head);
  addMesh(head, sphere(0.175, palette.skin, 14), [0, 0, 0.015]);
  addMesh(head, sphere(0.178, palette.hair, 12), [0, 0.095, -0.018], [1.03, 0.55, 1.02]);

  const eyeMaterial = standard(0x29231f, 0.7);
  for (const x of [-0.06, 0.06]) {
    addMesh(head, new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), eyeMaterial), [x, -0.012, 0.169]);
  }
  addMesh(head, sphere(0.025, palette.skin, 8), [0, -0.035, 0.18], [0.7, 0.8, 0.7]);

  const armPivots: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.27, 1.0, 0);
    group.add(pivot);
    const arm = capsule(0.075, 0.36, npc.id === 'unknown-stranger' ? palette.accent : palette.body);
    arm.rotation.z = side * -0.12;
    addMesh(pivot, arm, [0, -0.22, 0]);
    addMesh(pivot, sphere(0.075, palette.skin, 8), [side * -0.01, -0.45, 0.015]);
    armPivots.push(pivot);
  }

  for (const side of [-1, 1]) {
    addMesh(group, capsule(0.085, 0.22, palette.secondary), [side * 0.115, 0.19, 0.005]);
    addMesh(group, box([0.16, 0.07, 0.25], 0x302820), [side * 0.115, 0.055, 0.035]);
  }

  // Layered clothing makes each role readable from the third-person camera.
  const frontPanel = box(
    npc.id === 'sharma-aunty' ? [0.25, 0.63, 0.065] : [0.36, 0.48, 0.06],
    palette.accent,
  );
  addMesh(group, frontPanel, [npc.id === 'sharma-aunty' ? -0.075 : 0, 0.75, 0.258]);
  if (npc.id === 'sharma-aunty') {
    frontPanel.rotation.z = -0.22;
    addMesh(group, box([0.13, 0.58, 0.075], palette.secondary), [0.16, 0.77, 0.255]).rotation.z = 0.12;
    addMesh(head, sphere(0.09, palette.hair, 10), [0, 0.025, -0.14], [1.1, 0.9, 0.95]);
    for (const x of [-0.18, 0.18]) addMesh(head, sphere(0.025, palette.metal, 8), [x, -0.03, 0.03]);
  } else if (npc.id === 'mithai-seller') {
    addMesh(group, box([0.31, 0.35, 0.045], palette.secondary), [0, 0.5, 0.292]);
    addMesh(head, sphere(0.22, palette.secondary, 12), [0, 0.18, 0], [1.0, 0.46, 0.95]);
    addMesh(head, sphere(0.18, palette.secondary, 12), [0, 0.225, -0.015], [0.95, 0.52, 0.95]);
    const tray = new THREE.Group();
    tray.position.set(0.33, 0.83, 0.16);
    tray.rotation.z = -0.12;
    addMesh(tray, new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.035, 12), standard(0xb8a17b, 0.45, 0.25)), [0, 0, 0]);
    for (const [x, z] of [[-0.07, 0], [0, 0.035], [0.07, 0]] as [number, number][]) {
      addMesh(tray, sphere(0.04, 0xd8a15a, 8), [x, 0.035, z]);
    }
    group.add(tray);
  } else if (npc.id === 'chai-seller') {
    const scarf = box([0.115, 0.72, 0.075], palette.secondary);
    addMesh(group, scarf, [0.13, 0.79, 0.255]).rotation.z = -0.24;
    addMesh(head, sphere(0.085, palette.hair, 10), [0.02, 0.055, -0.14], [1.1, 0.9, 0.95]);
    const kettle = new THREE.Group();
    kettle.position.set(-0.34, 0.68, 0.09);
    kettle.rotation.z = -0.18;
    addMesh(kettle, new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.14, 10), standard(0x8e958f, 0.45, 0.38)), [0, 0, 0]);
    addMesh(kettle, new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.1, 8), standard(0x8e958f, 0.45, 0.38)), [0.085, 0.015, 0], [1, 1, 0.8]).rotation.z = -Math.PI / 2;
    addMesh(kettle, new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 10, Math.PI), standard(0x8e958f, 0.45, 0.38)), [0, 0.06, 0]);
    group.add(kettle);
  } else if (npc.id === 'temple-caretaker') {
    const shawl = box([0.14, 0.68, 0.075], palette.accent);
    addMesh(group, shawl, [-0.13, 0.79, 0.25]).rotation.z = 0.23;
    addMesh(head, sphere(0.19, palette.secondary, 12), [0, 0.13, -0.005], [1.1, 0.54, 1.0]);
    addMesh(head, sphere(0.12, palette.hair, 10), [0, -0.105, 0.12], [1.0, 0.9, 0.5]);
  } else {
    const cloak = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 0.76, 8), standard(palette.accent));
    addMesh(group, cloak, [0, 0.44, -0.015]);
    addMesh(head, sphere(0.23, palette.accent, 12), [0, 0.035, -0.02], [1.03, 1.05, 0.92]);
    addMesh(head, sphere(0.14, palette.skin, 12), [0, -0.005, 0.125], [0.9, 1.0, 0.72]);
    addMesh(group, box([0.07, 0.52, 0.08], palette.secondary), [0, 0.74, 0.292]);
  }

  const update = (lightLevel: number, elapsedSeconds: number, deltaSeconds: number, moving: boolean) => {
    const liveliness = THREE.MathUtils.smoothstep(lightLevel, 15, 90);
    head.rotation.y = Math.sin(elapsedSeconds * 0.7 + npc.position.z) * (0.025 + liveliness * 0.035);
    head.position.y = 1.45 + Math.sin(elapsedSeconds * 2.2 + npc.position.x) * 0.008;
    const swing = moving ? 0.22 : 0.035 + liveliness * 0.035;
    armPivots[0].rotation.z = Math.sin(elapsedSeconds * (moving ? 4.4 : 1.7) + 0.5) * swing + 0.04;
    armPivots[1].rotation.z = Math.sin(elapsedSeconds * (moving ? 4.4 : 1.7) + Math.PI + 0.5) * swing - 0.04;
    if (npc.id === 'mithai-seller') {
      const tray = group.children.find((child) => child instanceof THREE.Group && child !== head && armPivots.indexOf(child as THREE.Group) < 0);
      if (tray) tray.rotation.z = -0.12 + Math.sin(elapsedSeconds * 1.4) * 0.025;
    }
    if (npc.id === 'chai-seller') {
      const kettle = group.children.find((child) => child instanceof THREE.Group && child !== head && armPivots.indexOf(child as THREE.Group) < 0);
      if (kettle) kettle.rotation.z = -0.18 + Math.sin(elapsedSeconds * 1.8) * 0.025;
    }
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
