import assert from 'node:assert/strict';
import WebSocket from 'ws';

const url = process.env.GAME_SERVER_URL ?? 'ws://127.0.0.1:8787';
const timeoutMs = Number(process.env.TIMEOUT_MS ?? 7000);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clients = [];

async function waitUntil(label, predicate, timeout = timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (predicate()) return;
    await wait(20);
  }
  const errors = clients.map((client) => `client ${client.index}: ${client.errors.slice(-3).map((error) => error.code).join('/')}`).join('; ');
  throw new Error(`Timed out waiting for ${label}${errors ? ` | ${errors}` : ''}`);
}

function connectClient(index, roomId) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const client = {
      index,
      roomId,
      socket,
      id: null,
      sessionToken: null,
      snapshot: null,
      transform: null,
      remoteTransforms: new Map(),
      lightLevel: 0,
      worldState: null,
      targetStates: new Set(),
      errors: [],
    };
    const timer = setTimeout(() => {
      socket.terminate();
      reject(new Error(`client ${index} timed out connecting`));
    }, timeoutMs);

    socket.on('open', () => {
      clearTimeout(timer);
      socket.send(JSON.stringify({ type: 'hello', clientVersion: 'server-hardening-test' }));
      socket.send(JSON.stringify({ type: 'join_room', roomId }));
      resolve(client);
    });

    socket.on('message', (raw) => {
      let message;
      try { message = JSON.parse(raw.toString()); } catch { return; }
      if (message.type === 'session_assigned') {
        client.id = message.playerId;
        client.sessionToken = message.sessionToken;
        client.transform = message.transform;
      }
      if (message.type === 'room_snapshot') {
        client.snapshot = message;
        client.lightLevel = message.lightLevel;
        for (const player of message.players ?? []) client.remoteTransforms.set(player.playerId, player.transform);
        for (const target of message.litTargets ?? []) client.targetStates.add(target);
      }
      if (message.type === 'player_spawned') client.remoteTransforms.set(message.playerId, message.transform);
      if (message.type === 'player_left') client.remoteTransforms.delete(message.playerId);
      if (message.type === 'player_state') client.remoteTransforms.set(message.playerId, message.transform);
      if (message.type === 'light_update') client.lightLevel = message.level;
      if (message.type === 'world_state') {
        client.worldState = message;
        client.lightLevel = message.lightLevel;
      }
      if (message.type === 'target_state' && message.active) client.targetStates.add(message.targetId);
      if (message.type === 'error') client.errors.push(message);
    });

    socket.on('error', (error) => { if (!client.id) reject(error); });
  });
}

function send(client, message) {
  assert.equal(client.socket.readyState, WebSocket.OPEN, `client ${client.index} socket must remain open`);
  client.socket.send(JSON.stringify(message));
}

async function moveClientTo(client, x, z, observers) {
  const from = observers[0].remoteTransforms.get(client.id);
  assert.ok(from, "observer must know the moving player current transform");
  const distance = Math.hypot(x - from.x, z - from.z);
  const steps = Math.max(1, Math.ceil(distance / 0.35));
  for (let index = 1; index <= steps; index += 1) {
    const nextX = from.x + (x - from.x) * index / steps;
    const nextZ = from.z + (z - from.z) * index / steps;
    await wait(120);
    send(client, { type: 'player_state', transform: { x: nextX, y: 0.75, z: nextZ, rotation: 0 } });
    await waitUntil(`accepted movement step ${index}/${steps}`, () => observers.every((observer) => {
      const observed = observer.remoteTransforms.get(client.id);
      return observed && Math.abs(observed.x - nextX) < 0.001 && Math.abs(observed.z - nextZ) < 0.001;
    }), 2500);
  }
}

try {
  const roomA = 'hardening-a';
  const roomB = 'hardening-b';
  const a1 = await connectClient(1, roomA); clients.push(a1);
  const a2 = await connectClient(2, roomA); clients.push(a2);
  const b1 = await connectClient(3, roomB); clients.push(b1);
  const b2 = await connectClient(4, roomB); clients.push(b2);

  await waitUntil('four clients join two isolated rooms', () => clients.every((client) => client.id && client.snapshot));
  assert.equal(new Set(clients.map((client) => client.id)).size, 4, 'each socket gets a unique player id');
  assert.ok(a2.remoteTransforms.has(a1.id), 'second player in room A sees room A player one');
  assert.ok(b2.remoteTransforms.has(b1.id), 'second player in room B sees room B player one');
  assert.ok(!b1.remoteTransforms.has(a1.id) && !b2.remoteTransforms.has(a1.id), 'room B must not see room A player identities');
  console.log('PASS: four clients joined two rooms with isolated player snapshots');

  await wait(130);
  send(a1, { type: 'player_state', transform: { x: 0, y: 0.75, z: -4, rotation: 0 } });
  await waitUntil('excessive movement rejected', () => a1.errors.some((error) => error.code === 'MOVE_TOO_FAST'));
  assert.ok(Math.abs((a2.remoteTransforms.get(a1.id)?.z ?? 0) - 4.5) < 0.001, 'rejected teleport must not update the room peer');
  console.log('PASS: server rejects a teleport that exceeds allowed movement speed');

  await wait(120);
  send(a1, { type: 'player_state', transform: { x: 4, y: 0.75, z: 4.5, rotation: 0 } });
  await waitUntil('out-of-bounds movement rejected', () => a1.errors.some((error) => error.code === 'OUT_OF_BOUNDS'));
  assert.ok(Math.abs((a2.remoteTransforms.get(a1.id)?.x ?? 99) - 0) < 0.001, 'out-of-bounds position must not broadcast');
  console.log('PASS: server rejects positions outside walkable world bounds');

  await wait(120);
  send(a1, { type: 'player_state', transform: { x: 0.4, y: 0.75, z: 4.5, rotation: 0 } });
  await waitUntil('valid small movement accepted', () => Math.abs((a2.remoteTransforms.get(a1.id)?.x ?? 99) - 0.4) < 0.001);
  await moveClientTo(a1, 0, -4, [a2]);
  await wait(120);
  send(a1, { type: 'interact_request', targetId: 'diya-main-street-01' });
  await waitUntil('room A shared diya lights', () =>
    a1.lightLevel >= 10 && a2.lightLevel >= 10 &&
    a1.targetStates.has('diya-main-street-01') && a2.targetStates.has('diya-main-street-01'));
  await wait(250);
  assert.equal(b1.lightLevel, 0, 'room B light level must remain unchanged');
  assert.equal(b2.lightLevel, 0, 'room B light level must remain unchanged for every room peer');
  assert.ok(!b1.targetStates.has('diya-main-street-01') && !b2.targetStates.has('diya-main-street-01'), 'room B must not receive room A target state');
  console.log('PASS: main diya updates only clients in room A');

  const b3 = await connectClient(5, roomB); clients.push(b3);
  await waitUntil('late room B join receives isolated snapshot', () => b3.id && b3.snapshot);
  assert.equal(b3.snapshot.lightLevel, 0, 'late joiner must receive its own room light state');
  assert.ok(!b3.snapshot.litTargets.includes('diya-main-street-01'), 'late joiner must not inherit another room target state');
  console.log('PASS: late room B join receives only its room snapshot');

  console.log('PASS server hardening | speed limit | world bounds | room state and snapshots are isolated');
} finally {
  for (const client of clients) {
    if (client.socket.readyState !== WebSocket.CLOSED) client.socket.close();
  }
}
