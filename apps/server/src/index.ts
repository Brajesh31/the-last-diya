import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { WebSocketServer, WebSocket } from 'ws';
import { DARK_DISTRICT_UNLOCK_LEVEL, DEFAULT_ROOM_CAPACITY, FINAL_EVENT_LEVEL, LIGHT_LEVEL_START, MAX_LIGHT_LEVEL } from '@the-last-diya/shared';
import type { ClientMessage, InventoryItemState, ItemId, MemorySequenceState, PlayerTransform, QuestState, ServerMessage, WorldEventState } from '@the-last-diya/shared';
import { STARTING_INVENTORY, canProgressQuest, getQuestDefinition, initialQuestStates, isNear, isWalkablePosition } from '@the-last-diya/game-core';
import { decodeMessage, encodeMessage } from '@the-last-diya/networking';

const port = Number(process.env.PORT ?? 8787);
const http = createServer((_, response) => { response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ name: 'the-last-diya-server', status: 'ok', phase: 'vertical-slice' })); });
function readBoundedInteger(name: string, fallback: number, min: number, max: number): number {
  const raw = Number(process.env[name]);
  return Number.isInteger(raw) && raw >= min && raw <= max ? raw : fallback;
}
const allowedWsOrigins = new Set(
  (process.env.WS_ALLOWED_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean),
);
const MAX_CONNECTIONS_PER_IP = readBoundedInteger('MAX_CONNECTIONS_PER_IP', 40, 1, 512);
const HANDSHAKE_TIMEOUT_MS = readBoundedInteger('HANDSHAKE_TIMEOUT_MS', 10_000, 500, 120_000);
const MESSAGE_RATE_WINDOW_MS = readBoundedInteger('MESSAGE_RATE_WINDOW_MS', 10_000, 1_000, 60_000);
const MAX_MESSAGES_PER_WINDOW = readBoundedInteger('MAX_MESSAGES_PER_WINDOW', 240, 50, 5_000);
if (process.env.NODE_ENV === 'production' && allowedWsOrigins.size === 0) {
  console.warn('SECURITY_CONFIG WebSocket browser origins are denied until WS_ALLOWED_ORIGINS is configured.');
}
const wss = new WebSocketServer({
  server: http,
  maxPayload: 16 * 1024,
  perMessageDeflate: false,
  verifyClient: (info, callback) => {
    // Origin validation is a browser cross-site WebSocket defense, not user authentication.
    if (!info.origin) return callback(true);
    if (allowedWsOrigins.size === 0 && process.env.NODE_ENV !== 'production') return callback(true);
    if (allowedWsOrigins.has(info.origin)) return callback(true);
    callback(false, 403, 'WebSocket origin is not allowed');
  },
});
type Player = { id: string; sessionToken: string; roomId: string; socket: WebSocket; transform: PlayerTransform; inventory: InventoryItemState[]; quests: QuestState[]; lastStateAt: number; lastActionAt: number; lastPongAt: number };
type DisconnectedSession = Omit<Player, 'socket' | 'lastStateAt' | 'lastActionAt' | 'lastPongAt'> & { expiresAt: number };
const players = new Map<WebSocket, Player>();
const sessions = new Map<string, DisconnectedSession>();
const roomLight = new Map<string, number>();
const litTargets = new Set<string>();
const pickedTargets = new Set<string>();
const roomMemories = new Map<string, MemorySequenceState>();
const roomFinalEvents = new Map<string, WorldEventState>();

