export const GAME_PHASE = 'Phase 2 · Core Gameplay';
export const LIGHT_LEVEL_START = 0;
export const MAX_LIGHT_LEVEL = 100;
export const DEFAULT_ROOM_CAPACITY = 10;

export type PlayerId = string;
export type RoomId = string;
export type ItemId = 'diya' | 'oil' | 'wick' | 'flower' | 'sweet' | 'memory_fragment';

export interface PlayerTransform {
  x: number;
  y: number;
  z: number;
  rotation: number;
}

export interface InventoryItemState {
  id: ItemId;
  quantity: number;
}

export type QuestId = 'first-flame' | 'help-sharma-aunty' | 'market-lights' | 'temple-memory' | 'last-diya';
export type QuestStatus = 'locked' | 'available' | 'active' | 'completed';

export interface QuestState {
  id: QuestId;
  status: QuestStatus;
  progress: number;
  target: number;
}

export type ClientMessage =
  | { type: 'hello'; clientVersion: string }
  | { type: 'join_room'; roomId: RoomId }
  | { type: 'player_state'; transform: PlayerTransform }
  | { type: 'interact_request'; targetId: string }
  | { type: 'share_flame_request'; targetPlayerId: PlayerId }
  | { type: 'pickup_request'; targetId: string }
  | { type: 'ping'; timestamp: number };

export type ServerMessage =
  | { type: 'player_spawned'; playerId: PlayerId; roomId: RoomId; transform: PlayerTransform }
  | { type: 'player_state'; playerId: PlayerId; transform: PlayerTransform }
  | { type: 'player_left'; playerId: PlayerId }
  | { type: 'light_update'; level: number; source: PlayerId }
  | { type: 'interaction_result'; success: boolean; targetId: string; lightLevel: number; source: PlayerId }
  | { type: 'inventory_update'; playerId: PlayerId; items: InventoryItemState[] }
  | { type: 'quest_update'; playerId: PlayerId; quests: QuestState[] }
  | { type: 'flame_shared'; fromPlayerId: PlayerId; toPlayerId: PlayerId; lightLevel: number }
  | { type: 'pickup_result'; success: boolean; targetId: string; itemId: ItemId; quantity: number }
  | { type: 'world_state'; lightLevel: number; unlockedDistricts: string[] }
  | { type: 'pong'; timestamp: number }
  | { type: 'error'; code: string; message: string };
