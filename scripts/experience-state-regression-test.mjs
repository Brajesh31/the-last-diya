import assert from 'node:assert/strict';
import {
  connectionLabel,
  createReconnectExperienceState,
  markConnectionOffline,
  markReconnectStarted,
  markSessionRestored,
} from '../apps/game/src/world/reconnect-experience.ts';
import {
  beginCelebration,
  beginFinalEvent,
  completeFinalEvent,
  createFinalEventProgress,
  updateFinalEventReadiness,
} from '../apps/game/src/world/final-event-state.ts';

const reconnect = createReconnectExperienceState();
assert.equal(reconnect.state, 'connected');
const retrying = markReconnectStarted(reconnect, 1000);
assert.equal(retrying.state, 'reconnecting');
assert.equal(retrying.sessionRestorePending, true);
assert.equal(retrying.nextRetryAt, 1500);
const retryingAgain = markReconnectStarted(retrying, 2000);
assert.equal(retryingAgain.nextRetryAt, 3000);
const restored = markSessionRestored(retryingAgain);
assert.equal(restored.state, 'restored');
assert.equal(restored.sessionRestorePending, false);
assert.equal(connectionLabel(restored.state), 'SESSION RESTORED');
assert.equal(markConnectionOffline(restored).state, 'offline');

let finalEvent = createFinalEventProgress(85);
assert.equal(finalEvent.state, 'locked');
finalEvent = updateFinalEventReadiness(finalEvent, 100, 2);
assert.equal(finalEvent.state, 'ready');
assert.equal(finalEvent.participantCount, 2);
finalEvent = beginFinalEvent(finalEvent);
assert.equal(finalEvent.state, 'starting');
finalEvent = beginCelebration(finalEvent);
assert.equal(finalEvent.state, 'celebrating');
finalEvent = completeFinalEvent(finalEvent, 5000);
assert.equal(finalEvent.state, 'completed');
assert.equal(finalEvent.completedAt, 5000);
assert.equal(beginFinalEvent(finalEvent).state, 'completed');

console.log('PASS experience state regression | reconnect recovery | final event lifecycle');