const DIYA_TARGET_ID = 'diya-main-street-01';
const COMMUNITY_DIYA_TARGET_ID = 'community-diya-01';
const DIYA_POSITION = { x: 0, z: -4 };
const COMMUNITY_DIYA_POSITION = { x: 0, z: -24 };
const INTERACTION_RADIUS = 2.2;
const FLAME_SHARE_RADIUS = 2.5;
const STATE_INTERVAL_MS = 80;
const MAX_PLAYER_SPEED = 8;
const MOVEMENT_TOLERANCE = 0.4;
const ACTION_INTERVAL_MS = 250;
const heartbeatIntervalSetting = Number(process.env.HEARTBEAT_INTERVAL_MS);
const HEARTBEAT_INTERVAL_MS = Number.isFinite(heartbeatIntervalSetting) && heartbeatIntervalSetting > 0 ? Math.max(250, heartbeatIntervalSetting) : 15_000;
const HEARTBEAT_TIMEOUT_MS = 45_000;
const sessionGraceSetting = Number(process.env.SESSION_GRACE_MS);
const SESSION_GRACE_MS = Number.isFinite(sessionGraceSetting) && sessionGraceSetting > 0 ? Math.max(1_000, sessionGraceSetting) : 60_000;
// Keep room joins inside walkable bounds and clear of major collision props.
const SPAWN_POSITIONS: PlayerTransform[] = [
  // Preserve the original starting spots for existing small-room tests.
  { x: 0, y: 0.75, z: 4.5, rotation: 0 },
  { x: -0.9, y: 0.75, z: 4.5, rotation: 0 },
  { x: 0.9, y: 0.75, z: 4.5, rotation: 0 },
  { x: -1.8, y: 0.75, z: 4.5, rotation: 0 },
  { x: 1.8, y: 0.75, z: 4.5, rotation: 0 },
  { x: -0.9, y: 0.75, z: 6, rotation: 0 },
  { x: 0, y: 0.75, z: 6, rotation: 0 },
  { x: 0.9, y: 0.75, z: 6, rotation: 0 },
  { x: -1.8, y: 0.75, z: 6, rotation: 0 },
  { x: 1.8, y: 0.75, z: 6, rotation: 0 },
  // Four additional rows provide enough separated, walkable spawn positions for 30 players.
  { x: -2.4, y: 0.75, z: 7.5, rotation: 0 },
  { x: -1.2, y: 0.75, z: 7.5, rotation: 0 },
  { x: 0, y: 0.75, z: 7.5, rotation: 0 },
  { x: 1.2, y: 0.75, z: 7.5, rotation: 0 },
  { x: 2.4, y: 0.75, z: 7.5, rotation: 0 },
  { x: -2.4, y: 0.75, z: 9, rotation: 0 },
  { x: -1.2, y: 0.75, z: 9, rotation: 0 },
  { x: 0, y: 0.75, z: 9, rotation: 0 },
  { x: 1.2, y: 0.75, z: 9, rotation: 0 },
  { x: 2.4, y: 0.75, z: 9, rotation: 0 },
  { x: -2.4, y: 0.75, z: 10.5, rotation: 0 },
  { x: -1.2, y: 0.75, z: 10.5, rotation: 0 },
  { x: 0, y: 0.75, z: 10.5, rotation: 0 },
  { x: 1.2, y: 0.75, z: 10.5, rotation: 0 },
  { x: 2.4, y: 0.75, z: 10.5, rotation: 0 },
  { x: -2.4, y: 0.75, z: 12, rotation: 0 },
  { x: -1.2, y: 0.75, z: 12, rotation: 0 },
  { x: 0, y: 0.75, z: 12, rotation: 0 },
  { x: 1.2, y: 0.75, z: 12, rotation: 0 },
  { x: 2.4, y: 0.75, z: 12, rotation: 0 },
];

const PICKUPS: Record<string, { x: number; z: number; itemId: ItemId; quantity: number; questId?: QuestState['id'] }> = {
  'sharma-doorway-01': { x: -2.5, z: -1, itemId: 'wick', quantity: 2, questId: 'help-sharma-aunty' },
  'market-stall-01': { x: 2.5, z: -8, itemId: 'diya', quantity: 1, questId: 'market-lights' },
  'market-stall-02': { x: -2.5, z: -9.5, itemId: 'diya', quantity: 1, questId: 'market-lights' },
  'market-stall-03': { x: 2.5, z: -11, itemId: 'diya', quantity: 1, questId: 'market-lights' },
  'temple-memory-01': { x: 2.5, z: -17, itemId: 'memory_fragment', quantity: 1, questId: 'temple-memory' },
};

