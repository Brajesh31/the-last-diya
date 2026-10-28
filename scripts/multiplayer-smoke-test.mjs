import WebSocket from 'ws';

const url = process.env.GAME_SERVER_URL ?? 'ws://127.0.0.1:8787';
const players = Number(process.env.PLAYERS ?? 2);
const timeoutMs = Number(process.env.TIMEOUT_MS ?? 8000);
const roomId = `smoke-${Date.now()}`;

if (!Number.isInteger(players) || players < 2 || players > 10) {
  throw new Error('PLAYERS must be an integer between 2 and 10');
}

const sockets = [];
const state = new Map();
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const send = (client, message) => client.socket.send(JSON.stringify(message));

async function waitUntil(label, predicate) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return;
    await wait(20);
  }
  throw new Error(`timeout waiting for ${label}`);
}

function openClient(index) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const client = {
      socket,
      id: null,
      transform: null,
      remoteTransforms: new Map(),
      roomSnapshot: null,
      worldState: null,
      quests: [],
      lightUpdates: 0,
      joined: false,
      targetStates: new Set(),
      successfulPickups: new Set(),
    };
    const timer = setTimeout(() => reject(new Error(`client ${index} connection timeout`)), timeoutMs);

    socket.on('open', () => {
      clearTimeout(timer);
      socket.send(JSON.stringify({ type: 'hello', clientVersion: 'smoke-test' }));
      socket.send(JSON.stringify({ type: 'join_room', roomId }));
      resolve(client);
    });

    socket.on('message', (raw) => {
      const message = JSON.parse(raw.toString());
      if (message.type === 'session_assigned') { client.id = message.playerId; client.transform = message.transform; }
      if (message.type === 'room_snapshot') {
        client.roomSnapshot = message;
        for (const player of message.players ?? []) client.remoteTransforms.set(player.playerId, player.transform);
      }
      if (message.type === 'player_spawned') client.remoteTransforms.set(message.playerId, message.transform);
      if (message.type === 'player_state') client.remoteTransforms.set(message.playerId, message.transform);
      if (message.type === 'player_left') client.remoteTransforms.delete(message.playerId);
      if (message.type === 'light_update') client.lightUpdates += 1;
      if (message.type === 'world_state') client.worldState = message;
      if (message.type === 'quest_update') client.quests = message.quests;
      if (message.type === 'target_state' && message.active) client.targetStates.add(message.targetId);
      if (message.type === 'pickup_result' && message.success) client.successfulPickups.add(message.targetId);
      if (message.type === 'player_spawned') client.joined = true;
      state.set(index, client);
    });

    socket.on('error', (error) => {
      if (!client.joined && !client.id) reject(error);
    });
  });
}

function isQuestCompleted(client, id) {
  return client.quests.some((quest) => quest.id === id && quest.status === 'completed');
}

function hasQuestAvailable(client, id) {
  return client.quests.some((quest) => quest.id === id && quest.status === 'available');
}

async function moveClientTo(client, x, z, rotation = 0) {
  if (!client.transform) throw new Error(`client ${client.id ?? 'unknown'} has no spawn transform`);
  const start = { ...client.transform };
  const distance = Math.hypot(x - start.x, z - start.z);
  const steps = Math.max(1, Math.ceil(distance / 0.35));
  for (let index = 1; index <= steps; index += 1) {
    await wait(120);
    const transform = {
      x: start.x + (x - start.x) * index / steps,
      y: 0.75,
      z: start.z + (z - start.z) * index / steps,
      rotation,
    };
    send(client, { type: 'player_state', transform });
    client.transform = transform;
  }
}

try {
  console.log(`Smoke test: ${players} players -> ${url}`);
  for (let index = 0; index < players; index += 1) {
    const client = await openClient(index);
    sockets.push(client.socket);
    state.set(index, client);
  }

  await wait(1000);

  for (const [index, client] of state) {
    if (!client.id) throw new Error(`client ${index} did not receive a session`);
    if (!client.roomSnapshot) throw new Error(`client ${index} did not receive a room snapshot`);
  }

  const first = state.get(0);
  const second = state.get(1);

  // Player one activates the shared world target.
  await moveClientTo(first, 0, -4);
  send(first, { type: 'interact_request', targetId: 'diya-main-street-01' });
  await waitUntil('shared Light Level and active diya', () =>
    [...state.values()].every((client) =>
      client.worldState?.lightLevel >= 10 && client.targetStates.has('diya-main-street-01')));

  // The second player must still be able to complete their own first-flame quest
  // after the world diya has already been lit by player one.
  await moveClientTo(second, 0, -4);
  send(second, { type: 'interact_request', targetId: 'diya-main-street-01' });
  await waitUntil('second player first-flame quest completion', () => isQuestCompleted(second, 'first-flame'));

  // Pickups are personal quest objects: both players can collect the same doorway objective.
  await moveClientTo(first, -2.5, -1);
  await moveClientTo(second, -2.5, -1);
  await wait(300);
  send(first, { type: 'pickup_request', targetId: 'sharma-doorway-01' });
  send(second, { type: 'pickup_request', targetId: 'sharma-doorway-01' });
  await waitUntil('personal doorway quest pickup for both players', () =>
    first.successfulPickups.has('sharma-doorway-01') && second.successfulPickups.has('sharma-doorway-01'));
  await waitUntil('doorway quest completion for both players', () =>
    isQuestCompleted(first, 'help-sharma-aunty') &&
    isQuestCompleted(second, 'help-sharma-aunty') &&
    hasQuestAvailable(first, 'market-lights') &&
    hasQuestAvailable(second, 'market-lights'));

  console.log(`PASS: ${players} clients joined room ${roomId}`);
  console.log(`PASS: shared Light Level reached ${first.worldState.lightLevel}%`);
  console.log('PASS: main diya activation synchronized to every player');
  console.log('PASS: second player can progress after shared diya is already lit');
  console.log('PASS: both players can collect the doorway objective and advance personal quests');
} finally {
  for (const socket of sockets) socket.close();
}
