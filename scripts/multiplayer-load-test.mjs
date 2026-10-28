import WebSocket from 'ws';

const url = process.env.GAME_SERVER_URL ?? 'ws://127.0.0.1:8787';
const requestedCounts = (process.env.LOAD_COUNTS ?? '2,5,10')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter(Boolean);
const timeoutMs = Number(process.env.TIMEOUT_MS ?? 10000);
const settleMs = Number(process.env.SETTLE_MS ?? 1000);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (!requestedCounts.length || requestedCounts.some((count) => !Number.isInteger(count) || count < 2 || count > 10)) {
  throw new Error('LOAD_COUNTS must contain integers between 2 and 10');
}

async function waitUntil(label, predicate, timeout = timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (predicate()) return;
    await wait(25);
  }
  const errorSummary = clients?.map((client) => `client ${client.index}: ${client.errors.slice(-3).map((error) => error.code).join('/')}`).join('; ');
  throw new Error(`timeout waiting for ${label}${errorSummary ? ` | server errors: ${errorSummary}` : ''}`);
}

function send(client, message) {
  if (client.socket.readyState !== WebSocket.OPEN) throw new Error(`client ${client.index} socket is not open`);
  client.socket.send(JSON.stringify(message));
}

function connectClient(index, roomId, sessionToken) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const client = {
      index,
      socket,
      id: null,
      sessionToken: null,
      restored: false,
      roomSnapshot: null,
      spawnedPlayers: new Set(),
      remoteTransforms: new Map(),
      targetStates: new Set(),
      successfulPickups: new Set(),
      worldState: null,
      lightLevel: 0,
      quests: [],
      inventory: [],
      errors: [],
      connectedAt: Date.now(),
    };

    const timer = setTimeout(() => {
      socket.terminate();
      reject(new Error(`client ${index} connection timeout`));
    }, timeoutMs);

    socket.on('open', () => {
      clearTimeout(timer);
      socket.send(JSON.stringify({
        type: 'hello',
        clientVersion: 'load-test',
        ...(sessionToken ? { sessionToken } : {}),
      }));
      socket.send(JSON.stringify({ type: 'join_room', roomId }));
      resolve(client);
    });

    socket.on('message', (raw) => {
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (message.type === 'session_assigned') {
        client.id = message.playerId;
        client.sessionToken = message.sessionToken;
        client.restored = message.restored;
      }
      if (message.type === 'room_snapshot') {
        client.roomSnapshot = message;
        client.spawnedPlayers.clear();
        client.remoteTransforms.clear();
        for (const player of message.players ?? []) {
          client.spawnedPlayers.add(player.playerId);
          client.remoteTransforms.set(player.playerId, player.transform);
        }
        for (const targetId of message.litTargets ?? []) client.targetStates.add(targetId);
        for (const targetId of message.pickedTargets ?? []) client.successfulPickups.add(targetId);
      }
      if (message.type === 'player_spawned') {
        client.spawnedPlayers.add(message.playerId);
        if (message.transform) client.remoteTransforms.set(message.playerId, message.transform);
      }
      if (message.type === 'player_state') {
        client.spawnedPlayers.add(message.playerId);
        client.remoteTransforms.set(message.playerId, message.transform);
      }
      if (message.type === 'player_left') {
        client.spawnedPlayers.delete(message.playerId);
        client.remoteTransforms.delete(message.playerId);
      }
      if (message.type === 'target_state' && message.active) client.targetStates.add(message.targetId);
      if (message.type === 'pickup_result' && message.success) client.successfulPickups.add(message.targetId);
      if (message.type === 'world_state') {
        client.worldState = message;
        client.lightLevel = message.lightLevel;
      }
      if (message.type === 'light_update') client.lightLevel = message.level;
      if (message.type === 'quest_update') client.quests = message.quests;
      if (message.type === 'inventory_update') client.inventory = message.items;
      if (message.type === 'error') client.errors.push(message);
    });

    socket.on('error', (error) => {
      if (!client.id) reject(error);
    });
  });
}

function questIs(client, id, status) {
  return client.quests.some((quest) => quest.id === id && quest.status === status);
}

function itemQuantity(client, id) {
  return client.inventory.find((item) => item.id === id)?.quantity ?? 0;
}

