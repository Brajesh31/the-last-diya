import type { ClientMessage, ServerMessage } from '@the-last-diya/shared';

export type WireMessage = ClientMessage | ServerMessage;

export function encodeMessage(message: WireMessage): string {
  return JSON.stringify(message);
}

export function decodeMessage(raw: string): WireMessage | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || !('type' in value)) return null;
    return value as WireMessage;
  } catch {
    return null;
  }
}
