import fs from 'node:fs';

const files = [
  'apps/game/src/world/vertical-slice.ts',
  'apps/game/src/world/vertical-slice-content.ts',
  'apps/game/src/world/vertical-slice-runtime.ts',
  'docs/VERTICAL_SLICE.md',
];

for (const file of files) {
  if (!fs.existsSync(file)) throw new Error(`Missing vertical-slice file: ${file}`);
}

const npcSource = fs.readFileSync('apps/game/src/world/vertical-slice.ts', 'utf8');
const contentSource = fs.readFileSync('apps/game/src/world/vertical-slice-content.ts', 'utf8');
const runtimeSource = fs.readFileSync('apps/game/src/world/vertical-slice-runtime.ts', 'utf8');
const design = fs.readFileSync('docs/VERTICAL_SLICE.md', 'utf8');

for (const npc of ['sharma-aunty', 'mithai-seller', 'chai-seller', 'temple-caretaker', 'grandmother']) {
  if (!npcSource.includes(`'${npc}'`)) throw new Error(`Missing NPC definition: ${npc}`);
}

for (const quest of ['first-flame', 'market-lights', 'chai-and-memory', 'temple-memory', 'last-diya']) {
  if (!contentSource.includes(`id: '${quest}'`)) throw new Error(`Missing quest definition: ${quest}`);
}

if (!runtimeSource.includes('playMemory') || !runtimeSource.includes('playFinalEvent')) {
  throw new Error('Memory/final-event runtime is incomplete');
}
if (!design.includes('Final event') || !design.includes('Dark District')) {
  throw new Error('Vertical slice design contract is incomplete');
}

console.log('PASS vertical slice content contract');
console.log('PASS 5 NPC definitions');
console.log('PASS 5 quest definitions');
console.log('PASS memory runtime');
console.log('PASS final-event runtime');
