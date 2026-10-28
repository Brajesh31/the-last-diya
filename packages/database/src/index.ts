export type PlayerProfile = { id: string; displayName: string; createdAt: string };
export type QuestProgress = { playerId: string; questId: string; status: 'locked' | 'active' | 'complete' };
export type InventoryItem = { playerId: string; itemId: string; quantity: number };

export interface DatabaseClient {
  getPlayerProfile(playerId: string): Promise<PlayerProfile | null>;
  saveQuestProgress(progress: QuestProgress): Promise<void>;
  saveInventoryItem(item: InventoryItem): Promise<void>;
}

export function createDatabaseNotConfiguredError(): Error { return new Error('Database adapter is not configured yet.'); }
