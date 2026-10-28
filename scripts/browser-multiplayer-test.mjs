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

async function moveTo(page, x, z, label = null) {
  await page.bringToFront();
  await page.evaluate(({ x, z }) => {
    const bridge = window.__LAST_DIYA_E2E__;
    if (!bridge) throw new Error('Development-only test bridge unavailable. Ensure GAME_URL includes ?e2e=1.');
    return bridge.moveTo(x, z);
  }, { x, z });
  // Let the client animation loop publish the accepted transform to the authoritative server.
  await page.waitForTimeout(300);
  if (label) await waitForText(page, '.prompt', label, label);
}

async function interact(page) {
  await page.bringToFront();
  // Give the foreground tab a frame to refresh its interaction prompt from latest server targets.
  await page.waitForTimeout(180);
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

  // Continue player one's browser through the full market -> temple memory -> final diya chain.
  const marketTargets = [
    { x: 2.5, z: -8, id: 'market-stall-01' },
    { x: -2.5, z: -9.5, id: 'market-stall-02' },
    { x: 2.5, z: -11, id: 'market-stall-03' },
  ];
  for (const [index, target] of marketTargets.entries()) {
    await moveTo(pages[0], target.x, target.z, 'Press E to collect diya');
    await interact(pages[0]);
    await pages[0].waitForFunction(
      (expectedProgress) => {
        const quest = document.querySelector('#quest-items')?.textContent?.toLowerCase() ?? '';
        return expectedProgress < 3
          ? quest.includes('market lights') && quest.includes(expectedProgress + '/3')
          : quest.includes('temple memory');
      },
      index + 1,
      { timeout: timeoutMs },
    );
  }
  console.log('PASS: player one collected all three market diyas and unlocked the temple memory');

  await moveTo(pages[0], 2.5, -17, 'Press E to collect memory fragment');
  await interact(pages[0]);
  await pages[0].locator('.memory-card').waitFor({ state: 'visible', timeout: timeoutMs });
  await pages[0].waitForTimeout(300);
  await interact(pages[0]);
  await pages[0].locator('.memory-card').waitFor({ state: 'hidden', timeout: timeoutMs });
  await waitForText(pages[0], '#quest-items', 'last diya', 'last diya quest unlock');
  console.log('PASS: player one restored the temple memory and unlocked the final quest');

  // Raise shared Light Level through cooperative flame sharing, using real E-key input
  // and respecting the server's per-player action throttle.
  await moveTo(pages[0], 0, -1);
  await moveTo(pages[1], 0, -1);
  await pages[0].waitForTimeout(750);
  const sharingDiagnostics = async () => Promise.all(pages.map((page) =>
    page.evaluate(() => {
      const state = window.__LAST_DIYA_E2E__?.getState();
      return state ? {
        playerId: state.playerId,
        position: state.position,
        remotePlayers: state.remotePlayers,
        remotePlayerCount: state.remotePlayerCount,
        memoryOpen: state.memoryOpen,
        promptText: state.promptText,
        lightLevel: state.lightLevel,
      } : null;
    })
  ));
  const sharingReadyUntil = Date.now() + 5000;
  let sharingReady = false;
  let sharingState = await sharingDiagnostics();
  while (Date.now() < sharingReadyUntil) {
    sharingState = await sharingDiagnostics();
    sharingReady = sharingState.every((state) => state &&
      state.remotePlayers.some((remote) =>
        Math.hypot(remote.target.x - state.position.x, remote.target.z - state.position.z) < 2.5) &&
      !state.memoryOpen);
    if (sharingReady) break;
    await pages[0].waitForTimeout(100);
  }
  if (!sharingReady) throw new Error('Flame sharing precondition failed: ' + JSON.stringify(sharingState));

  for (let targetLevel = 15, step = 0; targetLevel <= 100; targetLevel += 5, step += 1) {
    const page = step % 2 === 0 ? pages[0] : pages[1];
    await page.bringToFront();
    await page.waitForTimeout(180);
    // Invoke the same interact() game function through the development-only bridge.
    // This avoids background-tab keyboard focus deciding a server-authoritative action.
    await page.evaluate(() => {
      const bridge = window.__LAST_DIYA_E2E__;
      if (!bridge) throw new Error('Development-only test bridge unavailable during flame share');
      bridge.interact();
    });
    await page.waitForTimeout(280);
    try {
      await Promise.all(pages.map((clientPage) => clientPage.waitForFunction(
        (expectedLevel) => document.querySelector('.light-readout #light')?.textContent?.trim() === 'LIGHT ' + expectedLevel + '%',
        targetLevel,
        { timeout: 5000 },
      )));
    } catch {
      throw new Error('Flame share did not raise Light Level to ' + targetLevel + '%. State: ' + JSON.stringify(await sharingDiagnostics()));
    }
  }
  await Promise.all(pages.map((page) => waitForText(page, '.light-readout #light-stage', 'neighbourhood alive', 'full Light Level world stage')));
  console.log('PASS: cooperative flame sharing raised the shared Light Level to 100%');

  await moveTo(pages[0], 0, -24, 'Press E to light the community diya');
  await interact(pages[0]);
  await waitForText(pages[0], '.prompt', 'The neighbourhood is alive again', 'final community celebration');
  await pages[0].waitForFunction(
    () => (document.querySelector('#quest-items')?.textContent?.toLowerCase() ?? '').includes('all quests complete'),
    undefined,
    { timeout: timeoutMs },
  );
  console.log('PASS: player one lit the final community diya and completed all five quests');

  const [first, second] = await Promise.all(pages.map((page) => page.evaluate(() => window.__LAST_DIYA_E2E__?.getState())));
  if (!first?.playerId || !second?.playerId || first.playerId === second.playerId) {
    throw new Error('Browser clients did not retain unique player identities');
  }
  if (first.lightLevel !== 100) throw new Error(`Expected player one to observe Light Level 100%, got ${first.lightLevel}`);
  if (!first.finalEventActive) throw new Error('Final community celebration was not active after the last diya interaction');
  if (!first.quests.some((quest) => quest.id === 'last-diya' && quest.status === 'completed')) {
    throw new Error('Player one last-diya quest was not completed in the browser');
  }
  if (first.inventory.find((item) => item.id === 'wick')?.quantity !== 5) {
    throw new Error('Player one doorway reward/inventory was not preserved through the full quest chain');
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
