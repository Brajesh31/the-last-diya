import assert from 'node:assert/strict';
import * as THREE from 'three';
import { movePlayerWithCollision } from '../apps/game/src/world/player-collision.ts';

function move(x, z, dx, dz, distance, darkDistrictUnlocked = false) {
  const position = new THREE.Vector3(x, 0.75, z);
  const direction = new THREE.Vector3(dx, 0, dz);
  if (direction.lengthSq() > 0) direction.normalize();
  movePlayerWithCollision(position, direction, distance, darkDistrictUnlocked);
  return position;
}

// Market pickups and the temple memory marker must remain reachable from the street.
for (const [name, x, z, startX] of [
  ['market stall 1', 2.5, -8, 2.1],
  ['market stall 2', -2.5, -9.5, -2.1],
  ['market stall 3', 2.5, -11, 2.1],
  ['temple memory', 2.5, -17, 2.1],
]) {
  const direction = x > startX ? 1 : -1;
  const position = move(startX, z, direction, 0, Math.abs(x - startX));
  assert.ok(Math.abs(position.x - x) < 0.001, `${name} interaction point should be reachable`);
}

// A bench blocks direct movement, but axis separation allows sliding around it.
const blocked = move(2.2, -5.5, 1, 0, 0.8);
assert.ok(blocked.x < 2.6, 'avatar must not pass through the bench');

const slidingDirection = new THREE.Vector3(1, 0, 1).normalize();
const slidingPosition = new THREE.Vector3(2.2, 0.75, -5.5);
movePlayerWithCollision(slidingPosition, slidingDirection, 0.8, false);
assert.ok(slidingPosition.x < 2.6, 'diagonal movement should remain outside the bench');
assert.ok(slidingPosition.z > -5.5, 'diagonal movement should slide along the bench');

const lockedGate = move(0, -18.8, 0, -1, 1, false);
assert.equal(lockedGate.z, -19, 'locked district boundary should stop the player');
const unlockedGate = move(0, -18.8, 0, -1, 1, true);
assert.ok(unlockedGate.z < -19, 'unlocked district should allow movement beyond the gate');

console.log('PASS player collision | pickup hotspots reachable | prop collision | sliding | gate bounds');
