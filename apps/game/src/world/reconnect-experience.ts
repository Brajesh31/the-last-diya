export type ConnectionExperienceState = 'connected' | 'reconnecting' | 'restored' | 'offline';

export interface ReconnectExperienceState {
  state: ConnectionExperienceState;
  attempt: number;
  nextRetryAt: number | null;
  sessionRestorePending: boolean;
}

export function createReconnectExperienceState(): ReconnectExperienceState {
  return { state: 'connected', attempt: 0, nextRetryAt: null, sessionRestorePending: false };
}

export function markReconnectStarted(current: ReconnectExperienceState, now = Date.now()): ReconnectExperienceState {
  const attempt = current.attempt + 1;
  return {
    state: 'reconnecting',
    attempt,
    nextRetryAt: now + Math.min(8000, 500 * 2 ** Math.min(attempt - 1, 4)),
    sessionRestorePending: true,
  };
}

export function markSessionRestored(current: ReconnectExperienceState): ReconnectExperienceState {
  return { ...current, state: 'restored', nextRetryAt: null, sessionRestorePending: false };
}

export function markConnectionOffline(current: ReconnectExperienceState): ReconnectExperienceState {
  return { ...current, state: 'offline', nextRetryAt: null };
}

export function connectionLabel(state: ConnectionExperienceState): string {
  if (state === 'connected') return 'CONNECTED';
  if (state === 'reconnecting') return 'RECONNECTING';
  if (state === 'restored') return 'SESSION RESTORED';
  return 'OFFLINE';
}
