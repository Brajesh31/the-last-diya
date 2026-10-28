import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { DEFAULT_ROOM_CAPACITY, LIGHT_LEVEL_START, MAX_LIGHT_LEVEL } from '@the-last-diya/shared';
import type { ClientMessage, InventoryItemState, ItemId, PlayerTransform, QuestState, ServerMessage } from '@the-last-diya/shared';
import { STARTING_INVENTORY, initialQuestStates, isNear } from '@the-last-diya/game-core';
import { decodeMessage, encodeMessage } from '@the-last-diya/networking';

const port = Number(process.env.PORT ?? 8787);
const http = createServer((_, response) => { response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ name: 'the-last-diya-server', status: 'ok', phase: 'core-gameplay' })); });
const wss = new WebSocketServer({ server: http });

type Player = { id: string; roomId: string; socket: WebSocket; transform: PlayerTransform; inventory: InventoryItemState[]; quests: QuestState[] };
const players = new Map<WebSocket, Player>();
const roomLight = new Map<string, number>();
const litTargets = new Set<string>();
const pickedTargets = new Set<string>();
const DIYA_TARGET_ID = 'diya-main-street-01';
const DIYA_POSITION = { x: 0, z: -4 };
const INTERACTION_RADIUS = 2.2;
const FLAME_SHARE_RADIUS = 2.5;
const spawnTransform: PlayerTransform = { x: 0, y: 0.75, z: 4, rotation: 0 };
const PICKUPS: Record<string, { x: number; z: number; itemId: ItemId; quantity: number }> = {
  'sharma-doorway-01': { x: -2.5, z: -1, itemId: 'wick', quantity: 2 },
  'market-stall-01': { x: 2.5, z: -8, itemId: 'diya', quantity: 1 },
  'market-stall-02': { x: -2.5, z: -9.5, itemId: 'diya', quantity: 1 },
  'market-stall-03': { x: 2.5, z: -11, itemId: 'diya', quantity: 1 },
  'temple-memory-01': { x: 2.5, z: -17, itemId: 'memory_fragment', quantity: 1 },
};
function send(socket: WebSocket, message: ServerMessage) { if (socket.readyState === WebSocket.OPEN) socket.send(encodeMessage(message)); }
function broadcastRoom(roomId: string, message: ServerMessage, except?: WebSocket) { for (const player of players.values()) if (player.roomId === roomId && player.socket !== except) send(player.socket, message); }
function getRoomLight(roomId: string) { return roomLight.get(roomId) ?? LIGHT_LEVEL_START; }
function unlockedDistricts(roomId: string) { return getRoomLight(roomId) >= 90 ? ['dark-district'] : []; }
function sendPlayerState(player: Player) { send(player.socket, { type: 'inventory_update', playerId: player.id, items: player.inventory }); send(player.socket, { type: 'quest_update', playerId: player.id, quests: player.quests }); send(player.socket, { type: 'world_state', lightLevel: getRoomLight(player.roomId), unlockedDistricts: unlockedDistricts(player.roomId) }); }
function advanceQuest(player: Player, id: QuestState['id'], amount = 1) {
  const current = player.quests.find((quest) => quest.id === id);
  if (!current || current.status === 'locked' || current.status === 'completed') return;
  current.status = 'active'; current.progress = Math.min(current.target, current.progress + amount);
  if (current.progress >= current.target) { current.status = 'completed'; const index = player.quests.findIndex((quest) => quest.id === id); const next = player.quests[index + 1]; if (next) next.status = 'available'; }
  send(player.socket, { type: 'quest_update', playerId: player.id, quests: player.quests });
}
function increaseLight(roomId: string, source: string, amount: number) {
  const level = Math.min(MAX_LIGHT_LEVEL, getRoomLight(roomId) + amount); roomLight.set(roomId, level);
  broadcastRoom(roomId, { type: 'light_update', level, source });
  broadcastRoom(roomId, { type: 'world_state', lightLevel: level, unlockedDistricts: unlockedDistricts(roomId) });
}
function handleMessage(socket: WebSocket, message: ClientMessage) {
  if (message.type === 'join_room') {
    if (players.has(socket)) return;
    const roomId = message.roomId.trim().slice(0, 32) || 'main';
    const count = [...players.values()].filter((entry) => entry.roomId === roomId).length;
    if (count >= DEFAULT_ROOM_CAPACITY) { send(socket, { type: 'error', code: 'ROOM_FULL', message: 'Room is full' }); return; }
    const player: Player = { id: randomUUID(), roomId, socket, transform: { ...spawnTransform, x: count * 1.2 - 4.8 }, inventory: STARTING_INVENTORY.map((item) => ({ ...item })), quests: initialQuestStates() };
    players.set(socket, player);
    for (const existing of players.values()) if (existing.roomId === roomId && existing.id !== player.id) send(socket, { type: 'player_spawned', playerId: existing.id, roomId, transform: existing.transform });
    broadcastRoom(roomId, { type: 'player_spawned', playerId: player.id, roomId, transform: player.transform }, socket);
    send(socket, { type: 'light_update', level: getRoomLight(roomId), source: player.id }); sendPlayerState(player); return;
  }
  const player = players.get(socket);
  if (!player) { send(socket, { type: 'error', code: 'NOT_JOINED', message: 'Join a room first' }); return; }
  if (message.type === 'player_state') {
    const { x, y, z, rotation } = message.transform; if (![x, y, z, rotation].every(Number.isFinite)) return;
    player.transform = { x: Math.max(-3.2, Math.min(3.2, x)), y: Math.max(0, Math.min(3, y)), z: Math.max(-19, Math.min(19, z)), rotation };
    broadcastRoom(player.roomId, { type: 'player_state', playerId: player.id, transform: player.transform }, socket); return;
  }
  if (message.type === 'interact_request') {
    if (message.targetId !== DIYA_TARGET_ID) { send(socket, { type: 'error', code: 'INVALID_TARGET', message: 'Unknown interaction target' }); return; }
    if (!isNear(player.transform, DIYA_POSITION, INTERACTION_RADIUS)) { send(socket, { type: 'error', code: 'TOO_FAR', message: 'Move closer to the diya' }); return; }
    const targetKey = `${player.roomId}:${DIYA_TARGET_ID}`;
    if (!litTargets.has(targetKey)) { litTargets.add(targetKey); increaseLight(player.roomId, player.id, 10); advanceQuest(player, 'first-flame'); }
    send(socket, { type: 'interaction_result', success: true, targetId: DIYA_TARGET_ID, lightLevel: getRoomLight(player.roomId), source: player.id }); return;
  }
  if (message.type === 'pickup_request') {
    const pickup = PICKUPS[message.targetId];
    if (!pickup || !isNear(player.transform, pickup, INTERACTION_RADIUS)) { send(socket, { type: 'error', code: 'INVALID_PICKUP', message: 'That item is not available here' }); return; }
    const targetKey = `${player.roomId}:${message.targetId}`;
    if (pickedTargets.has(targetKey)) { send(socket, { type: 'pickup_result', success: false, targetId: message.targetId, itemId: pickup.itemId, quantity: 0 }); return; }
    pickedTargets.add(targetKey);
    const existing = player.inventory.find((item) => item.id === pickup.itemId); if (existing) existing.quantity += pickup.quantity; else player.inventory.push({ id: pickup.itemId, quantity: pickup.quantity });
    send(socket, { type: 'pickup_result', success: true, targetId: message.targetId, itemId: pickup.itemId, quantity: pickup.quantity }); sendPlayerState(player);
    if (message.targetId === 'sharma-doorway-01') advanceQuest(player, 'help-sharma-aunty');
    if (message.targetId.startsWith('market-stall-')) advanceQuest(player, 'market-lights');
    if (message.targetId === 'temple-memory-01') advanceQuest(player, 'temple-memory');
    return;
  }
  if (message.type === 'share_flame_request') {
    const target = [...players.values()].find((entry) => entry.id === message.targetPlayerId && entry.roomId === player.roomId);
    if (!target || target.id === player.id) { send(socket, { type: 'error', code: 'PLAYER_NOT_FOUND', message: 'That player is no longer nearby' }); return; }
    if (!isNear(player.transform, target.transform, FLAME_SHARE_RADIUS)) { send(socket, { type: 'error', code: 'TOO_FAR', message: 'Stand closer to share your flame' }); return; }
    increaseLight(player.roomId, player.id, 5); broadcastRoom(player.roomId, { type: 'flame_shared', fromPlayerId: player.id, toPlayerId: target.id, lightLevel: getRoomLight(player.roomId) }); return;
  }
  if (message.type === 'ping') send(socket, { type: 'pong', timestamp: message.timestamp });
}
wss.on('connection', (socket) => {
  socket.on('message', (raw) => { const message = decodeMessage(raw.toString()); if (message) handleMessage(socket, message); });
  socket.on('close', () => { const player = players.get(socket); if (!player) return; players.delete(socket); broadcastRoom(player.roomId, { type: 'player_left', playerId: player.id }); });
});
http.listen(port, () => console.log(`The Last Diya server listening on :${port}`));
