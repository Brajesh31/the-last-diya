import * as THREE from 'three';

interface Obstacle {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

// Walkable-space blockers match the larger props in the current procedural blockout.
// Interaction targets remain reachable from the edges of market and temple structures.
const STATIC_OBSTACLES: Obstacle[] = [
  // Benches, rotated 90 degrees.
  { minX: -3.01, maxX: -2.59, minZ: 3.6, maxZ: 5.4 },
  { minX: 2.59, maxX: 3.01, minZ: -6.4, maxZ: -4.6 },
  { minX: -3.01, maxX: -2.59, minZ: -14.9, maxZ: -13.1 },
  // Market stalls, including a small margin around their canopy and counter.
  { minX: 2.25, maxX: 3.2, minZ: -9.35, maxZ: -7.05 },
  { minX: -3.2, maxX: -2.25, minZ: -11.95, maxZ: -9.65 },
  // Temple platform and canopy. The western edge stays open for the memory interaction.
  { minX: 1.3, maxX: 3.2, minZ: -18.15, maxZ: -16.25 },
];

const PLAYER_RADIUS = 0.34;
const scratchPosition = new THREE.Vector3();

function collides(x: number, z: number, obstacle: Obstacle): boolean {
  const closestX = THREE.MathUtils.clamp(x, obstacle.minX, obstacle.maxX);
  const closestZ = THREE.MathUtils.clamp(z, obstacle.minZ, obstacle.maxZ);
  const dx = x - closestX;
  const dz = z - closestZ;
  return dx * dx + dz * dz < PLAYER_RADIUS * PLAYER_RADIUS;
}

function isBlocked(x: number, z: number, darkDistrictUnlocked: boolean): boolean {
  if (STATIC_OBSTACLES.some((obstacle) => collides(x, z, obstacle))) return true;
  // Keep the gate approach blocked while the district is locked. The open-world bounds
  // below provide the same boundary at z=-19 without a second overlapping collider.
  if (!darkDistrictUnlocked && z < -19) return true;
  return false;
}

/**
 * Applies movement with axis separation to make the avatar slide along props instead
 * of getting stuck on corners. Mutates the existing position to avoid frame allocations.
 */
export function movePlayerWithCollision(
  position: THREE.Vector3,
  direction: THREE.Vector3,
  distance: number,
  darkDistrictUnlocked: boolean,
): void {
  const minZ = darkDistrictUnlocked ? -27 : -19;
  const maxZ = 19;
  const nextX = THREE.MathUtils.clamp(position.x + direction.x * distance, -3.2, 3.2);
  const nextZ = THREE.MathUtils.clamp(position.z + direction.z * distance, minZ, maxZ);

  scratchPosition.copy(position);
  if (!isBlocked(nextX, position.z, darkDistrictUnlocked)) position.x = nextX;
  if (!isBlocked(position.x, nextZ, darkDistrictUnlocked)) position.z = nextZ;

  // Clamp again in case the previous server-restored position was outside current bounds.
  position.x = THREE.MathUtils.clamp(position.x, -3.2, 3.2);
  position.z = THREE.MathUtils.clamp(position.z, minZ, maxZ);
}