async function runScenario(playerCount) {
  const roomId = `load-${playerCount}-${Date.now()}`;
  const clients = [];
  const startedAt = Date.now();

  try {
    for (let index = 0; index < playerCount; index += 1) {
      clients.push(await connectClient(index, roomId));
    }

    await waitUntil('all unique sessions and room snapshots', () =>
      clients.every((client) => client.id && client.roomSnapshot));
    await wait(settleMs);

    const ids = new Set(clients.map((client) => client.id));
    if (ids.size !== playerCount) {
      throw new Error(`expected ${playerCount} unique sessions, got ${ids.size}`);
    }

    for (const client of clients) {
      const observedOthers = [...client.spawnedPlayers].filter((id) => id !== client.id).length;
      if (observedOthers !== playerCount - 1) {
        throw new Error(`client ${client.index} observed ${observedOthers}/${playerCount - 1} remote players`);
      }
    }

    const first = clients[0];
    // Validate server-to-client movement synchronization, not only remote spawn lists.
    send(first, {
      type: 'player_state',
      transform: { x: 0, y: 0.75, z: -4, rotation: 0.25 },
    });
    await waitUntil('remote movement update on every peer', () =>
      clients.slice(1).every((client) => {
        const transform = client.remoteTransforms.get(first.id);
        return transform && Math.abs(transform.x) < 0.001 &&
          Math.abs(transform.z + 4) < 0.001 &&
          Math.abs(transform.rotation - 0.25) < 0.001;
      }));

    send(first, { type: 'interact_request', targetId: 'diya-main-street-01' });
    await waitUntil('shared light and main diya state on all clients', () =>
      clients.every((client) =>
        client.lightLevel >= 10 &&
        client.worldState?.lightLevel >= 10 &&
        client.targetStates.has('diya-main-street-01')));
    await waitUntil('first player first-flame quest completion', () =>
      questIs(first, 'first-flame', 'completed'));

    // Give player one a completed quest and a non-default inventory before reconnecting.
    send(first, {
      type: 'player_state',
      transform: { x: -2.5, y: 0.75, z: -1, rotation: 0 },
    });
    await wait(150);
    // Wait beyond the server's per-player action throttle before requesting the pickup.
    await wait(300);
    send(first, { type: 'pickup_request', targetId: 'sharma-doorway-01' });
    await waitUntil('doorway pickup accepted', () => first.successfulPickups.has('sharma-doorway-01'));
    await waitUntil('doorway quest completion and reward', () =>
      questIs(first, 'help-sharma-aunty', 'completed') &&
      itemQuantity(first, 'wick') >= 5);

    const originalId = first.id;
    const token = first.sessionToken;
    if (!token) throw new Error('first client did not receive a session token');
    await new Promise((resolve) => {
      if (first.socket.readyState === WebSocket.CLOSED) return resolve();
      first.socket.once('close', resolve);
      first.socket.close();
    });
    await wait(100);

    const restored = await connectClient(0, roomId, token);
    clients[0] = restored;
    await waitUntil('restored session, quest state and inventory', () =>
      restored.restored &&
      restored.id === originalId &&
      restored.roomSnapshot &&
      questIs(restored, 'help-sharma-aunty', 'completed') &&
      itemQuantity(restored, 'wick') >= 5);
    if (!restored.successfulPickups.has('sharma-doorway-01')) {
      throw new Error('restored room snapshot did not include the player personal doorway pickup');
    }
    if (!restored.targetStates.has('diya-main-street-01') || restored.lightLevel < 10) {
      throw new Error('restored room snapshot did not include shared world state');
    }

    const duration = Date.now() - startedAt;
    console.log(`PASS ${playerCount} players | join+sync+reconnect ${duration}ms | Light Level ${restored.lightLevel}%`);
    console.log(`PASS ${playerCount} players | remote movement, shared diya, session restore and personal quest/inventory persisted`);
  } finally {
    for (const client of clients) {
      if (client?.socket && client.socket.readyState !== WebSocket.CLOSED) client.socket.close();
    }
  }
}

console.log(`Multiplayer load test: ${requestedCounts.join(', ')} players -> ${url}`);
for (const playerCount of requestedCounts) await runScenario(playerCount);
console.log('PASS all multiplayer load scenarios');