const FIRST_MEMORY: MemorySequenceState = {
  id: 'temple-memory-01',
  title: 'The light was never ours alone.',
  lines: ['Doorways glowed.', 'Children carried sweets.', 'Neighbours greeted one another.', 'One flame became another.'],
  active: true,
};

function send(socket: WebSocket, message: ServerMessage) { if (socket.readyState === WebSocket.OPEN) socket.send(encodeMessage(message)); }
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isClientMessage(message: { type: string }): message is ClientMessage {
  const candidate = message as unknown as Record<string, unknown>;
  if (typeof candidate.type !== 'string') return false;
  switch (candidate.type) {
    case 'hello':
      return typeof candidate.clientVersion === 'string' && candidate.clientVersion.length > 0 && candidate.clientVersion.length <= 64 &&
        (candidate.sessionToken === undefined || (typeof candidate.sessionToken === 'string' && candidate.sessionToken.length <= 128));
    case 'join_room':
      return typeof candidate.roomId === 'string' && candidate.roomId.length <= 128;
    case 'player_state':
      return isRecord(candidate.transform);
    case 'interact_request':
    case 'pickup_request':
      return typeof candidate.targetId === 'string' && candidate.targetId.length > 0 && candidate.targetId.length <= 128;
    case 'share_flame_request':
      return typeof candidate.targetPlayerId === 'string' && candidate.targetPlayerId.length > 0 && candidate.targetPlayerId.length <= 128;
    case 'memory_continue':
      return typeof candidate.memoryId === 'string' && candidate.memoryId.length > 0 && candidate.memoryId.length <= 128;
    case 'final_event_ready':
      return true;
    case 'ping':
      return typeof candidate.timestamp === 'number' && Number.isFinite(candidate.timestamp);
    default:
      return false;
  }
}
function broadcastRoom(roomId: string, message: ServerMessage, except?: WebSocket) { for (const player of players.values()) if (player.roomId === roomId && player.socket !== except) send(player.socket, message); }
function getRoomLight(roomId: string) { return roomLight.get(roomId) ?? LIGHT_LEVEL_START; }
function unlockedDistricts(roomId: string) { return getRoomLight(roomId) >= DARK_DISTRICT_UNLOCK_LEVEL ? ['dark-district'] : []; }
function getFinalEvent(roomId: string): WorldEventState { return roomFinalEvents.get(roomId) ?? { id: 'community-diya-celebration', active: false, completed: false }; }
function sendPlayerState(player: Player) {
  send(player.socket, { type: 'inventory_update', playerId: player.id, items: player.inventory });
  send(player.socket, { type: 'quest_update', playerId: player.id, quests: player.quests });
  send(player.socket, { type: 'world_state', lightLevel: getRoomLight(player.roomId), unlockedDistricts: unlockedDistricts(player.roomId) });
  const memory = roomMemories.get(player.roomId);
  if (memory) send(player.socket, { type: 'memory_started', memory });
  send(player.socket, { type: 'final_event_state', event: getFinalEvent(player.roomId) });
}
function sendRoomSnapshot(player: Player) {
  const roomPlayers = [...players.values()].filter((entry) => entry.roomId === player.roomId && entry.id !== player.id).map((entry) => ({ playerId: entry.id, transform: entry.transform }));
  send(player.socket, { type: 'room_snapshot', roomId: player.roomId, players: roomPlayers, lightLevel: getRoomLight(player.roomId), unlockedDistricts: unlockedDistricts(player.roomId), pickedTargets: [...pickedTargets].filter((key) => key.startsWith(`${player.roomId}:${player.id}:`)).map((key) => key.slice(`${player.roomId}:${player.id}:`.length)), litTargets: [...litTargets].filter((key) => key.startsWith(`${player.roomId}:`)).map((key) => key.slice(player.roomId.length + 1)), memory: roomMemories.get(player.roomId), finalEvent: getFinalEvent(player.roomId) });
}
function sendSession(player: Player, restored: boolean) { send(player.socket, { type: 'session_assigned', sessionToken: player.sessionToken, playerId: player.id, roomId: player.roomId, transform: player.transform, restored }); }

