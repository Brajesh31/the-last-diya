import WebSocket from 'ws';

const url = process.env.GAME_SERVER_URL ?? 'ws://127.0.0.1:8787';
const roomId = `quest-test-${Date.now()}`;
const timeoutMs = Number(process.env.TIMEOUT_MS ?? 10000);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const socket = new WebSocket(url);
const messages = [];
const waitFor = (type, predicate = () => true) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`timeout waiting for ${type}`)), timeoutMs);
  const check = (message) => {
    if (message.type === type && predicate(message)) {
      clearTimeout(timer);
      resolve(message);
    }
  };
  messages.push(check);
});

socket.on('message', (raw) => {
  const message = JSON.parse(raw.toString());
  for (const check of messages.splice(0)) check(message);
});

await new Promise((resolve, reject) => {
  socket.once('open', resolve);
  socket.once('error', reject);
});

const send = (message) => socket.send(JSON.stringify(message));
send({ type: 'hello', clientVersion: 'quest-smoke' });
send({ type: 'join_room', roomId });
await waitFor('session_assigned');
await waitFor('quest_update', (message) => message.quests?.[0]?.id === 'first-flame');

send({ type: 'pickup_request', targetId: 'market-stall-01' });
const locked = await waitFor('error', (message) => message.code === 'QUEST_LOCKED');
if (locked.code !== 'QUEST_LOCKED') throw new Error('locked quest gate failed');

send({ type: 'player_state', transform: { x: 0, y: 0.75, z: -4, rotation: 0 } });
await wait(120);
send({ type: 'interact_request', targetId: 'diya-main-street-01' });
await waitFor('interaction_result', (message) => message.targetId === 'diya-main-street-01' && message.success);
const firstQuest = await waitFor('quest_update', (message) => message.quests?.some((quest) => quest.id === 'help-sharma-aunty' && quest.status === 'available'));
if (!firstQuest.quests.some((quest) => quest.id === 'help-sharma-aunty' && quest.status === 'available')) throw new Error('quest 2 did not unlock');

send({ type: 'player_state', transform: { x: -2.5, y: 0.75, z: -1, rotation: 0 } });
await wait(120);
send({ type: 'pickup_request', targetId: 'sharma-doorway-01' });
await waitFor('quest_update', (message) => message.quests?.some((quest) => quest.id === 'market-lights' && quest.status === 'available'));

for (const [x, z, id] of [[2.5, -8, 'market-stall-01'], [-2.5, -9.5, 'market-stall-02'], [2.5, -11, 'market-stall-03']]) {
  send({ type: 'player_state', transform: { x, y: 0.75, z, rotation: 0 } });
  await wait(120);
  send({ type: 'pickup_request', targetId: id });
  await waitFor('pickup_result', (message) => message.targetId === id && message.success);
}
await waitFor('quest_update', (message) => message.quests?.some((quest) => quest.id === 'temple-memory' && quest.status === 'available'));

send({ type: 'player_state', transform: { x: 2.5, y: 0.75, z: -17, rotation: 0 } });
await wait(120);
send({ type: 'pickup_request', targetId: 'temple-memory-01' });
await waitFor('memory_started');
send({ type: 'memory_continue', memoryId: 'temple-memory-01' });
await waitFor('memory_completed');
await waitFor('quest_update', (message) => message.quests?.some((quest) => quest.id === 'last-diya' && quest.status === 'available'));

console.log('PASS vertical slice quest chain | out-of-order blocked | rewards enabled | final quest unlocked');
socket.close();
