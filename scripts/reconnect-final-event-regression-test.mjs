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
finalEvent = updateFinalEventReadiness(finalEvent, 100, 2);
assert.equal(finalEvent.state, 'ready');
assert.equal(finalEvent.participantCount, 2);
finalEvent = beginFinalEvent(finalEvent);
assert.equal(finalEvent.state, 'starting');
finalEvent = beginCelebration(finalEvent);
assert.equal(finalEvent.state, 'celebrating');
finalEvent = completeFinalEvent(finalEvent, 9000);
assert.equal(finalEvent.state, 'completed');
assert.equal(finalEvent.completedAt, 9000);

console.log('reconnect/final-event regression: ok');
