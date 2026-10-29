export type FinalEventState = 'locked' | 'ready' | 'starting' | 'celebrating' | 'completed';

export interface FinalEventProgress {
  state: FinalEventState;
  lightLevel: number;
  participantCount: number;
  completedAt: number | null;
}

export function createFinalEventProgress(lightLevel = 0): FinalEventProgress {
  return {
    state: lightLevel >= 100 ? 'ready' : 'locked',
    lightLevel,
    participantCount: 0,
    completedAt: null,
  };
}

export function updateFinalEventReadiness(current: FinalEventProgress, lightLevel: number, participantCount: number): FinalEventProgress {
  const nextState = current.state === 'locked' && lightLevel >= 100 ? 'ready' : current.state;
  return { ...current, lightLevel, participantCount, state: nextState };
}

export function beginFinalEvent(current: FinalEventProgress): FinalEventProgress {
  if (current.state !== 'ready') return current;
  return { ...current, state: 'starting' };
}

export function beginCelebration(current: FinalEventProgress): FinalEventProgress {
  if (current.state !== 'starting') return current;
  return { ...current, state: 'celebrating' };
}

export function completeFinalEvent(current: FinalEventProgress, completedAt = Date.now()): FinalEventProgress {
  if (current.state !== 'celebrating') return current;
  return { ...current, state: 'completed', completedAt };
}
