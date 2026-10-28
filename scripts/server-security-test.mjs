import assert from 'node:assert/strict';
import WebSocket from 'ws';

const url = process.env.GAME_SERVER_URL ?? 'ws://127.0.0.1:8787';
const timeoutMs = Number(process.env.SECURITY_TIMEOUT_MS ?? 5000);
const clients = [];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function openClient(options = {}) {
  const socket = new WebSocket(url, options.origin ? { headers: { Origin: options.origin } } : {});
  const client = { socket, messages: [], closed: null, lastError: null };
  clients.push(client);
  socket.on('message', (raw) => {
    try { client.messages.push(JSON.parse(raw.toString())); }
    catch { client.messages.push({ type: 'raw', value: raw.toString() }); }
  });
  socket.on('close', (code, reason) => { client.closed = { code, reason: reason.toString() }; });
  socket.on('error', (error) => { client.lastError = error.message; });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WebSocket connection timed out')), timeoutMs);
    socket.once('open', () => { clearTimeout(timer); resolve(); });
    socket.once('error', (error) => { clearTimeout(timer); reject(error); });
  });
  return client;
}

async function waitForMessage(client, predicate, startIndex, label) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    for (let index = startIndex; index < client.messages.length; index += 1) {
      const message = client.messages[index];
      if (predicate(message)) return message;
    }
    if (client.closed) throw new Error(`${label}: socket closed first with code ${client.closed.code}`);
    await wait(10);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function sendAndExpect(client, payload, predicate, label, raw = false) {
  assert.equal(client.socket.readyState, WebSocket.OPEN, `${label}: socket must be open`);
  const startIndex = client.messages.length;
  client.socket.send(raw ? payload : JSON.stringify(payload));
  return waitForMessage(client, predicate, startIndex, label);
}

async function closeClient(client) {
  if (client.socket.readyState === WebSocket.CLOSED) return;
  await new Promise((resolve) => {
    const timer = setTimeout(() => { client.socket.terminate(); resolve(); }, 500);
    client.socket.once('close', () => { clearTimeout(timer); resolve(); });
    if (client.socket.readyState === WebSocket.OPEN) client.socket.close();
  });
}

async function rejectedOriginStatus(origin) {
  const socket = new WebSocket(url, { headers: { Origin: origin } });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.terminate();
      reject(new Error('Timed out waiting for origin policy response'));
    }, timeoutMs);
    socket.once('unexpected-response', (_request, response) => {
      clearTimeout(timer);
      const status = response.statusCode ?? 0;
      response.resume();
      resolve(status);
    });
    socket.once('open', () => {
      clearTimeout(timer);
      socket.close();
      resolve(101);
    });
    socket.once('error', () => {
      // A rejected HTTP upgrade emits an error after unexpected-response. That event
      // resolves the promise with the server's HTTP status before this handler fires.
    });
  });
}

async function waitForClose(client, label, timeout = timeoutMs) {
  const started = Date.now();
  while (!client.closed && Date.now() - started < timeout) await wait(10);
  assert.ok(client.closed, label + ': socket did not close');
  return client.closed;
}

