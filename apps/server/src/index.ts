import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import {
  DEFAULT_ROOM_CAPACITY,
  LIGHT_LEVEL_START,
  MAX_LIGHT_LEVEL,
} from '@the-last-diya/shared';
import type {
  ClientMessage,
  PlayerTransform,
  ServerMessage,
} from '@the-last-diya/shared';
import { decodeMessage, encodeMessage } from '@the-last-diya/networking';

const port = Number(process.env.PORT ?? 8787);
const http = createServer((_, response) => {
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ name: 'the-last-diya-server', status: 'ok' }));
});

const wss = new WebSocketServer({ server: http });

type Player = {
  id: string;
  roomId: string;
  socket: WebSocket;
  transform: PlayerTransform;
};

const players = new Map<WebSocket, Player>();
const roomLight = new Map<string, number>();
const litTargets = new Set<string>();
const DIYA_TARGET_ID = 'diya-main-street-01';
const DIYA_POSITION = { x: 0, z: -4 };
const INTERACTION_RADIUS = 2.2;
const spawnTransform: PlayerTransform = { x: 0, y: 0.75, z: 4, rotation: 0 };

function send(socket: WebSocket, message: ServerMessage) {
  if (socket.readyState === WebSocket.OPEN) socket.send(encodeMessage(message));
}

function broadcastRoom(roomId: string, message: ServerMessage, except?: WebSocket) {
  for (const player of players.values()) {
    if (player.roomId === roomId && player.socket !== except) send(player.socket, message);
  }
}

function getRoomLight(roomId: string) {
  return roomLight.get(roomId) ?? LIGHT_LEVEL_START;
}

function handleMessage(socket: WebSocket, message: ClientMessage) {
  if (message.type === 'join_room') {
    if (players.has(socket)) return;

    const roomId = message.roomId.trim().slice(0, 32) || 'main';
    const count = [...players.values()].filter((player) => player.roomId === roomId).length;
    if (count >= DEFAULT_ROOM_CAPACITY) {
      send(socket, { type: 'error', code: 'ROOM_FULL', message: 'Room is full' });
      return;
    }

    const player: Player = {
      id: randomUUID(),
      roomId,
      socket,
      transform: { ...spawnTransform, x: count * 1.2 - 4.8 },
    };
    players.set(socket, player);

    for (const existing of players.values()) {
      if (existing.roomId !== roomId || existing.id === player.id) continue;
      send(socket, {
        type: 'player_spawned',
        playerId: existing.id,
        roomId,
        transform: existing.transform,
      });
    }

    broadcastRoom(roomId, {
      type: 'player_spawned',
      playerId: player.id,
      roomId,
      transform: player.transform,
    }, socket);

    send(socket, { type: 'light_update', level: getRoomLight(roomId), source: player.id });
    return;
  }

  const player = players.get(socket);
  if (!player) {
    send(socket, { type: 'error', code: 'NOT_JOINED', message: 'Join a room first' });
    return;
  }

  if (message.type === 'player_state') {
    const { x, y, z, rotation } = message.transform;
    if (![x, y, z, rotation].every(Number.isFinite)) return;
    player.transform = {
      x: Math.max(-3.2, Math.min(3.2, x)),
      y: Math.max(0, Math.min(3, y)),
      z: Math.max(-19, Math.min(19, z)),
      rotation,
    };
    broadcastRoom(player.roomId, {
      type: 'player_state',
      playerId: player.id,
      transform: player.transform,
    }, socket);
    return;
  }

  if (message.type === 'interact_request') {
    if (message.targetId !== DIYA_TARGET_ID) {
      send(socket, { type: 'error', code: 'INVALID_TARGET', message: 'Unknown interaction target' });
      return;
    }

    const distance = Math.hypot(
      player.transform.x - DIYA_POSITION.x,
      player.transform.z - DIYA_POSITION.z,
    );
    if (distance > INTERACTION_RADIUS) {
      send(socket, { type: 'error', code: 'TOO_FAR', message: 'Move closer to the diya' });
      return;
    }

    const targetKey = `${player.roomId}:${DIYA_TARGET_ID}`;
    if (litTargets.has(targetKey)) {
      send(socket, {
        type: 'interaction_result',
        success: true,
        targetId: DIYA_TARGET_ID,
        lightLevel: getRoomLight(player.roomId),
        source: player.id,
      });
      return;
    }

    const nextLevel = Math.min(MAX_LIGHT_LEVEL, getRoomLight(player.roomId) + 10);
    roomLight.set(player.roomId, nextLevel);
    litTargets.add(targetKey);

    broadcastRoom(player.roomId, {
      type: 'interaction_result',
      success: true,
      targetId: DIYA_TARGET_ID,
      lightLevel: nextLevel,
      source: player.id,
    });
    broadcastRoom(player.roomId, {
      type: 'light_update',
      level: nextLevel,
      source: player.id,
    });
    return;
  }

  if (message.type === 'ping') {
    send(socket, { type: 'pong', timestamp: message.timestamp });
  }
}

wss.on('connection', (socket) => {
  socket.on('message', (raw) => {
    const message = decodeMessage(raw.toString());
    if (message) handleMessage(socket, message as ClientMessage);
  });

  socket.on('close', () => {
    const player = players.get(socket);
    if (!player) return;
    players.delete(socket);
    broadcastRoom(player.roomId, { type: 'player_left', playerId: player.id });
  });
});

http.listen(port, () => {
  console.log(`The Last Diya server listening on :${port}`);
});
