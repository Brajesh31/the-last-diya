import WebSocket from 'ws';
import { performance } from 'node:perf_hooks';

const url = process.env.GAME_SERVER_URL ?? 'ws://127.0.0.1:8787';
const playerCount = Number(process.env.PERF_PLAYER_COUNT ?? 30);
const ticks = Number(process.env.PERF_TICKS ?? 12);
const intervalMs = Number(process.env.PERF_INTERVAL_MS ?? 130);
const timeoutMs = Number(process.env.PERF_TIMEOUT_MS ?? 5000);
const maxP95Ms = Number(process.env.PERF_MAX_P95_MS ?? 250);
const maxP99Ms = Number(process.env.PERF_MAX_P99_MS ?? 500);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const expectedUpdates = new Map();
const latencySamples = [];

if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount > 30) throw new Error('PERF_PLAYER_COUNT must be an integer between 2 and 30');
if (!Number.isInteger(ticks) || ticks < 1 || ticks > 20) throw new Error('PERF_TICKS must be an integer between 1 and 20');
if (!Number.isFinite(intervalMs) || intervalMs < 100) throw new Error('PERF_INTERVAL_MS must be at least 100ms');

function keyFor(playerId, rotation) { return String(playerId) + '|' + Number(rotation).toFixed(3); }
async function waitUntil(label, predicate, timeout = timeoutMs) {
  const started = performance.now();
  while (performance.now() - started < timeout) { if (predicate()) return; await wait(10); }
  throw new Error('Timed out waiting for ' + label);
}

function connectClient(index, roomId) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const client = { index, socket, id: null, transform: null, roomSnapshot: false, remoteTransforms: new Map(), errors: [] };
    const connectionTimer = setTimeout(() => { socket.terminate(); reject(new Error('client ' + index + ' connection timed out')); }, 10000);
    socket.on('open', () => {
      clearTimeout(connectionTimer);
      socket.send(JSON.stringify({ type: 'hello', clientVersion: 'performance-test' }));
      socket.send(JSON.stringify({ type: 'join_room', roomId }));
      resolve(client);
    });
    socket.on('message', (raw) => {
      let message;
      try { message = JSON.parse(raw.toString()); } catch { return; }
      if (message.type === 'session_assigned') {
        client.id = message.playerId;
        client.transform = message.transform;
      } else if (message.type === 'room_snapshot') {
        client.roomSnapshot = true;
        for (const player of message.players ?? []) client.remoteTransforms.set(player.playerId, player.transform);
      } else if (message.type === 'player_spawned' || message.type === 'player_state') {
        if (message.playerId !== client.id && message.transform) client.remoteTransforms.set(message.playerId, message.transform);
        if (message.type === 'player_state' && message.playerId !== client.id) {
          const expected = expectedUpdates.get(keyFor(message.playerId, message.transform.rotation));
          if (expected && !expected.observers.has(client.id)) {
            expected.observers.add(client.id);
            const latencyMs = performance.now() - expected.sentAt;
            latencySamples.push(latencyMs);
            expected.lastReceiveAt = performance.now();
          }
        }
      } else if (message.type === 'error') {
        client.errors.push(message);
      }
    });
    socket.on('error', (error) => {
      client.connectionError = error.message;
      if (client.id === null) reject(error);
    });
  });
}

function percentile(sorted, p) { return sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] : 0; }

