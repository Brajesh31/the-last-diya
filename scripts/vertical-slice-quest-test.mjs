import WebSocket from 'ws';

const url = process.env.GAME_SERVER_URL ?? 'ws://127.0.0.1:8787';
const roomId = `quest-test-${Date.now()}`;
const timeoutMs = Number(process.env.TIMEOUT_MS ?? 10000);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const socket = new WebSocket(url);
const received = [];

socket.on('message', (raw) => received.push(JSON.parse(raw.toString())));
await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });

const send = (message) => socket.send(JSON.stringify(message));
async function waitFor(type, predicate = () => true) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const index = received.findIndex((message) => message.type === type && predicate(message));
    if (index >= 0) return received.splice(index, 1)[0];
    await wait(25);
  }
  throw new Error(`timeout waiting for ${type}`);
}

send({ type: 'hello', clientVersion: 'quest-smoke' });
send({ type: 'join_room', roomId });
await waitFor('session_assigned');
await waitFor('quest_update', (message) => message.quests?.[0]?.id === 'first-flame');

send({ type: 'player_state', transform: { x: 2.5, y: 0.75, z: -8, rotation: 0 } });
await wait(120);
send({ type: 'pickup_request', targetId: 'market-stall-01' });
const locked = await waitFor('error', (message) => message.code === 'QUEST_LOCKED');
if (locked.code !== 'QUEST_LOCKED') throw new Error('locked quest gate failed');

send({ type: 'player_state', transform: { x: 0, y: 0.75, z: -4, rotation: 0 } });
await wait(120);
const firstQuestPromise = waitFor('quest_update', (message) => message.quests?.some((quest) => quest.id === 'help-sharma-aunty' && quest.status === 'available'));
send({ type: 'interact_request', targetId: 'diya-main-street-01' });
await waitFor('interaction_result', (message) => message.targetId === 'diya-main-street-01' && message.success);
await firstQuestPromise;

send({ type: 'player_state', transform: { x: -2.5, y: 0.75, z: -1, rotation: 0 } });
await wait(120);
const marketQuestPromise = waitFor('quest_update', (message) => message.quests?.some((quest) => quest.id === 'market-lights' && quest.status === 'available'));
send({ type: 'pickup_request', targetId: 'sharma-doorway-01' });
await marketQuestPromise;

for (const [x, z, id] of [[2.5, -8, 'market-stall-01'], [-2.5, -9.5, 'market-stall-02'], [2.5, -11, 'market-stall-03']]) {
  send({ type: 'player_state', transform: { x, y: 0.75, z, rotation: 0 } });
  await wait(120);
  const pickupPromise = waitFor('pickup_result', (message) => message.targetId === id && message.success);
  send({ type: 'pickup_request', targetId: id });
  await pickupPromise;
}
await waitFor('quest_update', (message) => message.quests?.some((quest) => quest.id === 'temple-memory' && quest.status === 'available'));

send({ type: 'player_state', transform: { x: 2.5, y: 0.75, z: -17, rotation: 0 } });
await wait(120);
const memoryPromise = waitFor('memory_started');
send({ type: 'pickup_request', targetId: 'temple-memory-01' });
await memoryPromise;
const memoryCompletedPromise = waitFor('memory_completed');
const finalQuestPromise = waitFor('quest_update', (message) => message.quests?.some((quest) => quest.id === 'last-diya' && quest.status === 'available'));
send({ type: 'memory_continue', memoryId: 'temple-memory-01' });
await memoryCompletedPromise;
await finalQuestPromise;

console.log('PASS vertical slice quest chain | out-of-order blocked | rewards enabled | final quest unlocked');
socket.close();
