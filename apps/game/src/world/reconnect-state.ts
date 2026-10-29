export type ReconnectPhase = 'online' | 'reconnecting' | 'restored' | 'offline';

export interface ReconnectState {
  phase: ReconnectPhase;
  attempts: number;
  lastDisconnectAt: number | null;
  restoredAt: number | null;
}

export function createReconnectState(): ReconnectState {
  return { phase: 'online', attempts: 0, lastDisconnectAt: null, restoredAt: null };
}

export function markDisconnected(state: ReconnectState, now = Date.now()): ReconnectState {
  state.phase = 'reconnecting';
  state.attempts += 1;
  state.lastDisconnectAt = now;
  return state;
}

export function markRestored(state: ReconnectState, now = Date.now()): ReconnectState {
  state.phase = 'restored';
  state.restoredAt = now;
  return state;
}

export function markOffline(state: ReconnectState): ReconnectState {
  state.phase = 'offline';
  return state;
}

export function recoveryMessage(state: ReconnectState): string {
  if (state.phase === 'reconnecting') return state.attempts > 1 ? 'Reconnecting… restoring your light.' : 'Connection lost. Reconnecting…';
  if (state.phase === 'restored') return 'Connection restored. Your progress is safe.';
  if (state.phase === 'offline') return 'Offline. Reconnect to continue sharing the light.';
  return '';
}
