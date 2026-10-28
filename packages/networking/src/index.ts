import type { ClientMessage, ServerMessage } from '@the-last-diya/shared';
export function encodeMessage(message: ClientMessage | ServerMessage): string { return JSON.stringify(message); }
export function decodeMessage(raw: string): ClientMessage | null { try { return JSON.parse(raw) as ClientMessage; } catch { return null; } }
