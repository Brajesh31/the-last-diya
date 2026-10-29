import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('apps/game/src');
const files = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.ts')) files.push(full);
  }
}
walk(root);

const sources = files.map((file) => ({ file, text: fs.readFileSync(file, 'utf8') }));
const disposableWorldModules = sources.filter(({ file, text }) =>
  file.includes(`${path.sep}world${path.sep}`) && /THREE\.(Mesh|Group|Points|Line|WebGLRenderer)/.test(text),
);

for (const { file, text } of disposableWorldModules) {
  if (!/dispose\s*\(/.test(text)) {
    throw new Error(`Missing disposal path in ${path.relative(process.cwd(), file)}`);
  }
}

const main = fs.readFileSync(path.join(root, 'main.ts'), 'utf8');
for (const required of ['remote.visual.dispose()', 'renderer.dispose()', 'scene.traverse']) {
  if (!main.includes(required)) throw new Error(`main.ts disposal audit missing: ${required}`);
}

console.log(`PASS renderer disposal audit | ${disposableWorldModules.length} world modules expose disposal paths`);
