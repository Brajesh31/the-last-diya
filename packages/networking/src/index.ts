import type { ClientMessage, ServerMessage } from '@the-last-diya/shared';

export type WireMessage = ClientMessage | ServerMessage;

const MESSAGE_TYPES = new Set([
  'hello', 'join_room', 'player_state', 'interact_request', 'share_flame_request', 'pickup_request',
  'memory_continue', 'final_event_ready', 'ping', 'player_spawned', 'player_left', 'light_update',
  'interaction_result', 'inventory_update', 'quest_update', 'flame_shared', 'pickup_result',
  'world_state', 'target_state', 'room_snapshot', 'memory_started', 'memory_completed',
  'final_event_started', 'final_event_state', 'session_assigned', 'pong', 'error',
]);

export function encodeMessage(message: WireMessage): string {
  return JSON.stringify(message);
}

export function decodeMessage(raw: string): WireMessage | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || !('type' in value)) return null;
    const type = (value as { type?: unknown }).type;
    if (typeof type !== 'string' || !MESSAGE_TYPES.has(type)) return null;
    return value as WireMessage;
  } catch {
    return null;
  }
}
