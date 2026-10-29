import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('apps/game/dist/assets');
const maxAssetBytes = Number(process.env.MAX_GAME_ASSET_BYTES ?? 550 * 1024);
const maxGzipBytes = Number(process.env.MAX_GAME_GZIP_BYTES ?? 140 * 1024);

if (!fs.existsSync(dist)) throw new Error('Game dist/assets directory is missing. Run the production build first.');

const assets = fs.readdirSync(dist).filter((file) => file.endsWith('.js'));
if (assets.length === 0) throw new Error('No JavaScript assets found in the game build.');

const rows = assets.map((file) => {
  const bytes = fs.statSync(path.join(dist, file)).size;
  return { file, bytes };
}).sort((a, b) => b.bytes - a.bytes);

const largest = rows[0];
const gzipProbe = await import('node:zlib');
const gzip = gzipProbe.gzipSync(fs.readFileSync(path.join(dist, largest.file)), { level: 9 });

console.log(`Largest game JS asset: ${largest.file} | ${largest.bytes} bytes | gzip ${gzip.length} bytes`);
console.log(`Budget: ${maxAssetBytes} bytes raw | ${maxGzipBytes} bytes gzip`);

if (largest.bytes > maxAssetBytes) throw new Error(`Raw asset budget exceeded: ${largest.bytes} > ${maxAssetBytes}`);
if (gzip.length > maxGzipBytes) throw new Error(`Gzip asset budget exceeded: ${gzip.length} > ${maxGzipBytes}`);

console.log('PASS build performance budget');
