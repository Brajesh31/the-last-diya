export const GAME_PHASE = 'Phase 4 · Vertical Slice';
export const LIGHT_LEVEL_START = 0;
export const MAX_LIGHT_LEVEL = 100;
export const DARK_DISTRICT_UNLOCK_LEVEL = 90;
export const FINAL_EVENT_LEVEL = 100;
export const DEFAULT_ROOM_CAPACITY = 30;

export type PlayerId = string;
export type RoomId = string;
export type ItemId = 'diya' | 'oil' | 'wick' | 'flower' | 'sweet' | 'memory_fragment';

export interface PlayerTransform { x: number; y: number; z: number; rotation: number; }
export interface InventoryItemState { id: ItemId; quantity: number; }

export type QuestId = 'first-flame' | 'help-sharma-aunty' | 'market-lights' | 'temple-memory' | 'last-diya';
export type QuestStatus = 'locked' | 'available' | 'active' | 'completed';
export interface QuestState { id: QuestId; status: QuestStatus; progress: number; target: number; }
export interface RoomPlayerSnapshot { playerId: PlayerId; transform: PlayerTransform; }

export type MemoryId = 'temple-memory-01';
export type WorldEventId = 'community-diya-celebration';

export interface MemorySequenceState {
  id: MemoryId;
  title: string;
  lines: string[];
  active: boolean;
}

export interface WorldEventState {
  id: WorldEventId;
  active: boolean;
  completed: boolean;
  startedAt?: number;
}

export type ClientMessage =
  | { type: 'hello'; clientVersion: string; sessionToken?: string }
  | { type: 'join_room'; roomId: RoomId }
  | { type: 'player_state'; transform: PlayerTransform }
  | { type: 'interact_request'; targetId: string }
  | { type: 'share_flame_request'; targetPlayerId: PlayerId }
  | { type: 'pickup_request'; targetId: string }
  | { type: 'memory_continue'; memoryId: MemoryId }
  | { type: 'final_event_ready' }
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
  | { type: 'target_state'; targetId: string; active: boolean }
  | { type: 'room_snapshot'; roomId: RoomId; players: RoomPlayerSnapshot[]; lightLevel: number; unlockedDistricts: string[]; pickedTargets: string[]; litTargets: string[]; memory?: MemorySequenceState; finalEvent?: WorldEventState }
  | { type: 'memory_started'; memory: MemorySequenceState }
  | { type: 'memory_completed'; memoryId: MemoryId }
  | { type: 'final_event_started'; event: WorldEventState }
  | { type: 'final_event_state'; event: WorldEventState }
  | { type: 'session_assigned'; sessionToken: string; playerId: PlayerId; roomId: RoomId; transform: PlayerTransform; restored: boolean }
  | { type: 'pong'; timestamp: number }
  | { type: 'error'; code: string; message: string };
