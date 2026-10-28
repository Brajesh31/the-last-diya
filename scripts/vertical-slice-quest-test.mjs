import WebSocket from 'ws';

const url = process.env.GAME_SERVER_URL ?? 'ws://127.0.0.1:8787';
const roomId = `quest-test-${Date.now()}`;
const timeoutMs = Number(process.env.TIMEOUT_MS ?? 10000);
const actionGapMs = Number(process.env.ACTION_GAP_MS ?? 275);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const socket = new WebSocket(url);
const received = [];
let lastActionAt = 0;

socket.on('message', (raw) => {
  try {
    received.push(JSON.parse(raw.toString()));
  } catch {
    // Ignore malformed messages in the test harness; assertions will time out clearly.
  }
});

await new Promise((resolve, reject) => {
  socket.once('open', resolve);
  socket.once('error', reject);
});

const send = (message) => socket.send(JSON.stringify(message));

async function sendAction(message) {
  const remaining = actionGapMs - (Date.now() - lastActionAt);
  if (remaining > 0) await wait(remaining);
  lastActionAt = Date.now();
  send(message);
}

async function waitFor(type, predicate = () => true) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const index = received.findIndex((message) => message.type === type && predicate(message));
    if (index >= 0) return received.splice(index, 1)[0];
    await wait(20);
  }
  throw new Error(`timeout waiting for ${type}; recent messages: ${received.slice(-8).map((message) => message.type).join(', ')}`);
}

async function moveTo(x, z) {
  send({ type: 'player_state', transform: { x, y: 0.75, z, rotation: 0 } });
  await wait(120);
}

try {
  send({ type: 'hello', clientVersion: 'quest-smoke' });
  send({ type: 'join_room', roomId });
  await waitFor('session_assigned');
  await waitFor('quest_update', (message) => message.quests?.[0]?.id === 'first-flame');

  // Confirm the server blocks later quest objectives out of order.
  await moveTo(2.5, -8);
  const lockedPromise = waitFor('error', (message) => message.code === 'QUEST_LOCKED');
  await sendAction({ type: 'pickup_request', targetId: 'market-stall-01' });
  await lockedPromise;

  // The first flame unlocks Sharma Aunty's doorway task.
  await moveTo(0, -4);
  const firstQuestPromise = waitFor('quest_update', (message) =>
    message.quests?.some((quest) => quest.id === 'help-sharma-aunty' && quest.status === 'available'));
  const firstLightPromise = waitFor('interaction_result', (message) =>
    message.targetId === 'diya-main-street-01' && message.success);
  await sendAction({ type: 'interact_request', targetId: 'diya-main-street-01' });
  await Promise.all([firstLightPromise, firstQuestPromise]);

  // Prepare the doorway. This should unlock the market quest.
  await moveTo(-2.5, -1);
  const marketQuestPromise = waitFor('quest_update', (message) =>
    message.quests?.some((quest) => quest.id === 'market-lights' && quest.status === 'available'));
  await sendAction({ type: 'pickup_request', targetId: 'sharma-doorway-01' });
  await waitFor('pickup_result', (message) => message.targetId === 'sharma-doorway-01' && message.success);
  await marketQuestPromise;

  // Three market pickups complete Lights of the Market.
  for (const [x, z, id] of [
    [2.5, -8, 'market-stall-01'],
    [-2.5, -9.5, 'market-stall-02'],
    [2.5, -11, 'market-stall-03'],
  ]) {
    await moveTo(x, z);
    const pickupPromise = waitFor('pickup_result', (message) => message.targetId === id && message.success);
    await sendAction({ type: 'pickup_request', targetId: id });
    await pickupPromise;
  }
  await waitFor('quest_update', (message) =>
    message.quests?.some((quest) => quest.id === 'temple-memory' && quest.status === 'available'));

  // Discover and resolve the temple memory.
  await moveTo(2.5, -17);
  const memoryStartedPromise = waitFor('memory_started');
  const memoryPickupPromise = waitFor('pickup_result', (message) => message.targetId === 'temple-memory-01' && message.success);
  await sendAction({ type: 'pickup_request', targetId: 'temple-memory-01' });
  await Promise.all([memoryStartedPromise, memoryPickupPromise]);

  const memoryCompletedPromise = waitFor('memory_completed');
  const finalQuestPromise = waitFor('quest_update', (message) =>
    message.quests?.some((quest) => quest.id === 'last-diya' && quest.status === 'available'));
  await sendAction({ type: 'memory_continue', memoryId: 'temple-memory-01' });
  await Promise.all([memoryCompletedPromise, finalQuestPromise]);

  console.log('PASS vertical slice quest chain | out-of-order blocked | rewards enabled | final quest unlocked');
} finally {
  socket.close();
}
