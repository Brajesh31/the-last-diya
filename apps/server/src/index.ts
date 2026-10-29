import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { WebSocketServer, WebSocket } from 'ws';
import { DARK_DISTRICT_UNLOCK_LEVEL, DEFAULT_ROOM_CAPACITY, FINAL_EVENT_LEVEL, LIGHT_LEVEL_START, MAX_LIGHT_LEVEL } from '@the-last-diya/shared';
import type { ClientMessage, InventoryItemState, ItemId, MemorySequenceState, PlayerTransform, QuestState, ServerMessage, WorldEventState } from '@the-last-diya/shared';
import { STARTING_INVENTORY, canProgressQuest, getQuestDefinition, initialQuestStates, isNear, isWalkablePosition } from '@the-last-diya/game-core';
import { decodeMessage, encodeMessage } from '@the-last-diya/networking';

const port = Number(process.env.PORT ?? 8787);
const buildVersion = process.env.BUILD_VERSION ?? process.env.npm_package_version ?? 'development';
const startedAt = Date.now();
const http = createServer((request, response) => {
  const path = request.url?.split('?')[0] ?? '/';
  if (path === '/health' || path === '/ready') {
    const ready = allowedWsOrigins.size > 0 || process.env.NODE_ENV !== 'production';
    response.writeHead(ready ? 200 : 503, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify({ name: 'the-last-diya-server', status: ready ? 'ok' : 'not-ready', ready, version: buildVersion, uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000), players: players.size }));
    return;
  }
  response.writeHead(404, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  response.end(JSON.stringify({ error: 'not_found' }));
});
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
  { x: 0, y: 0.75, z: 4.5, rotation: 0 }, { x: -0.9, y: 0.75, z: 4.5, rotation: 0 }, { x: 0.9, y: 0.75, z: 4.5, rotation: 0 }, { x: -1.8, y: 0.75, z: 4.5, rotation: 0 }, { x: 1.8, y: 0.75, z: 4.5, rotation: 0 },
  { x: -0.9, y: 0.75, z: 6, rotation: 0 }, { x: 0, y: 0.75, z: 6, rotation: 0 }, { x: 0.9, y: 0.75, z: 6, rotation: 0 }, { x: -1.8, y: 0.75, z: 6, rotation: 0 }, { x: 1.8, y: 0.75, z: 6, rotation: 0 },
  { x: -2.4, y: 0.75, z: 7.5, rotation: 0 }, { x: -1.2, y: 0.75, z: 7.5, rotation: 0 }, { x: 0, y: 0.75, z: 7.5, rotation: 0 }, { x: 1.2, y: 0.75, z: 7.5, rotation: 0 }, { x: 2.4, y: 0.75, z: 7.5, rotation: 0 },
  { x: -2.4, y: 0.75, z: 9, rotation: 0 }, { x: -1.2, y: 0.75, z: 9, rotation: 0 }, { x: 0, y: 0.75, z: 9, rotation: 0 }, { x: 1.2, y: 0.75, z: 9, rotation: 0 }, { x: 2.4, y: 0.75, z: 9, rotation: 0 },
  { x: -2.4, y: 0.75, z: 10.5, rotation: 0 }, { x: -1.2, y: 0.75, z: 10.5, rotation: 0 }, { x: 0, y: 0.75, z: 10.5, rotation: 0 }, { x: 1.2, y: 0.75, z: 10.5, rotation: 0 }, { x: 2.4, y: 0.75, z: 10.5, rotation: 0 },
  { x: -2.4, y: 0.75, z: 12, rotation: 0 }, { x: -1.2, y: 0.75, z: 12, rotation: 0 }, { x: 0, y: 0.75, z: 12, rotation: 0 }, { x: 1.2, y: 0.75, z: 12, rotation: 0 }, { x: 2.4, y: 0.75, z: 12, rotation: 0 },
];

const PICKUPS: Record<string, { x: number; z: number; itemId: ItemId; quantity: number; questId?: QuestState['id'] }> = {
  'sharma-doorway-01': { x: -2.5, z: -1, itemId: 'wick', quantity: 2, questId: 'help-sharma-aunty' },
  'market-stall-01': { x: 2.5, z: -8, itemId: 'diya', quantity: 1, questId: 'market-lights' },
  'market-stall-02': { x: -2.5, z: -9.5, itemId: 'diya', quantity: 1, questId: 'market-lights' },
  'market-stall-03': { x: 2.5, z: -11, itemId: 'diya', quantity: 1, questId: 'market-lights' },
  'temple-memory-01': { x: 2.5, z: -17, itemId: 'memory_fragment', quantity: 1, questId: 'temple-memory' },
};

