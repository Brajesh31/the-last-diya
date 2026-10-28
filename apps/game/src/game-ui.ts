import type { InventoryItemState, QuestState } from '@the-last-diya/shared';

const labels: Record<string, string> = {
  diya: 'Diya', oil: 'Oil', wick: 'Wick', flower: 'Flowers', sweet: 'Sweets', memory_fragment: 'Memory',
};

export function createGameUi() {
  const inventory = document.createElement('aside');
  inventory.className = 'game-panel inventory-panel';
  inventory.innerHTML = '<strong>INVENTORY</strong><div id="inventory-items">Empty</div>';

  const quests = document.createElement('aside');
  quests.className = 'game-panel quest-panel';
  quests.innerHTML = '<strong>QUEST</strong><div id="quest-items">Waiting...</div>';

  const dialogue = document.createElement('div');
  dialogue.className = 'dialogue-panel';
  dialogue.hidden = true;
  dialogue.innerHTML = '<strong id="dialogue-speaker"></strong><p id="dialogue-text"></p><small>Press E to continue</small>';

  document.body.append(inventory, quests, dialogue);

  return {
    inventory,
    quests,
    dialogue,
    setInventory(items: InventoryItemState[]) {
      const target = document.getElementById('inventory-items')!;
      target.innerHTML = items.length
        ? items.map((item) => `<span>${labels[item.id] ?? item.id} <b>${item.quantity}</b></span>`).join('')
        : '<span>Empty</span>';
    },
    setQuests(states: QuestState[]) {
      const target = document.getElementById('quest-items')!;
      const active = states.find((state) => state.status === 'active' || state.status === 'available');
      target.innerHTML = active ? `<div>${active.id.replaceAll('-', ' ')}</div><small>${active.progress}/${active.target}</small>` : '<span>All quests complete</span>';
    },
    showDialogue(speaker: string, text: string) {
      document.getElementById('dialogue-speaker')!.textContent = speaker;
      document.getElementById('dialogue-text')!.textContent = text;
      dialogue.hidden = false;
    },
    hideDialogue() { dialogue.hidden = true; },
  };
}

export function installGameUiStyles() {
  const style = document.createElement('style');
  style.textContent = `.game-panel{position:fixed;top:22px;padding:14px 16px;background:#0c0d0ddd;border:1px solid #30312e;border-radius:10px;color:#f4f0e8;display:grid;gap:8px}.inventory-panel{right:22px;min-width:150px}.quest-panel{left:22px;top:150px;min-width:190px}.game-panel span{display:flex;justify-content:space-between;color:#c5c5bd;font-size:13px}.game-panel small{color:#f1b85b}.dialogue-panel{position:fixed;left:50%;bottom:34px;transform:translateX(-50%);width:min(560px,calc(100vw - 40px));padding:18px 20px;background:#0b0c0ceF;border:1px solid #4a4a44;border-radius:12px;box-sizing:border-box}.dialogue-panel p{margin:8px 0 14px;color:#dedbd3;line-height:1.5}.dialogue-panel small{color:#9c9e99}`;
  document.head.appendChild(style);
}
