import { chromium } from 'playwright';

const gameUrl = process.env.GAME_URL ?? 'http://127.0.0.1:5174/?e2e=1';
const timeoutMs = Number(process.env.BROWSER_TIMEOUT_MS ?? 30000);
const startupTimeoutMs = Number(process.env.BROWSER_STARTUP_TIMEOUT_MS ?? 60000);
const failures = [];
let browser;

async function waitForOnline(page) {
  await page.waitForFunction(
    () => document.querySelector('#connection')?.textContent === 'ONLINE',
    undefined,
    { timeout: timeoutMs },
  );
}

async function state(page) {
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
  await waitForOnline(page);

  const before = await state(page);
  if (!before?.playerId) throw new Error('Initial session did not receive a player identity');
  await page.evaluate(({ x, z }) => window.__LAST_DIYA_E2E__.moveTo(x, z), { x: -2.5, z: -1 });
  await page.waitForTimeout(250);
  await page.evaluate(() => window.__LAST_DIYA_E2E__.interact());
  await page.waitForFunction(
    () => (document.querySelector('#quest-items')?.textContent?.toLowerCase() ?? '').includes('market lights'),
    undefined,
    { timeout: timeoutMs },
  );
  await page.waitForFunction(
    () => /Wick\s*<b>5<\/b>/i.test(document.querySelector('#inventory-items')?.innerHTML ?? ''),
    undefined,
    { timeout: timeoutMs },
  );

  const progressed = await state(page);
  const originalPlayerId = progressed.playerId;
  const originalPosition = progressed.position;
  console.log('PASS: authoritative quest and inventory state established before reload');

  await page.reload({ waitUntil: 'commit', timeout: startupTimeoutMs });
  await page.waitForFunction(
    () => !!document.querySelector('#connection') && !!window.__LAST_DIYA_E2E__,
    undefined,
    { timeout: startupTimeoutMs },
  );
  await waitForOnline(page);
  await page.waitForFunction(
    () => (document.querySelector('#quest-items')?.textContent?.toLowerCase() ?? '').includes('market lights'),
    undefined,
    { timeout: timeoutMs },
  );
  await page.waitForFunction(
    () => /Wick\s*<b>5<\/b>/i.test(document.querySelector('#inventory-items')?.innerHTML ?? ''),
    undefined,
    { timeout: timeoutMs },
  );

  const restored = await state(page);
  if (restored.playerId !== originalPlayerId) throw new Error(`Player identity changed after reload: ${originalPlayerId} -> ${restored.playerId}`);
  if (restored.lightLevel !== progressed.lightLevel) throw new Error(`Light Level changed after reload: ${progressed.lightLevel} -> ${restored.lightLevel}`);
  if (restored.position.x !== originalPosition.x || restored.position.z !== originalPosition.z) {
    throw new Error(`Player transform changed after reload: expected ${originalPosition.x},${originalPosition.z}; got ${restored.position.x},${restored.position.z}`);
  }
  if (!restored.quests.some((quest) => quest.id === 'first-flame' && quest.status === 'completed')) {
    throw new Error('Completed first-flame quest was lost after reload');
  }
  if (!restored.quests.some((quest) => quest.id === 'market-lights' && quest.status === 'active')) {
    throw new Error('Active market-lights quest was not restored after reload');
  }
  if (restored.inventory.find((item) => item.id === 'wick')?.quantity !== 5) {
    throw new Error('Inventory reward was not restored after reload');
  }
  if (failures.length) throw new Error(`Browser runtime errors: ${failures.join(' | ')}`);
  console.log('PASS: hard reload restored session identity, transform, quest progression, Light Level, and inventory');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
