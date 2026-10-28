import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { DARK_DISTRICT_UNLOCK_LEVEL, DEFAULT_ROOM_CAPACITY, FINAL_EVENT_LEVEL, LIGHT_LEVEL_START, MAX_LIGHT_LEVEL } from '@the-last-diya/shared';
import type { ClientMessage, InventoryItemState, ItemId, MemorySequenceState, PlayerTransform, QuestState, ServerMessage, WorldEventState } from '@the-last-diya/shared';
import { STARTING_INVENTORY, canProgressQuest, getQuestDefinition, initialQuestStates, isNear } from '@the-last-diya/game-core';
import { decodeMessage, encodeMessage } from '@the-last-diya/networking';

const port = Number(process.env.PORT ?? 8787);
const http = createServer((_, response) => { response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ name: 'the-last-diya-server', status: 'ok', phase: 'vertical-slice' })); });
const wss = new WebSocketServer({ server: http });
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
const ACTION_INTERVAL_MS = 250;
const HEARTBEAT_INTERVAL_MS = 15_000;
const HEARTBEAT_TIMEOUT_MS = 45_000;
const SESSION_GRACE_MS = 60_000;
const spawnTransform: PlayerTransform = { x: 0, y: 0.75, z: 4, rotation: 0 };

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
const CLIENT_MESSAGE_TYPES = new Set<ClientMessage['type']>([
  'hello',
  'join_room',
  'player_state',
  'interact_request',
  'share_flame_request',
  'pickup_request',
  'memory_continue',
  'final_event_ready',
  'ping',
]);
function isClientMessage(message: { type: string }): message is ClientMessage {
  return CLIENT_MESSAGE_TYPES.has(message.type as ClientMessage['type']);
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
function rateLimited(player: Player, kind: 'state' | 'action') { const now = Date.now(); if (kind === 'state') { if (now - player.lastStateAt < STATE_INTERVAL_MS) return true; player.lastStateAt = now; } else { if (now - player.lastActionAt < ACTION_INTERVAL_MS) return true; player.lastActionAt = now; } return false; }
function restoreSession(sessionToken: string | undefined, socket: WebSocket): Player | null { if (!sessionToken) return null; const saved = sessions.get(sessionToken); if (!saved || saved.expiresAt < Date.now()) { sessions.delete(sessionToken); return null; } sessions.delete(sessionToken); return { ...saved, socket, lastStateAt: 0, lastActionAt: 0, lastPongAt: Date.now() }; }

function handleMessage(socket: WebSocket, message: ClientMessage) {
  if (message.type === 'hello') { const restored = restoreSession(message.sessionToken, socket); if (restored) { players.set(socket, restored); sendSession(restored, true); broadcastRoom(restored.roomId, { type: 'player_spawned', playerId: restored.id, roomId: restored.roomId, transform: restored.transform }, socket); sendRoomSnapshot(restored); sendPlayerState(restored); } return; }
  if (message.type === 'join_room') {
    if (players.has(socket)) { const existing = players.get(socket)!; if (existing.roomId === message.roomId) { sendRoomSnapshot(existing); sendPlayerState(existing); } return; }
    const roomId = message.roomId.trim().slice(0, 32) || 'main';
    const count = [...players.values()].filter((entry) => entry.roomId === roomId).length;
    if (count >= DEFAULT_ROOM_CAPACITY) { send(socket, { type: 'error', code: 'ROOM_FULL', message: 'Room is full' }); return; }
    const player: Player = { id: randomUUID(), sessionToken: randomUUID(), roomId, socket, transform: { ...spawnTransform, x: count * 1.2 - 4.8 }, inventory: STARTING_INVENTORY.map((item) => ({ ...item })), quests: initialQuestStates(), lastStateAt: 0, lastActionAt: 0, lastPongAt: Date.now() };
    players.set(socket, player); sendSession(player, false); sendRoomSnapshot(player); broadcastRoom(roomId, { type: 'player_spawned', playerId: player.id, roomId, transform: player.transform }, socket); send(socket, { type: 'light_update', level: getRoomLight(roomId), source: player.id }); sendPlayerState(player); return;
  }
  const player = players.get(socket);
  if (!player) { send(socket, { type: 'error', code: 'NOT_JOINED', message: 'Join a room first' }); return; }
  if (message.type === 'player_state') { if (rateLimited(player, 'state')) return; const { x, y, z, rotation } = message.transform; if (![x, y, z, rotation].every(Number.isFinite)) return; player.transform = { x: Math.max(-3.2, Math.min(3.2, x)), y: Math.max(0, Math.min(3, y)), z: Math.max(-27, Math.min(19, z)), rotation: Math.max(-Math.PI, Math.min(Math.PI, rotation)) }; broadcastRoom(player.roomId, { type: 'player_state', playerId: player.id, transform: player.transform }, socket); return; }

  if (message.type === 'interact_request') {
    if (rateLimited(player, 'action')) return;
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
    if (rateLimited(player, 'action')) return;
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
    if (rateLimited(player, 'action')) return;
    if (!completeMemory(player.roomId, message.memoryId)) return;
    advanceQuest(player, 'temple-memory');
    return;
  }
  if (message.type === 'final_event_ready') {
    if (rateLimited(player, 'action')) return;
    if (getRoomLight(player.roomId) < FINAL_EVENT_LEVEL) { send(socket, { type: 'error', code: 'LIGHT_TOO_LOW', message: 'Reach 100% Light Level first' }); return; }
    const quest = player.quests.find((entry) => entry.id === 'last-diya');
    if (quest?.status !== 'completed') { send(socket, { type: 'error', code: 'QUEST_INCOMPLETE', message: 'Light the last community diya first' }); return; }
    startFinalEvent(player.roomId); return;
  }
  if (message.type === 'share_flame_request') {
    if (rateLimited(player, 'action')) return;
    const target = [...players.values()].find((entry) => entry.id === message.targetPlayerId && entry.roomId === player.roomId);
    if (!target || target.id === player.id) { send(socket, { type: 'error', code: 'PLAYER_NOT_FOUND', message: 'That player is no longer nearby' }); return; }
    if (!isNear(player.transform, target.transform, FLAME_SHARE_RADIUS)) { send(socket, { type: 'error', code: 'TOO_FAR', message: 'Stand closer to share your flame' }); return; }
    increaseLight(player.roomId, player.id, 5); broadcastRoom(player.roomId, { type: 'flame_shared', fromPlayerId: player.id, toPlayerId: target.id, lightLevel: getRoomLight(player.roomId) }); return;
  }
  if (message.type === 'ping') { player.lastPongAt = Date.now(); send(socket, { type: 'pong', timestamp: message.timestamp }); }
}

wss.on('connection', (socket) => {
  socket.on('message', (raw) => { const message = decodeMessage(raw.toString()); if (message && isClientMessage(message)) handleMessage(socket, message); });
  socket.on('pong', () => { const player = players.get(socket); if (player) player.lastPongAt = Date.now(); });
  socket.on('close', () => { const player = players.get(socket); if (!player) return; players.delete(socket); sessions.set(player.sessionToken, { id: player.id, sessionToken: player.sessionToken, roomId: player.roomId, transform: player.transform, inventory: player.inventory, quests: player.quests, expiresAt: Date.now() + SESSION_GRACE_MS }); broadcastRoom(player.roomId, { type: 'player_left', playerId: player.id }); });
  socket.on('error', () => socket.close());
});
const heartbeat = setInterval(() => { const now = Date.now(); for (const [token, session] of sessions) if (session.expiresAt < now) sessions.delete(token); for (const player of players.values()) { if (now - player.lastPongAt > HEARTBEAT_TIMEOUT_MS) { player.socket.terminate(); continue; } try { player.socket.ping(); } catch { player.socket.terminate(); } } }, HEARTBEAT_INTERVAL_MS);
process.on('SIGTERM', () => { clearInterval(heartbeat); http.close(); });
http.listen(port, () => console.log(`The Last Diya server listening on :${port}`));
