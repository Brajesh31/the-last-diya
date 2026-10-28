import { chromium } from 'playwright';

const gameUrl = process.env.GAME_URL ?? 'http://127.0.0.1:5174/?e2e=1';
const timeoutMs = Number(process.env.BROWSER_TIMEOUT_MS ?? 20000);
const startupTimeoutMs = Number(process.env.BROWSER_STARTUP_TIMEOUT_MS ?? 60000);
const failures = [];
const consoleErrors = [];
let browser;

async function waitForText(page, selector, text, label) {
  await page.waitForFunction(
    ({ selector, text }) => (document.querySelector(selector)?.textContent ?? '').toLowerCase().includes(text.toLowerCase()),
    { selector, text },
    { timeout: timeoutMs },
  ).catch(async () => {
    const actual = await page.locator(selector).textContent().catch(() => 'missing');
    throw new Error(`Timed out waiting for ${label}; found: "${actual ?? 'missing'}"`);
  });
}

async function moveTo(page, x, z, label) {
  await page.bringToFront();
  await page.evaluate(({ x, z }) => {
    const bridge = window.__LAST_DIYA_E2E__;
    if (!bridge) throw new Error('Development-only test bridge unavailable. Ensure GAME_URL includes ?e2e=1.');
    return bridge.moveTo(x, z);
  }, { x, z });
  // Let the client animation loop publish the accepted transform to the authoritative server.
  await page.waitForTimeout(300);
  await waitForText(page, '.prompt', label, label);
}

async function interact(page) {
  await page.bringToFront();
  await page.keyboard.press('e');
}

try {
  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });

  const pages = [
    await browser.newPage({ viewport: { width: 800, height: 500 }, deviceScaleFactor: 1 }),
    await browser.newPage({ viewport: { width: 800, height: 500 }, deviceScaleFactor: 1 }),
  ];

  for (const [index, page] of pages.entries()) {
    page.on('pageerror', (error) => failures.push(`client ${index + 1}: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(`client ${index + 1}: ${message.text()}`);
    });
    page.on('requestfailed', (request) => consoleErrors.push(`client ${index + 1} request failed: ${request.url()} - ${request.failure()?.errorText ?? 'unknown'}`));
    await page.goto(gameUrl, { waitUntil: 'commit', timeout: startupTimeoutMs });
    await page.waitForFunction(
      () => !!document.querySelector('#connection') && !!document.querySelector('#quest-items') && !!window.__LAST_DIYA_E2E__,
      undefined,
      { timeout: startupTimeoutMs },
    );
  }

  await Promise.all(pages.map((page) => page.waitForFunction(
    () => document.querySelector('#connection')?.textContent === 'ONLINE',
    undefined,
    { timeout: startupTimeoutMs },
  )));
  await Promise.all(pages.map((page) => waitForText(page, '#quest-items', 'first flame', 'initial personal quest')));
  console.log('PASS: two Chromium browser clients connected and loaded separate personal quest state');

  await moveTo(pages[0], 0, -4, 'Press E to light the diya');
  await interact(pages[0]);
  await Promise.all(pages.map((page) => page.waitForFunction(
    () => document.querySelector('.light-readout #light')?.textContent?.trim() === 'LIGHT 10%',
    undefined,
    { timeout: timeoutMs },
  )));
  await waitForText(pages[0], '#quest-items', 'help sharma aunty', 'first player quest advancement');
  await waitForText(pages[1], '#quest-items', 'first flame', 'second player personal quest stays available');
  console.log('PASS: player one lit the shared diya and both browsers observed Light Level 10%');
  console.log('PASS: only player one advanced their personal first-flame quest');

  await moveTo(pages[1], 0, -4, 'Press E to carry the shared flame forward');
  await interact(pages[1]);
  await waitForText(pages[1], '#quest-items', 'help sharma aunty', 'second player first-flame quest completion');
  console.log('PASS: player two progressed their personal quest after the shared diya was already lit');

  await moveTo(pages[0], -2.5, -1, 'Press E to collect 2 wicks');
  await interact(pages[0]);
  await waitForText(pages[0], '#quest-items', 'market lights', 'player one doorway quest reward');
  await pages[0].waitForFunction(
    () => /Wick\s*<b>5<\/b>/i.test(document.querySelector('#inventory-items')?.innerHTML ?? ''),
    undefined,
    { timeout: timeoutMs },
  );
  console.log('PASS: player one collected their doorway pickup and received the quest reward');

  await moveTo(pages[1], -2.5, -1, 'Press E to collect 2 wicks');
  await interact(pages[1]);
  await waitForText(pages[1], '#quest-items', 'market lights', 'player two doorway quest reward');
  await pages[1].waitForFunction(
    () => /Wick\s*<b>5<\/b>/i.test(document.querySelector('#inventory-items')?.innerHTML ?? ''),
    undefined,
    { timeout: timeoutMs },
  );
  console.log('PASS: player two independently collected the same personal pickup and received their own reward');

  const [first, second] = await Promise.all(pages.map((page) => page.evaluate(() => window.__LAST_DIYA_E2E__?.getState())));
  if (!first?.playerId || !second?.playerId || first.playerId === second.playerId) {
    throw new Error('Browser clients did not retain unique player identities');
  }
  if (failures.length) throw new Error(`Browser runtime errors: ${failures.join('; ')}`);
  if (consoleErrors.length) throw new Error(`Browser console/request errors: ${consoleErrors.join(' | ')}`);
  console.log('PASS: browser multiplayer end-to-end checks completed without runtime or console errors');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
