import { WebSocketServer, WebSocket } from 'ws';
import { DEFAULT_ROOM_CAPACITY, LIGHT_LEVEL_START, MAX_LIGHT_LEVEL } from '@the-last-diya/shared';
import type { ServerMessage } from '@the-last-diya/shared';
import { decodeMessage, encodeMessage } from '@the-last-diya/networking';
import { createServer } from 'node:http';

const http = createServer((_, res) => { res.writeHead(200, {'content-type':'application/json'}); res.end(JSON.stringify({name:'the-last-diya-server', status:'ok'})); });
const wss = new WebSocketServer({ server: http });
const players = new Map<WebSocket, { id: string; roomId: string }>();
let lightLevel = LIGHT_LEVEL_START;

function broadcast(message: ServerMessage) { const payload = encodeMessage(message); for (const socket of players.keys()) if (socket.readyState === WebSocket.OPEN) socket.send(payload); }

wss.on('connection', socket => {
  const id = crypto.randomUUID();
  socket.on('message', raw => {
    const message = decodeMessage(raw.toString()); if (!message) return;
    if (message.type === 'join_room') {
      const count = [...players.values()].filter(p => p.roomId === message.roomId).length;
      if (count >= DEFAULT_ROOM_CAPACITY) { socket.send(encodeMessage({type:'error', code:'ROOM_FULL', message:'Room is full'})); return; }
      players.set(socket, {id, roomId: message.roomId});
      socket.send(encodeMessage({type:'player_spawned', playerId:id, roomId:message.roomId}));
      broadcast({type:'light_update', level:lightLevel, source:id});
    }
    if (message.type === 'interact_request' && players.has(socket)) {
      lightLevel = Math.min(MAX_LIGHT_LEVEL, lightLevel + 10);
      broadcast({type:'interaction_result', success:true, targetId:message.targetId, lightLevel});
      broadcast({type:'light_update', level:lightLevel, source:id});
    }
    if (message.type === 'ping') socket.send(encodeMessage({type:'pong', timestamp:message.timestamp}));
  });
  socket.on('close', () => { const player = players.get(socket); if (player) broadcast({type:'player_left', playerId:player.id}); players.delete(socket); });
});

http.listen(Number(process.env.PORT ?? 8787), () => console.log('The Last Diya server listening on :8787'));