function awardQuestReward(player: Player, id: QuestState['id']) {
  const reward = getQuestDefinition(id)?.reward;
  if (!reward) return;
  const itemId = reward.itemId as ItemId;
  const existing = player.inventory.find((item) => item.id === itemId);
  if (existing) existing.quantity += reward.quantity;
  else player.inventory.push({ id: itemId, quantity: reward.quantity });
}

function advanceQuest(player: Player, id: QuestState['id'], amount = 1) {
  const current = player.quests.find((quest) => quest.id === id);
  if (!current || !canProgressQuest(player.quests, id)) return false;
  const wasCompleted = current.status === 'completed';
  current.status = 'active';
  current.progress = Math.min(current.target, current.progress + amount);
  if (current.progress >= current.target) {
    current.status = 'completed';
    if (!wasCompleted) awardQuestReward(player, id);
    const index = player.quests.findIndex((quest) => quest.id === id);
    const next = player.quests[index + 1];
    if (next) next.status = 'available';
  }
  send(player.socket, { type: 'quest_update', playerId: player.id, quests: player.quests });
  send(player.socket, { type: 'inventory_update', playerId: player.id, items: player.inventory });
  return true;
}

function increaseLight(roomId: string, source: string, amount: number) {
  const previous = getRoomLight(roomId);
  const level = Math.min(MAX_LIGHT_LEVEL, previous + amount);
  roomLight.set(roomId, level);
  broadcastRoom(roomId, { type: 'light_update', level, source });
  broadcastRoom(roomId, { type: 'world_state', lightLevel: level, unlockedDistricts: unlockedDistricts(roomId) });
}
function startMemory(roomId: string) { if (!roomMemories.has(roomId)) { roomMemories.set(roomId, FIRST_MEMORY); broadcastRoom(roomId, { type: 'memory_started', memory: FIRST_MEMORY }); } }
function completeMemory(roomId: string, memoryId: MemorySequenceState['id']) { const memory = roomMemories.get(roomId); if (!memory || memory.id !== memoryId) return false; roomMemories.delete(roomId); broadcastRoom(roomId, { type: 'memory_completed', memoryId }); return true; }
function startFinalEvent(roomId: string) { const existing = getFinalEvent(roomId); if (existing.active || existing.completed) return existing; const event: WorldEventState = { id: 'community-diya-celebration', active: true, completed: false, startedAt: Date.now() }; roomFinalEvents.set(roomId, event); broadcastRoom(roomId, { type: 'final_event_started', event }); return event; }
function rateLimited(player: Player) { const now = Date.now(); if (now - player.lastActionAt < ACTION_INTERVAL_MS) return true; player.lastActionAt = now; return false; }
function cleanupRoomState(roomId: string) {
  if ([...players.values()].some((player) => player.roomId === roomId)) return;
  if ([...sessions.values()].some((session) => session.roomId === roomId)) return;
  roomLight.delete(roomId);
  roomMemories.delete(roomId);
  roomFinalEvents.delete(roomId);
  const roomPrefix = `${roomId}:`;
  for (const key of litTargets) if (key.startsWith(roomPrefix)) litTargets.delete(key);
  for (const key of pickedTargets) if (key.startsWith(roomPrefix)) pickedTargets.delete(key);
}

