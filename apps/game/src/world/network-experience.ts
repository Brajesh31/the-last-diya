import * as THREE from 'three';

export interface RemoteTransformSample {
  position: THREE.Vector3;
  rotation: number;
  receivedAt: number;
}

export interface NetworkExperienceState {
  latencyMs: number | null;
  lastPingAt: number;
  reconnectCount: number;
}

export function createNetworkExperienceState(): NetworkExperienceState {
  return { latencyMs: null, lastPingAt: 0, reconnectCount: 0 };
}

export function applyPong(state: NetworkExperienceState, sentAt: number, receivedAt = Date.now()): number {
  const latency = Math.max(0, receivedAt - sentAt);
  state.latencyMs = latency;
  return latency;
}

export function shouldSendPing(state: NetworkExperienceState, now: number, intervalMs = 3000): boolean {
  if (now - state.lastPingAt < intervalMs) return false;
  state.lastPingAt = now;
  return true;
}

export function interpolateRemoteTransform(
  current: THREE.Vector3,
  target: THREE.Vector3,
  currentRotation: number,
  targetRotation: number,
  deltaSeconds: number,
  smoothing = 10,
): { rotation: number } {
  const alpha = 1 - Math.exp(-Math.max(0, deltaSeconds) * smoothing);
  current.lerp(target, alpha);
  const delta = Math.atan2(Math.sin(targetRotation - currentRotation), Math.cos(targetRotation - currentRotation));
  return { rotation: currentRotation + delta * alpha };
}