try {
  // A valid action cannot mutate gameplay state before the socket joins a room.
  const unjoined = await openClient();
  const notJoined = await sendAndExpect(unjoined,
    { type: 'interact_request', targetId: 'diya-main-street-01' },
    (message) => message.type === 'error' && message.code === 'NOT_JOINED',
    'reject unjoined gameplay action');
  assert.equal(notJoined.code, 'NOT_JOINED');
  console.log('PASS unjoined sockets cannot issue gameplay actions');

  const malformedJson = await openClient();
  const parseError = await sendAndExpect(malformedJson, '{not-json',
    (message) => message.type === 'error' && message.code === 'INVALID_MESSAGE',
    'reject invalid JSON', true);
  assert.equal(parseError.code, 'INVALID_MESSAGE');
  console.log('PASS invalid JSON is rejected without crashing the server');

  const malformedShape = await openClient();
  const shapeError = await sendAndExpect(malformedShape,
    { type: 'join_room', roomId: { nested: 'object' } },
    (message) => message.type === 'error' && message.code === 'INVALID_MESSAGE',
    'reject malformed message shape');
  assert.equal(shapeError.code, 'INVALID_MESSAGE');
  console.log('PASS runtime message shape validation rejects invalid room IDs');

  const invalidBurst = await openClient();
  for (let index = 0; index < 5; index += 1) {
    const message = await sendAndExpect(invalidBurst,
      { type: 'unknown_attack_type', attempt: index },
      (candidate) => candidate.type === 'error' && candidate.code === 'INVALID_MESSAGE',
      `reject invalid message ${index + 1}/5`);
    assert.equal(message.code, 'INVALID_MESSAGE');
  }
  const closeStarted = Date.now();
  while (!invalidBurst.closed && Date.now() - closeStarted < timeoutMs) await wait(10);
  assert.ok(invalidBurst.closed, 'server should close a socket after five invalid messages');
  assert.equal(invalidBurst.closed.code, 1008, `expected policy close 1008, got ${invalidBurst.closed.code}`);
  console.log('PASS repeated malformed messages trigger policy close 1008');

  const oversized = await openClient();
  oversized.socket.send(JSON.stringify({ type: 'join_room', roomId: 'oversized', padding: 'x'.repeat(20 * 1024) }));
  const oversizedStarted = Date.now();
  while (!oversized.closed && Date.now() - oversizedStarted < timeoutMs) await wait(10);
  assert.ok(oversized.closed, 'server should close an oversized frame');
  assert.equal(oversized.closed.code, 1009, `expected payload-too-large close 1009, got ${oversized.closed.code}`);
  console.log('PASS payload larger than 16 KiB is rejected with close 1009');

  const transformClient = await openClient();
  transformClient.socket.send(JSON.stringify({ type: 'hello', clientVersion: 'server-security-test' }));
  transformClient.socket.send(JSON.stringify({ type: 'join_room', roomId: 'security/unsafe?room' }));
  await waitForMessage(transformClient, (message) => message.type === 'session_assigned', 0, 'session assignment');
  const snapshot = await waitForMessage(transformClient, (message) => message.type === 'room_snapshot', 0, 'room snapshot');
  assert.equal(snapshot.roomId, 'security-unsafe-room');
  assert.match(snapshot.roomId, /^[A-Za-z0-9_-]{1,32}$/);
  await wait(120);
  const transformError = await sendAndExpect(transformClient,
    { type: 'player_state', transform: { x: null, y: 0.75, z: 4.5, rotation: 0 } },
    (message) => message.type === 'error' && message.code === 'INVALID_TRANSFORM',
    'reject non-numeric player transform');
  assert.equal(transformError.code, 'INVALID_TRANSFORM');
  console.log('PASS room identifiers are normalized and non-numeric transforms are rejected');

  // Browser Origin policy is configured explicitly by the security CI workflow.
  const allowedOriginClient = await openClient({ origin: 'https://game.example.test' });
  assert.equal(allowedOriginClient.socket.readyState, WebSocket.OPEN);
  await closeClient(allowedOriginClient);
  assert.equal(await rejectedOriginStatus('https://evil.example'), 403);
  console.log('PASS configured browser Origin is allowed and unlisted Origin is rejected with HTTP 403');

  // A socket that never joins a room must not occupy server resources indefinitely.
  const abandonedHandshake = await openClient();
  const handshakeClose = await waitForClose(abandonedHandshake, 'handshake timeout',
    Number(process.env.HANDSHAKE_TIMEOUT_MS ?? 10_000) + 1000);
  assert.equal(handshakeClose.code, 1008);
  assert.match(handshakeClose.reason, /handshake timeout/i);
  console.log('PASS idle handshakes are closed with policy code 1008');

  // Flood a joined connection beyond its configured message budget.
  const noisyClient = await openClient();
  noisyClient.socket.send(JSON.stringify({ type: 'hello', clientVersion: 'server-security-test' }));
  noisyClient.socket.send(JSON.stringify({ type: 'join_room', roomId: 'message-rate-test' }));
  await waitForMessage(noisyClient, (message) => message.type === 'session_assigned', 0, 'message rate test session');
  for (let index = 0; index < Number(process.env.MAX_MESSAGES_PER_WINDOW ?? 240) + 20; index += 1) {
    if (noisyClient.socket.readyState !== WebSocket.OPEN) break;
    noisyClient.socket.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
  }
  const noisyClose = await waitForClose(noisyClient, 'message rate limit');
  assert.equal(noisyClose.code, 1008);
  assert.match(noisyClose.reason, /message rate limit/i);
  console.log('PASS message bursts above the per-connection budget are closed');

  // Fill the test-configured per-IP budget and verify the next socket is shed.
  const connectionCap = Number(process.env.MAX_CONNECTIONS_PER_IP ?? 40);
  while (clients.filter((client) => client.socket.readyState === WebSocket.OPEN).length < connectionCap) {
    await openClient();
    await wait(20);
  }
  await wait(50);
  const overflowClient = await openClient();
  const overflowClose = await waitForClose(overflowClient, 'per-IP connection cap');
  assert.equal(overflowClose.code, 1013);
  assert.match(overflowClose.reason, /per-ip connection limit/i);
  console.log('PASS per-IP connection cap rejects excess sockets with close code 1013');

  console.log('PASS server security regression suite');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await Promise.all(clients.map(closeClient));
}