function restoreSession(sessionToken: string | undefined, socket: WebSocket): Player | null {
  if (!sessionToken) return null;
  const saved = sessions.get(sessionToken);
  if (!saved) return null;
  if (saved.expiresAt < Date.now()) {
    sessions.delete(sessionToken);
    cleanupRoomState(saved.roomId);
    return null;
  }
  sessions.delete(sessionToken);
  return { ...saved, socket, lastStateAt: Date.now(), lastActionAt: 0, lastPongAt: Date.now() };
}

function handleMessage(socket: WebSocket, message: ClientMessage) {
  if (message.type === 'hello') { const restored = restoreSession(message.sessionToken, socket); if (restored) { players.set(socket, restored); sendSession(restored, true); broadcastRoom(restored.roomId, { type: 'player_spawned', playerId: restored.id, roomId: restored.roomId, transform: restored.transform }, socket); sendRoomSnapshot(restored); sendPlayerState(restored); } return; }
  if (message.type === 'join_room') {
    if (players.has(socket)) { const existing = players.get(socket)!; if (existing.roomId === message.roomId) { sendRoomSnapshot(existing); sendPlayerState(existing); } return; }
    const roomId = message.roomId.trim().replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 32) || 'main';
    const count = [...players.values()].filter((entry) => entry.roomId === roomId).length;
    if (count >= DEFAULT_ROOM_CAPACITY) { send(socket, { type: 'error', code: 'ROOM_FULL', message: 'Room is full' }); return; }
    const player: Player = { id: randomUUID(), sessionToken: randomUUID(), roomId, socket, transform: { ...SPAWN_POSITIONS[count] }, inventory: STARTING_INVENTORY.map((item) => ({ ...item })), quests: initialQuestStates(), lastStateAt: Date.now(), lastActionAt: 0, lastPongAt: Date.now() };
    players.set(socket, player); sendSession(player, false); sendRoomSnapshot(player); broadcastRoom(roomId, { type: 'player_spawned', playerId: player.id, roomId, transform: player.transform }, socket); send(socket, { type: 'light_update', level: getRoomLight(roomId), source: player.id }); sendPlayerState(player); return;
  }
  const player = players.get(socket);
  if (!player) { send(socket, { type: 'error', code: 'NOT_JOINED', message: 'Join a room first' }); return; }
  if (message.type === 'player_state') {
    const now = Date.now();
    if (now - player.lastStateAt < STATE_INTERVAL_MS) return;
    const elapsedSeconds = Math.max(STATE_INTERVAL_MS / 1000, (now - player.lastStateAt) / 1000);
    player.lastStateAt = now;

    const { x, y, z, rotation } = message.transform;
    if (![x, y, z, rotation].every(Number.isFinite)) {
      send(socket, { type: 'error', code: 'INVALID_TRANSFORM', message: 'Movement data must contain finite coordinates' });
      return;
    }

    const minZ = getRoomLight(player.roomId) >= DARK_DISTRICT_UNLOCK_LEVEL ? -27 : -19;
    if (x < -3.2 || x > 3.2 || y < 0.45 || y > 1.2 || z < minZ || z > 19 || rotation < -Math.PI || rotation > Math.PI) {
      send(socket, { type: 'error', code: 'OUT_OF_BOUNDS', message: 'That position is outside the walkable area' });
      return;
    }

    const distance = Math.hypot(x - player.transform.x, z - player.transform.z);
    const allowedDistance = MAX_PLAYER_SPEED * elapsedSeconds + MOVEMENT_TOLERANCE;
    if (distance > allowedDistance) {
      send(socket, { type: 'error', code: 'MOVE_TOO_FAST', message: 'Movement was too fast; move through the neighbourhood more gradually' });
      return;
    }

    const districtUnlocked = getRoomLight(player.roomId) >= DARK_DISTRICT_UNLOCK_LEVEL;
    if (!isWalkablePosition(x, z, districtUnlocked)) {
      send(socket, { type: 'error', code: 'COLLISION', message: 'That position is blocked by a neighbourhood object' });
      return;
    }

    player.transform = { x, y, z, rotation };
    broadcastRoom(player.roomId, { type: 'player_state', playerId: player.id, transform: player.transform }, socket);
    return;
  }

  if (message.type === 'interact_request') {
    if (rateLimited(player)) return;
    if (message.targetId === DIYA_TARGET_ID) {
      if (!isNear(player.transform, DIYA_POSITION, INTERACTION_RADIUS)) { send(socket, { type: 'error', code: 'TOO_FAR', message: 'Move closer to the diya' }); return; }
      const targetKey = `${player.roomId}:${DIYA_TARGET_ID}`;
      if (!litTargets.has(targetKey)) {
        litTargets.add(targetKey);
        broadcastRoom(player.roomId, { type: 'target_state', targetId: DIYA_TARGET_ID, active: true });
        increaseLight(player.roomId, player.id, 10);
      }
      // The flame is shared, but the first-flame quest belongs to each player.
      advanceQuest(player, 'first-flame');
      send(socket, { type: 'interaction_result', success: true, targetId: DIYA_TARGET_ID, lightLevel: getRoomLight(player.roomId), source: player.id }); return;
    }
    if (message.targetId === COMMUNITY_DIYA_TARGET_ID) {
      if (getRoomLight(player.roomId) < FINAL_EVENT_LEVEL) { send(socket, { type: 'error', code: 'LIGHT_TOO_LOW', message: 'The neighbourhood is not fully lit yet' }); return; }
      if (!unlockedDistricts(player.roomId).includes('dark-district')) { send(socket, { type: 'error', code: 'DISTRICT_LOCKED', message: 'The Dark District is still closed' }); return; }
      if (!isNear(player.transform, COMMUNITY_DIYA_POSITION, INTERACTION_RADIUS)) { send(socket, { type: 'error', code: 'TOO_FAR', message: 'Move closer to the community diya' }); return; }
      const quest = player.quests.find((entry) => entry.id === 'last-diya');
      if (!quest || !canProgressQuest(player.quests, 'last-diya')) { send(socket, { type: 'error', code: 'QUEST_INCOMPLETE', message: 'Restore the temple memory before carrying the last diya' }); return; }
      advanceQuest(player, 'last-diya'); startFinalEvent(player.roomId); send(socket, { type: 'interaction_result', success: true, targetId: COMMUNITY_DIYA_TARGET_ID, lightLevel: getRoomLight(player.roomId), source: player.id }); return;
    }
    send(socket, { type: 'error', code: 'INVALID_TARGET', message: 'Unknown interaction target' }); return;
  }

  if (message.type === 'pickup_request') {
    if (rateLimited(player)) return;
    const pickup = PICKUPS[message.targetId];
    if (!pickup || !isNear(player.transform, pickup, INTERACTION_RADIUS)) { send(socket, { type: 'error', code: 'INVALID_PICKUP', message: 'That item is not available here' }); return; }
    if (pickup.questId && !canProgressQuest(player.quests, pickup.questId)) { send(socket, { type: 'error', code: 'QUEST_LOCKED', message: 'Complete the previous quest before taking this step' }); return; }
    const targetKey = `${player.roomId}:${player.id}:${message.targetId}`;
    if (pickedTargets.has(targetKey)) { send(socket, { type: 'pickup_result', success: false, targetId: message.targetId, itemId: pickup.itemId, quantity: 0 }); return; }
    pickedTargets.add(targetKey);
    const existing = player.inventory.find((item) => item.id === pickup.itemId);
    if (existing) existing.quantity += pickup.quantity; else player.inventory.push({ id: pickup.itemId, quantity: pickup.quantity });
    send(socket, { type: 'pickup_result', success: true, targetId: message.targetId, itemId: pickup.itemId, quantity: pickup.quantity });
    if (message.targetId === 'sharma-doorway-01') advanceQuest(player, 'help-sharma-aunty');
    if (message.targetId.startsWith('market-stall-')) advanceQuest(player, 'market-lights');
    if (message.targetId === 'temple-memory-01') { const state = player.quests.find((quest) => quest.id === 'temple-memory'); if (state) state.status = 'active'; send(player.socket, { type: 'quest_update', playerId: player.id, quests: player.quests }); startMemory(player.roomId); }
    send(player.socket, { type: 'inventory_update', playerId: player.id, items: player.inventory }); return;
  }

  if (message.type === 'memory_continue') {
    if (rateLimited(player)) return;
    if (!completeMemory(player.roomId, message.memoryId)) return;
    advanceQuest(player, 'temple-memory');
    return;
  }
  if (message.type === 'final_event_ready') {
    if (rateLimited(player)) return;
    if (getRoomLight(player.roomId) < FINAL_EVENT_LEVEL) { send(socket, { type: 'error', code: 'LIGHT_TOO_LOW', message: 'Reach 100% Light Level first' }); return; }
    const quest = player.quests.find((entry) => entry.id === 'last-diya');
    if (quest?.status !== 'completed') { send(socket, { type: 'error', code: 'QUEST_INCOMPLETE', message: 'Light the last community diya first' }); return; }
    startFinalEvent(player.roomId); return;
  }
  if (message.type === 'share_flame_request') {
    if (rateLimited(player)) return;
    const target = [...players.values()].find((entry) => entry.id === message.targetPlayerId && entry.roomId === player.roomId);
    if (!target || target.id === player.id) { send(socket, { type: 'error', code: 'PLAYER_NOT_FOUND', message: 'That player is no longer nearby' }); return; }
    if (!isNear(player.transform, target.transform, FLAME_SHARE_RADIUS)) { send(socket, { type: 'error', code: 'TOO_FAR', message: 'Stand closer to share your flame' }); return; }
    increaseLight(player.roomId, player.id, 5);
    // The post-finale epilogue is personal: every player must make three meaningful shares.
    advanceQuest(player, 'share-the-light');
    broadcastRoom(player.roomId, { type: 'flame_shared', fromPlayerId: player.id, toPlayerId: target.id, lightLevel: getRoomLight(player.roomId) }); return;
  }
  if (message.type === 'ping') { player.lastPongAt = Date.now(); send(socket, { type: 'pong', timestamp: message.timestamp }); }
}

