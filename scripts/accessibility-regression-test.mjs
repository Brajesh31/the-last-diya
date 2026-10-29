import fs from 'node:fs';

const files = [
  'apps/game/src/main.ts',
  'apps/game/src/game-ui.ts',
  'apps/game/src/world/touch-controls.ts',
];

for (const file of files) {
  if (!fs.existsSync(file)) throw new Error(`Missing accessibility surface: ${file}`);
}

const main = fs.readFileSync('apps/game/src/main.ts', 'utf8');
const ui = fs.readFileSync('apps/game/src/game-ui.ts', 'utf8');
const touch = fs.readFileSync('apps/game/src/world/touch-controls.ts', 'utf8');

for (const marker of [
  'aria-label="Shared Light Level"',
  'aria-live="polite"',
  'prefers-reduced-motion:reduce',
  "event.key.toLowerCase() !== 'e'",
]) {
  if (!main.includes(marker)) throw new Error(`Missing main accessibility marker: ${marker}`);
}

for (const marker of ['role="dialog"', 'aria-modal="true"', 'aria-labelledby="onboarding-title"', 'type="button"', 'focus-visible']) {
  if (!ui.includes(marker)) throw new Error(`Missing game UI accessibility marker: ${marker}`);
}

for (const marker of ['role="group"', 'aria-label="Touch game controls"', 'aria-label="Move forward"', 'aria-label="Interact"', 'pointerdown', 'keydown']) {
  if (!touch.includes(marker)) throw new Error(`Missing touch accessibility/input marker: ${marker}`);
}

console.log('PASS accessibility regression | keyboard | touch | live regions | reduced motion | focus states');
