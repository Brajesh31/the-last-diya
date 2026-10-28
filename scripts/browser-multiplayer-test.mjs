import { chromium } from 'playwright';

const gameUrl = process.env.GAME_URL ?? 'http://127.0.0.1:5174';
const timeoutMs = Number(process.env.BROWSER_TIMEOUT_MS ?? 15000);
const startupTimeoutMs = Number(process.env.BROWSER_STARTUP_TIMEOUT_MS ?? 45000);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
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

async function holdKeys(page, keys, durationMs) {
  for (const key of keys) await page.keyboard.down(key);
  await page.waitForTimeout(durationMs);
  for (const key of [...keys].reverse()) await page.keyboard.up(key);
}

async function walkToDiya(page, needsPrompt) {
  await page.locator('#game canvas').click({ position: { x: 20, y: 20 } });
  await holdKeys(page, ['w'], 1400);
  if (needsPrompt) {
    await waitForText(page, '.prompt', 'Press E to light the diya', 'interaction prompt for main diya');
  }
  await page.keyboard.press('e');
}

async function walkToDoorway(page) {
  await holdKeys(page, ['a', 's'], 600);
  await waitForText(page, '.prompt', 'Press E to collect 2 wicks', 'doorway pickup prompt');
  await page.keyboard.press('e');
}

try {
  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const pages = [await browser.newPage({ viewport: { width: 1280, height: 800 } }), await browser.newPage({ viewport: { width: 1280, height: 800 } })];
  for (const [index, page] of pages.entries()) {
    page.on('pageerror', (error) => failures.push(`client ${index + 1}: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(`client ${index + 1}: ${message.text()}`);
    });
    page.on('requestfailed', (request) => consoleErrors.push(`client ${index + 1} request failed: ${request.url()} - ${request.failure()?.errorText ?? 'unknown'}`));
    page.on('websocket', (ws) => {
      ws.on('framereceived', (frame) => {
        const payload = typeof frame.payload === 'string' ? frame.payload : '';
        if (payload) console.log(`client ${index + 1} WS< ${payload.slice(0, 180)}`);
      });
    });
    await page.goto(gameUrl, { waitUntil: 'domcontentloaded', timeout: startupTimeoutMs });
    // The WebGL renderer can take substantially longer to initialize in shared CI runners.
    // Validate the actual game readiness below via its WebSocket-connected HUD and quest state.
    await page.waitForFunction(
      () => !!document.querySelector('#connection') && !!document.querySelector('#quest-items'),
      undefined,
      { timeout: startupTimeoutMs },
    );
  }

  await Promise.all(pages.map((page) => page.waitForFunction(
    () => document.querySelector('#connection')?.textContent === 'ONLINE',
    undefined,
    { timeout: timeoutMs },
  )));
  await Promise.all(pages.map((page) => waitForText(page, '#quest-items', 'first flame', 'initial personal quest')));
  console.log('PASS: two real Chromium browser clients connected and loaded personal quest state');

  await walkToDiya(pages[0], true);
  await Promise.all(pages.map((page) => page.waitForFunction(
    () => document.querySelector('.light-readout #light')?.textContent?.trim() === 'LIGHT 10%',
    undefined,
    { timeout: timeoutMs },
  )));
  await waitForText(pages[0], '#quest-items', 'help sharma aunty', 'first player quest advancement');
  await waitForText(pages[1], '#quest-items', 'first flame', 'second player quest remains personal');
  console.log('PASS: player one lit the shared diya and both browsers observed Light Level 10%');
  console.log('PASS: only player one advanced their personal first-flame quest');

  await walkToDiya(pages[1], false);
  await waitForText(pages[1], '#quest-items', 'help sharma aunty', 'second player quest advancement');
  console.log('PASS: player two progressed their personal quest after the shared diya was already lit');

  await walkToDoorway(pages[0]);
  await waitForText(pages[0], '#quest-items', 'market lights', 'player one doorway quest reward');
  await waitForText(pages[0], '#inventory-items', 'wick', 'player one inventory reward');
  await pages[0].waitForFunction(
    () => /Wick\s*<b>5<\/b>/i.test(document.querySelector('#inventory-items')?.innerHTML ?? ''),
    undefined,
    { timeout: timeoutMs },
  );
  console.log('PASS: player one collected the doorway pickup, received quest reward and advanced to market lights');

  await walkToDoorway(pages[1]);
  await waitForText(pages[1], '#quest-items', 'market lights', 'player two doorway quest reward');
  await pages[1].waitForFunction(
    () => /Wick\s*<b>5<\/b>/i.test(document.querySelector('#inventory-items')?.innerHTML ?? ''),
    undefined,
    { timeout: timeoutMs },
  );
  console.log('PASS: player two independently collected the same personal pickup and received their own reward');

  if (failures.length) throw new Error(`Browser runtime errors: ${failures.join('; ')}`);
  if (consoleErrors.length) console.log(`Browser console diagnostics: ${consoleErrors.join(' | ')}`);
  console.log('PASS: browser multiplayer end-to-end checks completed without page errors');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