const FIRST_MEMORY: MemorySequenceState = { id: 'temple-memory-01', title: 'The light was never ours alone.', lines: ['Doorways glowed.', 'Children carried sweets.', 'Neighbours greeted one another.', 'One flame became another.'], active: true };
function send(socket: WebSocket, message: ServerMessage) { if (socket.readyState === WebSocket.OPEN) socket.send(encodeMessage(message)); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function isClientMessage(message: { type: string }): message is ClientMessage { const candidate = message as unknown as Record<string, unknown>; if (typeof candidate.type !== 'string') return false; switch (candidate.type) { case 'hello': return typeof candidate.clientVersion === 'string' && candidate.clientVersion.length > 0 && candidate.clientVersion.length <= 64 && (candidate.sessionToken === undefined || (typeof candidate.sessionToken === 'string' && candidate.sessionToken.length <= 128)); case 'join_room': return typeof candidate.roomId === 'string' && candidate.roomId.length <= 128; case 'player_state': return isRecord(candidate.transform); case 'interact_request': case 'pickup_request': return typeof candidate.targetId === 'string' && candidate.targetId.length > 0 && candidate.targetId.length <= 128; case 'share_flame_request': return typeof candidate.targetPlayerId === 'string' && candidate.targetPlayerId.length > 0 && candidate.targetPlayerId.length <= 128; case 'memory_continue': return typeof candidate.memoryId === 'string' && candidate.memoryId.length > 0 && candidate.memoryId.length <= 128; case 'final_event_ready': return true; case 'ping': return typeof candidate.timestamp === 'number' && Number.isFinite(candidate.timestamp); default: return false; } }
function broadcastRoom(roomId: string, message: ServerMessage, except?: WebSocket) { for (const player of players.values()) if (player.roomId === roomId && player.socket !== except) send(player.socket, message); }
function getRoomLight(roomId: string) { return roomLight.get(roomId) ?? LIGHT_LEVEL_START; }
function unlockedDistricts(roomId: string) { return getRoomLight(roomId) >= DARK_DISTRICT_UNLOCK_LEVEL ? ['dark-district'] : []; }
function getFinalEvent(roomId: string): WorldEventState { return roomFinalEvents.get(roomId) ?? { id: 'community-diya-celebration', active: false, completed: false }; }
function sendPlayerState(player: Player) { send(player.socket, { type: 'inventory_update', playerId: player.id, items: player.inventory }); send(player.socket, { type: 'quest_update', playerId: player.id, quests: player.quests }); send(player.socket, { type: 'world_state', lightLevel: getRoomLight(player.roomId), unlockedDistricts: unlockedDistricts(player.roomId) }); const memory = roomMemories.get(player.roomId); if (memory) send(player.socket, { type: 'memory_started', memory }); send(player.socket, { type: 'final_event_state', event: getFinalEvent(player.roomId) }); }
function sendRoomSnapshot(player: Player) { const roomPlayers = [...players.values()].filter((entry) => entry.roomId === player.roomId && entry.id !== player.id).map((entry) => ({ playerId: entry.id, transform: entry.transform })); send(player.socket, { type: 'room_snapshot', roomId: player.roomId, players: roomPlayers, lightLevel: getRoomLight(player.roomId), unlockedDistricts: unlockedDistricts(player.roomId), pickedTargets: [...pickedTargets].filter((key) => key.startsWith(`${player.roomId}:${player.id}:`)).map((key) => key.slice(`${player.roomId}:${player.id}:`.length)), litTargets: [...litTargets].filter((key) => key.startsWith(`${player.roomId}:`)).map((key) => key.slice(player.roomId.length + 1)), memory: roomMemories.get(player.roomId), finalEvent: getFinalEvent(player.roomId) }); }
function sendSession(player: Player, restored: boolean) { send(player.socket, { type: 'session_assigned', sessionToken: player.sessionToken, playerId: player.id, roomId: player.roomId, transform: player.transform, restored }); }
function awardQuestReward(player: Player, id: QuestState['id']) { const reward = getQuestDefinition(id)?.reward; if (!reward) return; const itemId = reward.itemId as ItemId; const existing = player.inventory.find((item) => item.id === itemId); if (existing) existing.quantity += reward.quantity; else player.inventory.push({ id: itemId, quantity: reward.quantity }); }
function advanceQuest(player: Player, id: QuestState['id'], amount = 1) { const current = player.quests.find((quest) => quest.id === id); if (!current || !canProgressQuest(player.quests, id)) return false; const wasCompleted = current.status === 'completed'; current.status = 'active'; current.progress = Math.min(current.target, current.progress + amount); if (current.progress >= current.target) { current.status = 'completed'; if (!wasCompleted) awardQuestReward(player, id); const index = player.quests.findIndex((quest) => quest.id === id); const next = player.quests[index + 1]; if (next) next.status = 'available'; } send(player.socket, { type: 'quest_update', playerId: player.id, quests: player.quests }); send(player.socket, { type: 'inventory_update', playerId: player.id, items: player.inventory }); return true; }
function increaseLight(roomId: string, source: string, amount: number) { const previous = getRoomLight(roomId); const level = Math.min(MAX_LIGHT_LEVEL, previous + amount); roomLight.set(roomId, level); broadcastRoom(roomId, { type: 'light_update', level, source }); broadcastRoom(roomId, { type: 'world_state', lightLevel: level, unlockedDistricts: unlockedDistricts(roomId) }); }
function startMemory(roomId: string) { if (!roomMemories.has(roomId)) { roomMemories.set(roomId, FIRST_MEMORY); broadcastRoom(roomId, { type: 'memory_started', memory: FIRST_MEMORY }); } }
function completeMemory(roomId: string, memoryId: MemorySequenceState['id']) { const memory = roomMemories.get(roomId); if (!memory || memory.id !== memoryId) return false; roomMemories.delete(roomId); broadcastRoom(roomId, { type: 'memory_completed', memoryId }); return true; }
function startFinalEvent(roomId: string) { const existing = getFinalEvent(roomId); if (existing.active || existing.completed) return existing; const event: WorldEventState = { id: 'community-diya-celebration', active: true, completed: false, startedAt: Date.now() }; roomFinalEvents.set(roomId, event); broadcastRoom(roomId, { type: 'final_event_started', event }); return event; }
function rateLimited(player: Player) { const now = Date.now(); const windowStart = now - MESSAGE_RATE_WINDOW_MS; const key = `${player.id}:rate`; const state = (player as Player & { rate?: { startedAt: number; count: number } }).rate; if (!state || state.startedAt < windowStart) { (player as Player & { rate?: { startedAt: number; count: number } }).rate = { startedAt: now, count: 1 }; return false; } state.count += 1; return state.count > MAX_MESSAGES_PER_WINDOW; }
