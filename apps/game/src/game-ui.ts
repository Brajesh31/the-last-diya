import type { InventoryItemState, QuestState } from '@the-last-diya/shared';

const labels: Record<string, string> = {
  diya: 'Diya', oil: 'Oil', wick: 'Wick', flower: 'Flowers', sweet: 'Sweets', memory_fragment: 'Memory',
};

export function createGameUi() {
  const brand = document.createElement('div');
  brand.className = 'game-brand';
  brand.innerHTML = '<span class="game-brand-mark">◈</span><div><strong>THE LAST DIYA</strong><small>ONE FLAME. MANY MEMORIES.</small></div>';

  const inventory = document.createElement('aside');
  inventory.className = 'game-panel inventory-panel';
  inventory.innerHTML = '<div class="panel-label"><span>INVENTORY</span><i></i></div><div id="inventory-items">Empty</div>';

  const quests = document.createElement('aside');
  quests.className = 'game-panel quest-panel';
  quests.innerHTML = '<div class="panel-label"><span>CURRENT OBJECTIVE</span><i></i></div><div id="quest-items">Waiting...</div>';

  const dialogue = document.createElement('div');
  dialogue.className = 'dialogue-panel';
  dialogue.hidden = true;
  dialogue.innerHTML = '<div class="dialogue-accent"></div><strong id="dialogue-speaker"></strong><p id="dialogue-text"></p><small id="dialogue-hint">Press E to continue</small>';

  const onboarding = document.createElement('section');
  onboarding.className = 'onboarding-overlay';
  onboarding.innerHTML = `
    <div class="onboarding-card" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <span class="onboarding-kicker">A STORY ABOUT LIGHT</span>
      <h1 id="onboarding-title">The Last Diya</h1>
      <p>The street has gone quiet. Help the neighbours bring back its light, one diya and one memory at a time.</p>
      <div class="onboarding-steps">
        <div><b>01</b><span><strong>Meet the neighbourhood</strong><small>Talk to people and follow the current objective.</small></span></div>
        <div><b>02</b><span><strong>Bring the street back</strong><small>Collect what neighbours need and light the waiting diyas.</small></span></div>
        <div><b>03</b><span><strong>Share the flame</strong><small>The Light Level belongs to everyone in the neighbourhood.</small></span></div>
      </div>
      <button type="button" id="onboarding-start">Enter the neighbourhood <span>→</span></button>
      <small class="onboarding-note">Your progress is restored when you reconnect.</small>
    </div>
  `;

  const boot = document.createElement('section');
  boot.className = 'boot-overlay';
  boot.innerHTML = '<div class="boot-mark">◈</div><strong>THE LAST DIYA</strong><span>Restoring the neighbourhood…</span><div class="boot-line"><i></i></div>';

  document.body.append(brand, inventory, quests, dialogue, onboarding, boot);
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
  window.setTimeout(() => boot.classList.add('boot-finished'), 900);
  window.setTimeout(() => boot.remove(), 1450);

  return {
    inventory,
    quests,
    dialogue,
    setInventory(items: InventoryItemState[]) {
      const target = document.getElementById('inventory-items')!;
      target.innerHTML = items.length
        ? items.map((item) => `<span><em>${labels[item.id] ?? item.id}</em><b>${item.quantity}</b></span>`).join('')
        : '<span><em>Empty</em><b>—</b></span>';
    },
    setQuests(states: QuestState[]) {
      const target = document.getElementById('quest-items')!;
      const active = states.find((state) => state.status === 'active' || state.status === 'available');
      if (!active) {
        target.innerHTML = '<div class="quest-complete">All neighbourhood objectives complete</div>';
        return;
      }
      const title = active.id.replaceAll('-', ' ');
      target.innerHTML = `<div class="quest-title">${title}</div><div class="quest-progress"><i style="width:${Math.round((active.progress / Math.max(1, active.target)) * 100)}%"></i></div><small>${active.progress} / ${active.target}</small>`;
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
  style.textContent = `
  :root{--ui-ink:#f4f0e8;--ui-muted:#9d9e98;--ui-panel:rgba(10,11,11,.78);--ui-line:rgba(214,205,188,.16);--ui-gold:#d5a85f}
  *{box-sizing:border-box}.game-brand{position:fixed;left:22px;top:20px;z-index:40;display:flex;align-items:center;gap:10px;color:var(--ui-ink);pointer-events:none;text-shadow:0 2px 16px #000}.game-brand-mark{display:grid;place-items:center;width:30px;height:30px;border:1px solid rgba(213,168,95,.55);border-radius:50%;color:var(--ui-gold);font-size:12px}.game-brand strong{display:block;font:800 11px/1.1 system-ui,sans-serif;letter-spacing:.18em}.game-brand small{display:block;margin-top:4px;color:#92928d;font:500 8px/1 system-ui,sans-serif;letter-spacing:.12em}
  .game-panel{position:fixed;top:20px;padding:13px 15px;background:var(--ui-panel);border:1px solid var(--ui-line);backdrop-filter:blur(12px);border-radius:12px;color:var(--ui-ink);display:grid;gap:9px;z-index:40;box-shadow:0 12px 35px #0004}.inventory-panel{right:22px;min-width:155px}.quest-panel{left:22px;top:72px;min-width:235px}.panel-label{display:flex;align-items:center;justify-content:space-between;color:#8f918b;font:800 9px/1 system-ui,sans-serif;letter-spacing:.15em}.panel-label i{display:block;width:20px;height:1px;background:var(--ui-gold);opacity:.7}.game-panel span{display:flex;justify-content:space-between;gap:20px;color:#d5d3cc;font-size:12px}.game-panel span em{font-style:normal}.game-panel span b{color:#f0c879;font-weight:700}.quest-title{text-transform:capitalize;color:#eee9df;font:700 14px/1.25 system-ui,sans-serif}.quest-progress{height:3px;background:#2b2b28;border-radius:3px;overflow:hidden}.quest-progress i{display:block;height:100%;background:var(--ui-gold);border-radius:inherit}.game-panel small{color:#898b86;font-size:10px}.quest-complete{color:#d9d4c9;font-size:12px;line-height:1.45}
  .dialogue-panel{position:fixed;left:50%;bottom:30px;transform:translateX(-50%);width:min(620px,calc(100vw - 40px));padding:18px 22px 17px 25px;background:rgba(9,10,10,.92);border:1px solid rgba(214,205,188,.2);backdrop-filter:blur(14px);border-radius:14px;box-sizing:border-box;z-index:70;box-shadow:0 20px 60px #0007}.dialogue-accent{position:absolute;left:0;top:18px;bottom:18px;width:2px;background:var(--ui-gold)}.dialogue-panel strong{font:800 10px/1 system-ui,sans-serif;letter-spacing:.15em;color:var(--ui-gold);text-transform:uppercase}.dialogue-panel p{margin:9px 0 14px;color:#e3dfd6;line-height:1.55;font-size:14px}.dialogue-panel small{color:#858782;font-size:10px;letter-spacing:.04em}
  .onboarding-overlay{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:20px;background:rgba(5,6,6,.76);backdrop-filter:blur(12px)}.onboarding-overlay[hidden]{display:none}.onboarding-card{width:min(520px,calc(100vw - 32px));padding:32px;background:rgba(15,16,15,.97);border:1px solid rgba(214,205,188,.2);border-radius:20px;box-shadow:0 30px 100px #000a}.onboarding-kicker{font-size:9px;letter-spacing:.18em;color:var(--ui-gold)}.onboarding-card h1{margin:9px 0 10px;font-size:38px;letter-spacing:-.04em;color:#f6f1e8}.onboarding-card>p{margin:0;color:#bdbbb3;line-height:1.6;font-size:14px}.onboarding-steps{display:grid;gap:9px;margin:24px 0}.onboarding-steps div{display:flex;gap:13px;align-items:flex-start;padding:11px 0;border-top:1px solid rgba(214,205,188,.09);color:#d8d5cc}.onboarding-steps b{color:var(--ui-gold);font:800 10px/24px system-ui,sans-serif;letter-spacing:.08em}.onboarding-steps strong{display:block;font-size:12px;margin-bottom:3px}.onboarding-steps small{display:block;color:#858782;font-size:11px;line-height:1.4}.onboarding-card button{width:100%;display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border:1px solid #e4b35f;border-radius:10px;background:#c28a3e;color:#17120b;font:800 12px/1 system-ui,sans-serif;cursor:pointer}.onboarding-card button:hover{background:#dda650}.onboarding-card button:focus-visible{outline:2px solid #f4d89f;outline-offset:3px}.onboarding-note{display:block;margin-top:12px;text-align:center;color:#777a75;font-size:10px}
  .boot-overlay{position:fixed;inset:0;z-index:120;display:grid;place-items:center;align-content:center;gap:9px;background:#080909;color:#eee9df;transition:opacity .5s ease}.boot-overlay.boot-finished{opacity:0;pointer-events:none}.boot-mark{display:grid;place-items:center;width:48px;height:48px;border:1px solid rgba(213,168,95,.55);border-radius:50%;color:var(--ui-gold);font-size:18px;margin-bottom:5px}.boot-overlay strong{font:800 13px/1 system-ui,sans-serif;letter-spacing:.22em}.boot-overlay>span{color:#777a75;font:500 9px/1 system-ui,sans-serif;letter-spacing:.1em}.boot-line{width:150px;height:2px;margin-top:10px;background:#262725;overflow:hidden}.boot-line i{display:block;width:45%;height:100%;background:var(--ui-gold);animation:boot-progress 1.2s ease-in-out infinite}@keyframes boot-progress{0%{transform:translateX(-100%)}100%{transform:translateX(330%)}}
  @media(max-width:640px){.game-brand{left:12px;top:12px}.game-brand small{display:none}.game-brand strong{font-size:9px}.game-brand-mark{width:26px;height:26px}.game-panel{top:10px}.inventory-panel{right:10px;min-width:125px}.quest-panel{top:auto;bottom:86px;left:10px;min-width:unset;width:min(245px,calc(100vw - 20px))}.dialogue-panel{bottom:14px!important;width:calc(100vw - 20px);padding:16px 18px 15px 21px}.onboarding-card{padding:24px}.onboarding-card h1{font-size:30px}.onboarding-steps{margin:18px 0}}
  `;
  document.head.appendChild(style);
}