async function main() {
  const roomId = 'perf-' + Date.now();
  const clients = [];
  try {
    const healthUrl = url.replace(/^ws/, 'http').replace(/\/$/, '') + '/';
    const response = await fetch(healthUrl);
    if (!response.ok) throw new Error('server health endpoint returned HTTP ' + response.status);
    clients.push(...await Promise.all(Array.from({ length: playerCount }, (_, index) => connectClient(index, roomId))));
    await waitUntil('sessions, snapshots and remote players', () => clients.every((client) => client.id && client.transform && client.roomSnapshot && client.remoteTransforms.size === playerCount - 1));
    if (new Set(clients.map((client) => client.id)).size !== playerCount) throw new Error('Player IDs were not unique');
    const first = clients[0];
    const spawnKeys = new Set([first.transform, ...first.remoteTransforms.values()].map((t) => [t.x, t.y, t.z].map((v) => Number(v).toFixed(3)).join(',')));
    if (spawnKeys.size !== playerCount) throw new Error('Expected ' + playerCount + ' distinct spawn transforms, found ' + spawnKeys.size);
    await wait(250);
    const startedAt = performance.now();
    for (let tick = 0; tick < ticks; tick += 1) {
      const rotation = Number(((tick + 1) * 0.15).toFixed(3));
      const updates = clients.map((client) => {
        const transform = { ...client.transform, rotation };
        const expected = { playerId: client.id, rotation, sentAt: 0, observers: new Set(), lastReceiveAt: 0 };
        expectedUpdates.set(keyFor(client.id, rotation), expected);
        return { client, transform, expected };
      });
      for (const entry of updates) {
        entry.expected.sentAt = performance.now();
        entry.client.socket.send(JSON.stringify({ type: 'player_state', transform: entry.transform }));
        entry.client.transform = entry.transform;
      }
      await waitUntil('tick ' + (tick + 1) + ' broadcast to every peer', () => updates.every((entry) => entry.expected.observers.size === playerCount - 1));
      if (clients.some((client) => client.errors.length)) {
        const errors = clients.flatMap((client) => client.errors.map((error) => ({ client: client.index, ...error })));
        throw new Error('Server rejected benchmark movement: ' + JSON.stringify(errors.slice(0, 5)));
      }
      if (tick < ticks - 1) await wait(intervalMs);
    }
    const finishedAt = performance.now();
    const sorted = [...latencySamples].sort((a, b) => a - b);
    const sentUpdates = playerCount * ticks;
    const expectedDeliveries = sentUpdates * (playerCount - 1);
    const summary = {
      playerCount, ticks, sentUpdates, expectedBroadcastDeliveries: expectedDeliveries,
      observedBroadcastDeliveries: latencySamples.length,
      deliveryRatePercent: Number((latencySamples.length / expectedDeliveries * 100).toFixed(2)),
      durationMs: Number((finishedAt - startedAt).toFixed(2)),
      broadcastDeliveriesPerSecond: Number((latencySamples.length / ((finishedAt - startedAt) / 1000)).toFixed(1)),
      latencyP50Ms: Number(percentile(sorted, 0.50).toFixed(2)),
      latencyP95Ms: Number(percentile(sorted, 0.95).toFixed(2)),
      latencyP99Ms: Number(percentile(sorted, 0.99).toFixed(2)),
      latencyMaxMs: Number((sorted.at(-1) ?? 0).toFixed(2)),
      spawnPositionsUnique: spawnKeys.size === playerCount,
    };
    console.log('PERF_RESULT ' + JSON.stringify(summary));
    if (latencySamples.length !== expectedDeliveries || summary.deliveryRatePercent !== 100) throw new Error('Broadcast loss: expected ' + expectedDeliveries + ', received ' + latencySamples.length);
    if (summary.latencyP95Ms > maxP95Ms) throw new Error('p95 latency ' + summary.latencyP95Ms + 'ms exceeds ' + maxP95Ms + 'ms');
    if (summary.latencyP99Ms > maxP99Ms) throw new Error('p99 latency ' + summary.latencyP99Ms + 'ms exceeds ' + maxP99Ms + 'ms');
    console.log('PASS ' + playerCount + '-client movement benchmark | ' + expectedDeliveries + ' peer deliveries | p95 ' + summary.latencyP95Ms + 'ms | p99 ' + summary.latencyP99Ms + 'ms');
  } finally {
    for (const client of clients) if (client.socket.readyState !== WebSocket.CLOSED) client.socket.close();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
