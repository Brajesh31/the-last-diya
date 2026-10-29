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
  dialogue.innerHTML = '<strong id="dialogue-speaker"></strong><p id="dialogue-text"></p><small id="dialogue-hint">Press E to continue</small>';

  const onboarding = document.createElement('section');
  onboarding.className = 'onboarding-overlay';
  onboarding.innerHTML = `
    <div class="onboarding-card" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <span class="onboarding-kicker">A SMALL STORY ABOUT LIGHT</span>
      <h1 id="onboarding-title">The Last Diya</h1>
      <p>The street has gone quiet. Help the neighbours bring back its light, one diya and one memory at a time.</p>
      <div class="onboarding-steps">
        <div><b>1</b><span>Talk to neighbours and follow the active quest.</span></div>
        <div><b>2</b><span>Collect what they need and light the waiting diyas.</span></div>
        <div><b>3</b><span>Share your flame. The Light Level belongs to everyone.</span></div>
      </div>
      <button type="button" id="onboarding-start">Enter the neighbourhood</button>
      <small>Your progress is restored when you reconnect.</small>
    </div>
  `;

  document.body.append(inventory, quests, dialogue, onboarding);
  const onboardingStart = onboarding.querySelector<HTMLButtonElement>('#onboarding-start')!;
  const onboardingKey = 'the-last-diya-onboarding-seen';
  const closeOnboarding = () => {
    onboarding.hidden = true;
    localStorage.setItem(onboardingKey, '1');
  };
  onboardingStart.addEventListener('click', closeOnboarding);
  onboardingStart.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      closeOnboarding();
    }
  });
  if (localStorage.getItem(onboardingKey) === '1') onboarding.hidden = true;

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
    setTouchMode(enabled: boolean) {
      document.getElementById('dialogue-hint')!.textContent = enabled ? 'Tap Interact to continue' : 'Press E to continue';
    },
  };
}

export function installGameUiStyles() {
  const style = document.createElement('style');
  style.textContent = `.game-panel{position:fixed;top:22px;padding:14px 16px;background:#0c0d0ddd;border:1px solid #30312e;border-radius:10px;color:#f4f0e8;display:grid;gap:8px;z-index:40}.inventory-panel{right:22px;min-width:150px}.quest-panel{left:22px;top:150px;min-width:190px}.game-panel span{display:flex;justify-content:space-between;color:#c5c5bd;font-size:13px}.game-panel small{color:#f1b85b}.dialogue-panel{position:fixed;left:50%;bottom:34px;transform:translateX(-50%);width:min(560px,calc(100vw - 40px));padding:18px 20px;background:#0b0c0ceF;border:1px solid #4a4a44;border-radius:12px;box-sizing:border-box;z-index:70}.dialogue-panel p{margin:8px 0 14px;color:#dedbd3;line-height:1.5}.dialogue-panel small{color:#9c9e99}.onboarding-overlay{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:20px;background:rgba(5,6,6,.72);backdrop-filter:blur(8px)}.onboarding-overlay[hidden]{display:none}.onboarding-card{width:min(500px,calc(100vw - 32px));padding:28px;background:#10110feF;border:1px solid #4a463d;border-radius:18px;box-shadow:0 20px 70px #0008;box-sizing:border-box}.onboarding-kicker{font-size:10px;letter-spacing:.16em;color:#d5a85f}.onboarding-card h1{margin:8px 0 10px;font-size:34px;letter-spacing:-.03em}.onboarding-card>p{margin:0;color:#c8c5bc;line-height:1.55}.onboarding-steps{display:grid;gap:10px;margin:22px 0}.onboarding-steps div{display:flex;gap:12px;align-items:flex-start;color:#d8d5cc;font-size:13px;line-height:1.4}.onboarding-steps b{display:grid;place-items:center;flex:none;width:24px;height:24px;border-radius:50%;background:#3b3020;color:#f0c879}.onboarding-card button{width:100%;padding:13px 16px;border:1px solid #e4b35f;border-radius:10px;background:#c28a3e;color:#17120b;font:800 13px/1 system-ui,sans-serif;cursor:pointer}.onboarding-card button:hover{background:#dda650}.onboarding-card button:focus-visible{outline:2px solid #f4d89f;outline-offset:3px}.onboarding-card>small{display:block;margin-top:12px;text-align:center;color:#8f908b;font-size:11px}@media(max-width:640px){.game-panel{top:10px}.inventory-panel{right:10px;min-width:unset;max-width:128px}.quest-panel{top:auto;bottom:86px;left:10px;min-width:unset;width:min(235px,calc(100vw - 20px));box-sizing:border-box}.dialogue-panel{bottom:14px!important}.onboarding-card{padding:22px}.onboarding-card h1{font-size:28px}.onboarding-steps{margin:18px 0}}`;
  document.head.appendChild(style);
}