const connectionsByIp = new Map<string, number>();

wss.on('connection', (socket, request) => {
  const remoteIp = request.socket.remoteAddress ?? 'unknown';
  const currentIpConnections = connectionsByIp.get(remoteIp) ?? 0;
  let connectionTracked = false;
  let handshakeTimer: NodeJS.Timeout | undefined;
  let helloReceived = false;
  let invalidMessageCount = 0;
  let messageWindowStartedAt = Date.now();
  let messageCountInWindow = 0;

  if (currentIpConnections >= MAX_CONNECTIONS_PER_IP) {
    socket.close(1013, 'Per-IP connection limit exceeded');
  } else {
    connectionsByIp.set(remoteIp, currentIpConnections + 1);
    connectionTracked = true;
    handshakeTimer = setTimeout(() => {
      if (!players.has(socket) && socket.readyState === WebSocket.OPEN) {
        socket.close(1008, 'Handshake timeout');
      }
    }, HANDSHAKE_TIMEOUT_MS);
    handshakeTimer.unref();
  }

  socket.on('message', (raw) => {
    if (!connectionTracked) return;
    const now = Date.now();
    if (now - messageWindowStartedAt >= MESSAGE_RATE_WINDOW_MS) {
      messageWindowStartedAt = now;
      messageCountInWindow = 0;
    }
    messageCountInWindow += 1;
    if (messageCountInWindow > MAX_MESSAGES_PER_WINDOW) {
      socket.close(1008, 'Message rate limit exceeded');
      return;
    }

    const message = decodeMessage(raw.toString());
    if (!message || !isClientMessage(message)) {
      invalidMessageCount += 1;
      send(socket, { type: 'error', code: 'INVALID_MESSAGE', message: 'Message shape or type is invalid' });
      if (invalidMessageCount >= 5 && socket.readyState === WebSocket.OPEN) socket.close(1008, 'Invalid message sequence');
      return;
    }

    if (message.type === 'hello') {
      if (helloReceived) {
        socket.close(1008, 'Duplicate hello');
        return;
      }
      helloReceived = true;
    } else if (message.type === 'join_room' && !helloReceived) {
      send(socket, { type: 'error', code: 'HELLO_REQUIRED', message: 'Send hello before joining a room' });
      return;
    }

    handleMessage(socket, message);
    if (players.has(socket) && handshakeTimer) {
      clearTimeout(handshakeTimer);
      handshakeTimer = undefined;
    }
  });

  socket.on('pong', () => { const player = players.get(socket); if (player) player.lastPongAt = Date.now(); });
  socket.on('close', () => {
    if (handshakeTimer) clearTimeout(handshakeTimer);
    if (connectionTracked) {
      const remaining = Math.max(0, (connectionsByIp.get(remoteIp) ?? 1) - 1);
      if (remaining === 0) connectionsByIp.delete(remoteIp);
      else connectionsByIp.set(remoteIp, remaining);
      connectionTracked = false;
    }
    const player = players.get(socket);
    if (!player) return;
    players.delete(socket);
    sessions.set(player.sessionToken, {
      id: player.id,
      sessionToken: player.sessionToken,
      roomId: player.roomId,
      transform: player.transform,
      inventory: player.inventory,
      quests: player.quests,
      expiresAt: Date.now() + SESSION_GRACE_MS,
    });
    broadcastRoom(player.roomId, { type: 'player_left', playerId: player.id });
  });
  socket.on('error', () => socket.close());
});
const heartbeat = setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt < now) {
      sessions.delete(token);
      cleanupRoomState(session.roomId);
    }
  }
  for (const player of players.values()) {
    if (now - player.lastPongAt > HEARTBEAT_TIMEOUT_MS) { player.socket.terminate(); continue; }
    try { player.socket.ping(); } catch { player.socket.terminate(); }
  }
}, HEARTBEAT_INTERVAL_MS);

