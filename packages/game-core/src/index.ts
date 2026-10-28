export function clampLightLevel(value: number): number { return Math.max(0, Math.min(100, Math.round(value))); }
export function isNear(a: { x: number; z: number }, b: { x: number; z: number }, distance: number): boolean { return Math.hypot(a.x - b.x, a.z - b.z) <= distance; }
export function nextLightLevel(current: number, amount: number): number { return clampLightLevel(current + amount); }
