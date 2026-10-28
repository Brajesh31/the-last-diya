export const GAME_PHASE = 'Phase 1 · Technical Prototype';
export const LIGHT_LEVEL_START = 0;
export const MAX_LIGHT_LEVEL = 100;
export const DEFAULT_ROOM_CAPACITY = 10;

export type PlayerId = string;
export type RoomId = string;

export interface PlayerTransform {
  x: number;
  y: number;
  z: number;
  rotation: number;
}

export type ClientMessage =
  | { type: 'hello'; clientVersion: string }
  | { type: 'join_room'; roomId: RoomId }
  | { type: 'player_state'; transform: PlayerTransform }
  | { type: 'interact_request'; targetId: string }
  | { type: 'ping'; timestamp: number };

export type ServerMessage =
  | { type: 'player_spawned'; playerId: PlayerId; roomId: RoomId; transform: PlayerTransform }
  | { type: 'player_state'; playerId: PlayerId; transform: PlayerTransform }
  | { type: 'player_left'; playerId: PlayerId }
  | { type: 'light_update'; level: number; source: PlayerId }
  | { type: 'interaction_result'; success: boolean; targetId: string; lightLevel: number; source: PlayerId }
  | { type: 'pong'; timestamp: number }
  | { type: 'error'; code: string; message: string };
