export interface TouchControlsHandle {
  dispose(): void;
}

const TOUCH_CONTROLS_CSS = \`
.touch-controls{position:fixed;inset:0;z-index:60;pointer-events:none;user-select:none;-webkit-user-select:none}
.touch-dpad{position:absolute;left:calc(14px + env(safe-area-inset-left,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px));display:grid;grid-template-columns:repeat(3,56px);grid-template-rows:repeat(2,56px);gap:7px;pointer-events:none}
.touch-control{width:56px;height:56px;display:grid;place-items:center;border:1px solid #696458;border-radius:17px;background:rgba(15,16,14,.82);color:#f4f0e8;font:600 23px/1 system-ui,sans-serif;box-shadow:0 3px 12px #0006;touch-action:none;pointer-events:auto;-webkit-tap-highlight-color:transparent}
.touch-control:active,.touch-control.is-pressed{background:#51412a;border-color:#e4b35f;transform:scale(.96)}
.touch-up{grid-column:2;grid-row:1}.touch-left{grid-column:1;grid-row:2}.touch-down{grid-column:2;grid-row:2}.touch-right{grid-column:3;grid-row:2}
.touch-interact{position:absolute;right:calc(18px + env(safe-area-inset-right,0px));bottom:calc(28px + env(safe-area-inset-bottom,0px));width:82px;height:82px;border:1px solid #f0c87e;border-radius:50%;background:#c28a3e;color:#17120b;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font:800 25px/1 system-ui,sans-serif;box-shadow:0 4px 16px #0008;touch-action:none;pointer-events:auto;-webkit-tap-highlight-color:transparent}
.touch-interact span{font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
.touch-interact:active{background:#e0aa54;transform:scale(.96)}
body.has-touch-controls .dialogue-panel{bottom:calc(122px + env(safe-area-inset-bottom,0px))!important;z-index:70}
\`;

const DIRECTIONS = [
  { selector: '.touch-up', key: 'w', label: 'Move forward' },
  { selector: '.touch-left', key: 'a', label: 'Move left' },
  { selector: '.touch-down', key: 's', label: 'Move backward' },
  { selector: '.touch-right', key: 'd', label: 'Move right' },
] as const;

export function installTouchControls(
  keys: Set<string>,
  onInteract: () => void,
): TouchControlsHandle {
  const supportsTouch = navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;
  if (!supportsTouch) return { dispose() {} };

  const root = document.createElement('div');
  root.className = 'touch-controls';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Touch game controls');
  root.innerHTML = \`
    <div class="touch-dpad" role="group" aria-label="Movement">
      <button type="button" class="touch-control touch-up" aria-label="Move forward">▲</button>
      <button type="button" class="touch-control touch-left" aria-label="Move left">◀</button>
      <button type="button" class="touch-control touch-down" aria-label="Move backward">▼</button>
      <button type="button" class="touch-control touch-right" aria-label="Move right">▶</button>
    </div>
    <button type="button" class="touch-interact" aria-label="Interact">
      E<span>Interact</span>
    </button>
  \`;

  const style = document.createElement('style');
  style.dataset.touchControlsStyle = 'true';
  style.textContent = TOUCH_CONTROLS_CSS;
  document.head.appendChild(style);
  document.body.appendChild(root);
  document.body.classList.add('has-touch-controls');

  const activePointers = new Map<number, string>();
  const directionButtons: HTMLButtonElement[] = [];

  const releasePointer = (pointerId: number) => {
    const key = activePointers.get(pointerId);
    if (!key) return;
    activePointers.delete(pointerId);
    const stillHeld = [...activePointers.values()].includes(key);
    if (!stillHeld) keys.delete(key);
    directionButtons.forEach((button) => {
      const buttonKey = DIRECTIONS.find((direction) => button.matches(direction.selector))?.key;
      if (buttonKey === key && !stillHeld) button.classList.remove('is-pressed');
    });
  };

  for (const direction of DIRECTIONS) {
    const button = root.querySelector<HTMLButtonElement>(direction.selector)!;
    directionButtons.push(button);
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      if (activePointers.has(event.pointerId)) return;
      activePointers.set(event.pointerId, direction.key);
      keys.add(direction.key);
      button.classList.add('is-pressed');
    });
    button.addEventListener('pointerup', (event) => {
      event.preventDefault();
      releasePointer(event.pointerId);
    });
    button.addEventListener('pointercancel', (event) => releasePointer(event.pointerId));
    button.addEventListener('lostpointercapture', (event) => releasePointer(event.pointerId));
    button.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  const releaseAll = () => {
    for (const pointerId of [...activePointers.keys()]) releasePointer(pointerId);
  };
  const interactButton = root.querySelector<HTMLButtonElement>('.touch-interact')!;
  interactButton.addEventListener('pointerdown', (event) => event.preventDefault());
  interactButton.addEventListener('pointerup', (event) => {
    event.preventDefault();
    onInteract();
  });
  interactButton.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onInteract();
    }
  });
  interactButton.addEventListener('contextmenu', (event) => event.preventDefault());
  window.addEventListener('pointerup', releaseAll);
  window.addEventListener('pointercancel', releaseAll);
  window.addEventListener('blur', releaseAll);

  return {
    dispose() {
      releaseAll();
      window.removeEventListener('pointerup', releaseAll);
      window.removeEventListener('pointercancel', releaseAll);
      window.removeEventListener('blur', releaseAll);
      root.remove();
      style.remove();
      document.body.classList.remove('has-touch-controls');
    },
  };
}
