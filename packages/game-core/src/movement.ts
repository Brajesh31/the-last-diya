export interface MovementObstacle {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const PLAYER_COLLISION_RADIUS = 0.34;

// Keep these rectangles aligned with the procedural benches, stalls and temple platform
// in apps/game/src/world/player-collision.ts.
export const MOVEMENT_OBSTACLES: MovementObstacle[] = [
  { minX: -3.01, maxX: -2.59, minZ: 3.6, maxZ: 5.4 },
  { minX: 2.59, maxX: 3.01, minZ: -6.4, maxZ: -4.6 },
  { minX: -3.01, maxX: -2.59, minZ: -14.9, maxZ: -13.1 },
  { minX: 2.85, maxX: 3.2, minZ: -9.35, maxZ: -7.05 },
  { minX: -3.2, maxX: -2.85, minZ: -11.95, maxZ: -9.65 },
  { minX: 2.85, maxX: 3.2, minZ: -18.15, maxZ: -16.25 },
];

export function isWalkablePosition(x: number, z: number, darkDistrictUnlocked: boolean): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  const minZ = darkDistrictUnlocked ? -27 : -19;
  if (x < -3.2 || x > 3.2 || z < minZ || z > 19) return false;

  return !MOVEMENT_OBSTACLES.some((obstacle) => {
    const closestX = Math.max(obstacle.minX, Math.min(obstacle.maxX, x));
    const closestZ = Math.max(obstacle.minZ, Math.min(obstacle.maxZ, z));
    const dx = x - closestX;
    const dz = z - closestZ;
    return dx * dx + dz * dz < PLAYER_COLLISION_RADIUS * PLAYER_COLLISION_RADIUS;
  });
}
