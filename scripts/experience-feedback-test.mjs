import assert from 'node:assert/strict';
import { createFeedbackMessage, feedbackClassName, shouldReduceFeedbackMotion } from '../apps/game/src/world/experience-feedback.ts';

const success = createFeedbackMessage('The flame is shared.', 'success');
assert.deepEqual(success, { text: 'The flame is shared.', tone: 'success', durationMs: 2200 });
assert.equal(feedbackClassName('warning'), 'experience-feedback experience-feedback-warning');
assert.equal(shouldReduceFeedbackMotion(true), true);
assert.equal(shouldReduceFeedbackMotion(false), false);
console.log('experience feedback regression: ok');
