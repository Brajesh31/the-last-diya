import assert from 'node:assert/strict';
import { createReconnectState, markDisconnected, markRestored, markOffline, recoveryMessage } from '../apps/game/src/world/reconnect-state.ts';
import { createFinalEventProgress, updateFinalEventReadiness, beginFinalEvent, beginCelebration, completeFinalEvent } from '../apps/game/src/world/final-event-state.ts';

const reconnect = createReconnectState();
assert.equal(reconnect.phase, 'online');
markDisconnected(reconnect, 1000);
assert.equal(reconnect.phase, 'reconnecting');
assert.equal(reconnect.attempts, 1);
assert.equal(reconnect.lastDisconnectAt, 1000);
assert.match(recoveryMessage(reconnect), /reconnecting/i);
markRestored(reconnect, 2500);
assert.equal(reconnect.phase, 'restored');
assert.equal(reconnect.restoredAt, 2500);
assert.match(recoveryMessage(reconnect), /restored/i);
markOffline(reconnect);
assert.equal(reconnect.phase, 'offline');
assert.match(recoveryMessage(reconnect), /offline/i);

let finalEvent = createFinalEventProgress(0);
assert.equal(finalEvent.state, 'locked');
assert.equal(finalEvent.completedAt, null);
assert.deepEqual(beginFinalEvent(finalEvent), finalEvent, 'locked final event cannot start early');
assert.deepEqual(beginCelebration(finalEvent), finalEvent, 'locked final event cannot celebrate early');

finalEvent = updateFinalEventReadiness(finalEvent, 100, 2);
assert.equal(finalEvent.state, 'ready');
assert.equal(finalEvent.lightLevel, 100);
assert.equal(finalEvent.participantCount, 2);
finalEvent = beginFinalEvent(finalEvent);
assert.equal(finalEvent.state, 'starting');
finalEvent = beginCelebration(finalEvent);
assert.equal(finalEvent.state, 'celebrating');
finalEvent = completeFinalEvent(finalEvent, 9000);
assert.equal(finalEvent.state, 'completed');
assert.equal(finalEvent.completedAt, 9000);

// Re-entry/readiness updates must never reopen a completed community event.
const completedSnapshot = updateFinalEventReadiness(finalEvent, 100, 3);
assert.equal(completedSnapshot.state, 'completed');
assert.equal(completedSnapshot.completedAt, 9000);
assert.equal(completedSnapshot.participantCount, 3);
assert.deepEqual(beginFinalEvent(completedSnapshot), completedSnapshot, 'completed event cannot restart');
assert.deepEqual(beginCelebration(completedSnapshot), completedSnapshot, 'completed event cannot re-enter celebration');
assert.deepEqual(completeFinalEvent(completedSnapshot, 12000), completedSnapshot, 'completed timestamp is immutable');

console.log('reconnect/final-event regression: ok');
