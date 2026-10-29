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

const requiredMain = [
  'aria-label="Shared Light Level"',
  'aria-live="polite"',
  'prefers-reduced-motion:reduce',
  "event.key.toLowerCase() !== 'e'",
];
for (const marker of requiredMain) {
  if (!main.includes(marker)) throw new Error(`Missing main accessibility marker: ${marker}`);
}

const requiredUi = ['aria-live', 'button', 'tabindex'];
for (const marker of requiredUi) {
  if (!ui.toLowerCase().includes(marker)) throw new Error(`Missing game UI accessibility marker: ${marker}`);
}

for (const marker of ['aria-label', 'touchstart', 'pointerdown']) {
  if (!touch.toLowerCase().includes(marker)) throw new Error(`Missing touch accessibility/input marker: ${marker}`);
}

console.log('PASS accessibility regression | keyboard | touch | live regions | reduced motion');
