import WebSocket from 'ws';

const url = process.env.GAME_SERVER_URL ?? 'ws://127.0.0.1:8787';
const requestedCounts = (process.env.LOAD_COUNTS ?? '2,5,10')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter(Boolean);
const timeoutMs = Number(process.env.TIMEOUT_MS ?? 10000);
const settleMs = Number(process.env.SETTLE_MS ?? 1500);

if (!requestedCounts.length || requestedCounts.some((count) => !Number.isInteger(count) || count < 2 || count > 10)) {
  throw new Error('LOAD_COUNTS must contain integers between 2 and 10');
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function connectClient(index, roomId) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const client = {
      index,
      socket,
      id: null,
      roomSnapshot: null,
      spawnedPlayers: new Set(),
      lightLevel: 0,
      connectedAt: Date.now(),
    };

    const timer = setTimeout(() => {
      socket.terminate();
      reject(new Error(`client ${index} connection timeout`));
    }, timeoutMs);

    socket.on('open', () => {
      clearTimeout(timer);
      socket.send(JSON.stringify({ type: 'hello', clientVersion: 'load-test' }));
      socket.send(JSON.stringify({ type: 'join_room', roomId }));
      resolve(client);
    });

    socket.on('message', (raw) => {
      const message = JSON.parse(raw.toString());
      if (message.type === 'session_assigned') client.id = message.playerId;
      if (message.type === 'room_snapshot') {
        client.roomSnapshot = message;
        for (const player of message.players ?? []) client.spawnedPlayers.add(player.playerId);
      }
      if (message.type === 'player_spawned') client.spawnedPlayers.add(message.playerId);
      if (message.type === 'world_state') client.lightLevel = message.lightLevel;
      if (message.type === 'light_update') client.lightLevel = message.level;
    });

    socket.on('error', (error) => {
      if (!client.id) reject(error);
    });
  });
}

async function runScenario(playerCount) {
  const roomId = `load-${playerCount}-${Date.now()}`;
  const clients = [];
  const startedAt = Date.now();

  try {
    for (let index = 0; index < playerCount; index += 1) {
      clients.push(await connectClient(index, roomId));
    }

    await wait(settleMs);

    const ids = new Set(clients.map((client) => client.id));
    if (ids.size !== playerCount) {
      throw new Error(`expected ${playerCount} unique sessions, got ${ids.size}`);
    }

    for (const client of clients) {
      if (!client.roomSnapshot) throw new Error(`client ${client.index} missed room snapshot`);
      const observedOthers = [...client.spawnedPlayers].filter((id) => id !== client.id).length;
      if (observedOthers !== playerCount - 1) {
        throw new Error(`client ${client.index} observed ${observedOthers}/${playerCount - 1} remote players`);
      }
    }

    const first = clients[0];
    first.socket.send(JSON.stringify({
      type: 'player_state',
      transform: { x: 0, y: 0.75, z: -4, rotation: 0 },
    }));
    await wait(250);
    first.socket.send(JSON.stringify({ type: 'interact_request', targetId: 'diya-main-street-01' }));
    await wait(500);

    for (const client of clients) {
      if (client.lightLevel < 10) {
        throw new Error(`client ${client.index} did not observe Light Level >= 10`);
      }
    }

    const duration = Date.now() - startedAt;
    console.log(`PASS ${playerCount} players | join+sync ${duration}ms | Light Level ${first.lightLevel}%`);
  } finally {
    for (const client of clients) client.socket.close();
  }
}

console.log(`Multiplayer load test: ${requestedCounts.join(', ')} players -> ${url}`);
for (const playerCount of requestedCounts) await runScenario(playerCount);
console.log('PASS all multiplayer load scenarios');
