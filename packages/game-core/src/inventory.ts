import type { InventoryItemState, ItemId } from '@the-last-diya/shared';

export const STARTING_INVENTORY: InventoryItemState[] = [
  { id: 'diya', quantity: 1 },
  { id: 'oil', quantity: 1 },
  { id: 'wick', quantity: 1 },
];

export function addItem(items: InventoryItemState[], id: ItemId, quantity = 1): InventoryItemState[] {
  if (quantity <= 0) return items.map((item) => ({ ...item }));
  const next = items.map((item) => ({ ...item }));
  const existing = next.find((item) => item.id === id);
  if (existing) existing.quantity += quantity;
  else next.push({ id, quantity });
  return next;
}

export function removeItem(items: InventoryItemState[], id: ItemId, quantity = 1): InventoryItemState[] | null {
  if (quantity <= 0) return items.map((item) => ({ ...item }));
  const next = items.map((item) => ({ ...item }));
  const existing = next.find((item) => item.id === id);
  if (!existing || existing.quantity < quantity) return null;
  existing.quantity -= quantity;
  return next.filter((item) => item.quantity > 0);
}

export function hasItem(items: InventoryItemState[], id: ItemId, quantity = 1): boolean {
  return (items.find((item) => item.id === id)?.quantity ?? 0) >= quantity;
}
