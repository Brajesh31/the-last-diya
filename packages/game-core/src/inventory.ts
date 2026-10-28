export type ItemId = 'diya' | 'oil' | 'wick' | 'flower' | 'sweet' | 'memory_fragment';

export interface InventoryItem {
  id: ItemId;
  quantity: number;
}

export interface InventoryState {
  items: InventoryItem[];
}

export function createInventory(): InventoryState {
  return { items: [] };
}

export function addItem(state: InventoryState, id: ItemId, quantity = 1): InventoryState {
  if (quantity <= 0) return state;
  const existing = state.items.find((item) => item.id === id);
  if (existing) existing.quantity += quantity;
  else state.items.push({ id, quantity });
  return state;
}

export function hasItem(state: InventoryState, id: ItemId, quantity = 1): boolean {
  return (state.items.find((item) => item.id === id)?.quantity ?? 0) >= quantity;
}

export function removeItem(state: InventoryState, id: ItemId, quantity = 1): boolean {
  const item = state.items.find((entry) => entry.id === id);
  if (!item || item.quantity < quantity) return false;
  item.quantity -= quantity;
  if (item.quantity === 0) state.items = state.items.filter((entry) => entry.id !== id);
  return true;
}