// Opt-in profiling for CI. This logs metrics without exposing a public metrics endpoint.
let performanceMetricsTimer: NodeJS.Timeout | undefined;
let performanceEventLoopDelay: ReturnType<typeof monitorEventLoopDelay> | undefined;
if (process.env.PERF_METRICS === '1') {
  const eventLoopDelay = monitorEventLoopDelay({ resolution: 10 });
  performanceEventLoopDelay = eventLoopDelay;
  eventLoopDelay.enable();
  let previousCpuUsage = process.cpuUsage();
  performanceMetricsTimer = setInterval(() => {
    const cpu = process.cpuUsage(previousCpuUsage);
    previousCpuUsage = process.cpuUsage();
    const memory = process.memoryUsage();
    const metrics = {
      connectedClients: players.size,
      eventLoopP95Ms: Number((eventLoopDelay.percentile(95) / 1e6).toFixed(2)),
      eventLoopMaxMs: Number((eventLoopDelay.max / 1e6).toFixed(2)),
      cpuUserMs: Math.round(cpu.user / 1000),
      cpuSystemMs: Math.round(cpu.system / 1000),
      rssMb: Number((memory.rss / 1024 / 1024).toFixed(1)),
      heapUsedMb: Number((memory.heapUsed / 1024 / 1024).toFixed(1)),
    };
    console.log('PERF_METRICS ' + JSON.stringify(metrics));
    eventLoopDelay.reset();
  }, 1000);
  performanceMetricsTimer.unref();
}
process.on('SIGTERM', () => {
  clearInterval(heartbeat);
  if (performanceMetricsTimer) clearInterval(performanceMetricsTimer);
  performanceEventLoopDelay?.disable();
  http.close();
});
http.listen(port, () => console.log('The Last Diya server listening on :' + port));
