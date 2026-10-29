import * as THREE from 'three';
import type { NpcDefinition, NpcId } from '@the-last-diya/game-core';

export interface NPCActivityEntry {
  npc: NpcDefinition;
  group: THREE.Group;
  index: number;
  order: number;
  home: THREE.Vector3;
  target: THREE.Vector3;
  speed: number;
  phase: number;
  active: boolean;
}

const ACTIVITY_START: Record<NpcId, number> = {
  'sharma-aunty': 8,
  'mithai-seller': 22,
  'chai-seller': 28,
  'temple-caretaker': 52,
  'unknown-stranger': 76,
};

const ACTIVITY_OFFSETS: Record<NpcId, THREE.Vector3[]> = {
  'sharma-aunty': [
    new THREE.Vector3(-0.65, 0, 0.45),
    new THREE.Vector3(0.7, 0, 0.5),
    new THREE.Vector3(0.4, 0, -0.6),
    new THREE.Vector3(-0.5, 0, -0.35),
  ],
  'mithai-seller': [
    new THREE.Vector3(-0.75, 0, 0.5),
    new THREE.Vector3(0.7, 0, 0.65),
    new THREE.Vector3(0.45, 0, -0.8),
    new THREE.Vector3(-0.5, 0, -0.6),
  ],
  'chai-seller': [
    new THREE.Vector3(-0.7, 0, 0.5),
    new THREE.Vector3(0.6, 0, 0.45),
    new THREE.Vector3(0.5, 0, -0.65),
    new THREE.Vector3(-0.55, 0, -0.5),
  ],
  'temple-caretaker': [
    new THREE.Vector3(-0.35, 0, 0.35),
    new THREE.Vector3(0.35, 0, 0.25),
    new THREE.Vector3(0.25, 0, -0.4),
  ],
  'unknown-stranger': [
    new THREE.Vector3(-0.4, 0, 0.25),
    new THREE.Vector3(0.35, 0, 0.3),
    new THREE.Vector3(0.25, 0, -0.4),
    new THREE.Vector3(-0.3, 0, -0.25),
  ],
};

const FINALE_TARGETS: Record<NpcId, THREE.Vector3> = {
  'sharma-aunty': new THREE.Vector3(-2.8, 0, -22.4),
  'mithai-seller': new THREE.Vector3(2.8, 0, -22.4),
  'chai-seller': new THREE.Vector3(-1.25, 0, -23.6),
  'temple-caretaker': new THREE.Vector3(1.25, 0, -23.6),
  'unknown-stranger': new THREE.Vector3(0, 0, -21.7),
};

const scratchDirection = new THREE.Vector3();
const scratchOffset = new THREE.Vector3();

function chooseTarget(entry: NPCActivityEntry, lightLevel: number, elapsedSeconds: number) {
  const offsets = ACTIVITY_OFFSETS[entry.npc.id];
  const routeIndex = Math.floor(elapsedSeconds * 0.32 + entry.order * 1.7) % offsets.length;
  scratchOffset.copy(offsets[routeIndex]);
  const activity = THREE.MathUtils.smoothstep(
    lightLevel,
    ACTIVITY_START[entry.npc.id],
    Math.min(100, ACTIVITY_START[entry.npc.id] + 25),
  );
  const marketBoost = lightLevel >= 50 && (entry.npc.id === 'mithai-seller' || entry.npc.id === 'chai-seller') ? 1.18 : 1;
  entry.target.copy(entry.home).addScaledVector(scratchOffset, (0.65 + activity * 0.35) * marketBoost);
  entry.target.y = 0;
  entry.phase = elapsedSeconds + entry.order * 1.7;
}

function chooseFinaleTarget(entry: NPCActivityEntry, elapsedSeconds: number) {
  entry.target.copy(FINALE_TARGETS[entry.npc.id]);
  entry.target.x += Math.sin(elapsedSeconds * 0.38 + entry.order) * 0.28;
  entry.target.z += Math.cos(elapsedSeconds * 0.31 + entry.order * 0.7) * 0.18;
  entry.target.y = 0;
}

export function createNPCActivity(entries: NPCActivityEntry[]) {
  for (const entry of entries) {
    entry.home = entry.group.position.clone();
    entry.target = entry.home.clone();
    entry.speed = entry.npc.id === 'unknown-stranger' ? 0.28 : entry.npc.id === 'temple-caretaker' ? 0.34 : 0.45 + (entry.order % 3) * 0.06;
    entry.phase = entry.order * 1.7;
  }

  return {
    update(lightLevel: number, elapsedSeconds: number, deltaSeconds = 1 / 60) {
      const finale = lightLevel >= 100;

      for (const entry of entries) {
        const start = ACTIVITY_START[entry.npc.id];
        const activity = THREE.MathUtils.smoothstep(lightLevel, start, Math.min(100, start + 28));
        const shouldMove = finale || activity > 0.18;
        entry.active = shouldMove;

        const body = entry.group.children[0] as THREE.Mesh | undefined;
        if (body) {
          const celebrationBob = finale ? 0.018 : 0.012 + activity * 0.008;
          body.position.y = 0.7 + Math.sin(elapsedSeconds * (finale ? 3.1 : 2.6) + entry.phase) * celebrationBob;
        }

        if (!shouldMove) {
          entry.group.position.lerp(entry.home, 1 - Math.exp(-5 * deltaSeconds));
          continue;
        }

        if (finale) {
          if (entry.group.position.distanceTo(entry.target) < 0.28 || entry.target.distanceTo(FINALE_TARGETS[entry.npc.id]) > 0.8) {
            chooseFinaleTarget(entry, elapsedSeconds);
          }
        } else if (entry.group.position.distanceTo(entry.target) < 0.14) {
          chooseTarget(entry, lightLevel, elapsedSeconds);
        }

        scratchDirection.copy(entry.target).sub(entry.group.position);
        scratchDirection.y = 0;
        if (scratchDirection.lengthSq() > 0.0001) {
          scratchDirection.normalize();
          const speedMultiplier = finale ? 0.72 : 0.45 + activity * 0.75;
          entry.group.position.addScaledVector(scratchDirection, entry.speed * speedMultiplier * deltaSeconds);
          entry.group.rotation.y = THREE.MathUtils.lerp(
            entry.group.rotation.y,
            Math.atan2(scratchDirection.x, scratchDirection.z),
            Math.min(1, deltaSeconds * 6),
          );
        } else if (finale) {
          entry.group.rotation.y += Math.sin(elapsedSeconds * 0.8 + entry.order) * deltaSeconds * 0.08;
        }
      }
    },
  };
}
