import { chromium } from 'playwright';

const gameUrl = process.env.GAME_URL ?? 'http://127.0.0.1:5174/?e2e=1';
const timeoutMs = Number(process.env.BROWSER_TIMEOUT_MS ?? 30000);
const startupTimeoutMs = Number(process.env.BROWSER_STARTUP_TIMEOUT_MS ?? 60000);
const failures = [];
let browser;

async function waitForConnection(page, expected) {
  await page.waitForFunction(
    (value) => document.querySelector('#connection')?.textContent === value,
    expected,
    { timeout: timeoutMs },
  );
}

async function getState(page) {
  return page.evaluate(() => window.__LAST_DIYA_E2E__?.getState());
}

try {
  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });

  const context = await browser.newContext({ viewport: { width: 900, height: 560 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') failures.push(message.text()); });
  page.on('requestfailed', (request) => failures.push(`request failed: ${request.url()} - ${request.failure()?.errorText ?? 'unknown'}`));

  await page.goto(gameUrl, { waitUntil: 'commit', timeout: startupTimeoutMs });
  await page.waitForFunction(
    () => !!document.querySelector('#connection') && !!document.querySelector('#quest-items') && !!window.__LAST_DIYA_E2E__,
    undefined,
    { timeout: startupTimeoutMs },
  );
  await waitForConnection(page, 'ONLINE');

  const before = await getState(page);
  if (!before?.playerId) throw new Error('Initial session did not receive a player identity');
  const originalPlayerId = before.playerId;
  const originalQuest = before.quests.find((quest) => quest.id === 'first-flame');
  if (!originalQuest) throw new Error('Initial first-flame quest missing');
  console.log(`PASS: initial session established with player ${originalPlayerId}`);

  await page.evaluate(({ x, z }) => window.__LAST_DIYA_E2E__.moveTo(x, z), { x: 0, z: -4 });
  await page.evaluate(() => window.__LAST_DIYA_E2E__.interact());
  await page.waitForFunction(
    () => document.querySelector('.light-readout #light')?.textContent?.trim() === 'LIGHT 10%',
    undefined,
    { timeout: timeoutMs },
  );
  const progressed = await getState(page);
  if (progressed?.lightLevel !== 10) throw new Error(`Expected shared Light Level 10 before reconnect, got ${progressed?.lightLevel}`);
  if (!progressed.quests.some((quest) => quest.id === 'first-flame' && quest.status === 'completed')) {
    throw new Error('Personal quest progression was not recorded before reconnect');
  }
  console.log('PASS: authoritative world and personal quest state progressed before disconnect');

  await context.setOffline(true);
  await waitForConnection(page, 'OFFLINE');
  console.log('PASS: browser network loss moved the client into OFFLINE state');

  await context.setOffline(false);
  await waitForConnection(page, 'ONLINE');
  await page.waitForFunction(
    () => window.__LAST_DIYA_E2E__?.getState()?.playerId,
    undefined,
    { timeout: timeoutMs },
  );
  await page.waitForTimeout(500);

  const restored = await getState(page);
  if (!restored?.playerId || restored.playerId !== originalPlayerId) {
    throw new Error(`Session identity was not restored: expected ${originalPlayerId}, got ${restored?.playerId ?? 'missing'}`);
  }
  if (restored.lightLevel !== 10) throw new Error(`Shared Light Level was not restored: expected 10, got ${restored.lightLevel}`);
  if (!restored.quests.some((quest) => quest.id === 'first-flame' && quest.status === 'completed')) {
    throw new Error('Personal quest state was not restored after reconnect');
  }
  if (restored.position.x !== progressed.position.x || restored.position.z !== progressed.position.z) {
    throw new Error(`Player transform was not restored: expected ${progressed.position.x},${progressed.position.z}; got ${restored.position.x},${restored.position.z}`);
  }
  if (failures.length) throw new Error(`Browser runtime errors: ${failures.join(' | ')}`);

  console.log('PASS: reconnect restored the same session, world state, quest state, and transform');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
