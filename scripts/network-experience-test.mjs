import assert from 'node:assert/strict';
import * as THREE from 'three';
import { applyPong, createNetworkExperienceState, interpolateRemoteTransform, shouldSendPing } from '../apps/game/src/world/network-experience.ts';

const state = createNetworkExperienceState();
assert.equal(state.latencyMs, null);
assert.equal(shouldSendPing(state, 0), false);
assert.equal(shouldSendPing(state, 3000), true);
assert.equal(shouldSendPing(state, 3500), false);
assert.equal(applyPong(state, 3000, 3042), 42);
assert.equal(state.latencyMs, 42);

const current = new THREE.Vector3(0, 0, 0);
const target = new THREE.Vector3(10, 0, 0);
const result = interpolateRemoteTransform(current, target, 0, Math.PI, 0.1);
assert.ok(current.x > 0 && current.x < 10);
assert.ok(result.rotation > 0 && result.rotation < Math.PI);

console.log('network experience regression: ok');
