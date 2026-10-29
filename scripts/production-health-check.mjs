const baseUrl = process.argv[2] ?? process.env.GAME_SERVER_URL;
if (!baseUrl) {
  console.error('Usage: node scripts/production-health-check.mjs https://game-server.example.com');
  process.exit(1);
}

const normalized = baseUrl.replace(/\/$/, '');

async function check(path) {
  const response = await fetch(`${normalized}${path}`, { headers: { accept: 'application/json' } });
  const text = await response.text();
  let payload = null;
  try { payload = JSON.parse(text); } catch {}
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  if (!payload || payload.status !== 'ok') throw new Error(`${path} did not return status=ok`);
  console.log(`${path}: ok`, JSON.stringify(payload));
}

await check('/health');
await check('/ready');
