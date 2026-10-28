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

function openClient(index) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const client = { socket, id: null, roomSnapshot: null, lightUpdates: 0, joined: false, targetStates: new Set() };
    const timer = setTimeout(() => reject(new Error(`client ${index} connection timeout`)), timeoutMs);

    socket.on('open', () => {
      clearTimeout(timer);
      socket.send(JSON.stringify({ type: 'hello', clientVersion: 'smoke-test' }));
      socket.send(JSON.stringify({ type: 'join_room', roomId }));
      resolve(client);
    });

    socket.on('message', (raw) => {
      const message = JSON.parse(raw.toString());
      if (message.type === 'session_assigned') client.id = message.playerId;
      if (message.type === 'room_snapshot') client.roomSnapshot = message;
      if (message.type === 'light_update') client.lightUpdates += 1;
      if (message.type === 'world_state') client.worldState = message;
      if (message.type === 'target_state' && message.active) client.targetStates.add(message.targetId);
      if (message.type === 'player_spawned') client.joined = true;
      state.set(index, client);
    });

    socket.on('error', (error) => {
      if (!client.joined && !client.id) reject(error);
    });
  });
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
  first.socket.send(JSON.stringify({ type: 'player_state', transform: { x: 0, y: 0.75, z: -4, rotation: 0 } }));
  await wait(250);
  first.socket.send(JSON.stringify({ type: 'interact_request', targetId: 'diya-main-street-01' }));
  await wait(500);

  for (const [index, client] of state) {
    if (!client.worldState || client.worldState.lightLevel < 10) {
      throw new Error(`client ${index} did not observe Light Level >= 10`);
    }
    if (!client.targetStates.has('diya-main-street-01')) {
      throw new Error(`client ${index} did not observe the main diya becoming active`);
    }
  }

  console.log(`PASS: ${players} clients joined room ${roomId}`);
  console.log(`PASS: shared Light Level reached ${first.worldState.lightLevel}%`);
  console.log('PASS: server-authoritative diya interaction and target state propagated');
} finally {
  for (const socket of sockets) socket.close();
}
