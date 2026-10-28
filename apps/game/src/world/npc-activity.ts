import * as THREE from 'three';
import type { NpcDefinition } from '@the-last-diya/game-core';

export interface NPCActivityEntry {
  npc: NpcDefinition;
  group: THREE.Group;
  index: number;
  home: THREE.Vector3;
  target: THREE.Vector3;
  speed: number;
  phase: number;
  active: boolean;
}

const WANDER_OFFSETS = [
  new THREE.Vector3(1.4, 0, 1.2),
  new THREE.Vector3(-1.3, 0, 1.5),
  new THREE.Vector3(1.8, 0, -1.1),
  new THREE.Vector3(-1.6, 0, -1.2),
  new THREE.Vector3(0.8, 0, 1.8),
];

const scratchDirection = new THREE.Vector3();
const scratchOffset = new THREE.Vector3();

function chooseTarget(entry: NPCActivityEntry, lightLevel: number) {
  const offset = WANDER_OFFSETS[entry.index % WANDER_OFFSETS.length];
  const marketBias = lightLevel >= 50 && entry.npc.id !== 'temple-caretaker' ? 1 : 0;
  scratchOffset.copy(offset).multiplyScalar(0.55 + marketBias * 0.35);
  entry.target.copy(entry.home).add(scratchOffset);
  entry.target.y = 0;
  entry.phase = Math.random() * Math.PI * 2;
}

export function createNPCActivity(entries: NPCActivityEntry[]) {
  for (const entry of entries) {
    entry.home = entry.group.position.clone();
    entry.target = entry.home.clone();
    entry.speed = 0.45 + (entry.index % 3) * 0.08;
    entry.phase = entry.index * 1.7;
  }

  return {
    update(lightLevel: number, elapsedSeconds: number, deltaSeconds = 1 / 60) {
      const activity = THREE.MathUtils.smoothstep(lightLevel, 10, 85);
      for (const entry of entries) {
        const shouldMove = activity > 0.18;
        entry.active = shouldMove;
        const body = entry.group.children[0] as THREE.Mesh | undefined;
        if (body) body.position.y = 0.7 + Math.sin(elapsedSeconds * 3 + entry.phase) * 0.018;

        if (!shouldMove) {
          entry.group.position.lerp(entry.home, 0.08);
          continue;
        }

        if (entry.group.position.distanceTo(entry.target) < 0.18) chooseTarget(entry, lightLevel);

        scratchDirection.copy(entry.target).sub(entry.group.position);
        scratchDirection.y = 0;
        if (scratchDirection.lengthSq() > 0.0001) {
          scratchDirection.normalize();
          entry.group.position.addScaledVector(scratchDirection, entry.speed * (0.55 + activity) * deltaSeconds);
          entry.group.rotation.y = THREE.MathUtils.lerp(entry.group.rotation.y, Math.atan2(scratchDirection.x, scratchDirection.z), 0.08);
        }
      }
    },
  };
}
