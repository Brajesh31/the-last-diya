import assert from 'node:assert/strict';
import { decodeMessage, encodeMessage } from '../packages/networking/src/index.ts';

const supportedMessages = [
  { type: 'hello', clientVersion: 'protocol-test' },
  { type: 'join_room', roomId: 'main-street' },
  { type: 'player_state', transform: { x: 0, y: 0.75, z: 4, rotation: 0 } },
  { type: 'interact_request', targetId: 'diya-main-street-01' },
  { type: 'share_flame_request', targetPlayerId: 'player-2' },
  { type: 'pickup_request', targetId: 'market-stall-01' },
  { type: 'memory_continue', memoryId: 'temple-memory-01' },
  { type: 'final_event_ready' },
  { type: 'ping', timestamp: Date.now() },
];

for (const message of supportedMessages) {
  const encoded = encodeMessage(message);
  const decoded = decodeMessage(encoded);
  assert.deepEqual(decoded, message, `round-trip failed for ${message.type}`);
}

const malformed = [
  '',
  'null',
  '[]',
  '{}',
  '{"type":null}',
  '{"type":42}',
  '{"type":"unknown"}',
];
for (const raw of malformed) assert.equal(decodeMessage(raw), null, `malformed payload accepted: ${raw}`);

const serverMessages = [
  { type: 'pong', timestamp: 123 },
  { type: 'error', code: 'INVALID_MESSAGE', message: 'invalid' },
  { type: 'session_assigned', sessionToken: 'session', playerId: 'player-1', roomId: 'main-street', transform: { x: 0, y: 0.75, z: 4, rotation: 0 }, restored: false },
  { type: 'light_update', level: 10, source: 'player-1' },
  { type: 'flame_shared', fromPlayerId: 'player-1', toPlayerId: 'player-2', lightLevel: 15 },
];
for (const message of serverMessages) assert.deepEqual(decodeMessage(encodeMessage(message)), message, `server round-trip failed for ${message.type}`);

console.log(`PASS protocol compatibility | ${supportedMessages.length} client messages | ${serverMessages.length} server messages | malformed payload guards`);
