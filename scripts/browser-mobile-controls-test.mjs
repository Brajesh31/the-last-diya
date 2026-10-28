import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const gameUrl = process.env.GAME_URL ?? 'http://127.0.0.1:5174/?e2e=1';
const timeoutMs = Number(process.env.BROWSER_TIMEOUT_MS ?? 20000);
let browser;

try {
  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto(gameUrl, { waitUntil: 'commit', timeout: timeoutMs });
  await page.waitForFunction(
    () => !!document.querySelector('#connection') && !!window.__LAST_DIYA_E2E__ && !!document.querySelector('.touch-controls'),
    undefined,
    { timeout: timeoutMs },
  );
  await page.waitForFunction(() => document.querySelector('#connection')?.textContent === 'ONLINE', undefined, { timeout: timeoutMs });
  const before = await page.evaluate(() => window.__LAST_DIYA_E2E__?.getState());
  assert.ok(before?.touchControlsVisible, 'mobile touch controls should be mounted');
  assert.equal(await page.locator('.touch-up').count(), 1);
  assert.equal(await page.locator('.touch-interact').count(), 1);
  console.log('PASS mobile Chromium renders directional pad and interact control');

  const qualityToggle = page.locator('.graphics-quality-toggle');
  assert.equal(await qualityToggle.count(), 1, 'touch devices should have a graphics quality toggle');
  let graphicsState = await page.evaluate(() => window.__LAST_DIYA_E2E__?.getState());
  assert.equal(graphicsState.graphicsQuality, 'low', 'mobile starts in low-quality rendering mode');
  assert.equal(graphicsState.rendererInfo.shadowsEnabled, false, 'low-quality mode disables shadow maps');
  assert.equal(graphicsState.rendererInfo.pixelRatio, 1, 'low-quality mode caps pixel ratio at 1');
  await qualityToggle.click();
  await page.waitForFunction(() => document.querySelector('.graphics-quality-toggle')?.textContent === 'Graphics: High');
  graphicsState = await page.evaluate(() => window.__LAST_DIYA_E2E__?.getState());
  assert.equal(graphicsState.graphicsQuality, 'high');
  assert.equal(graphicsState.rendererInfo.shadowsEnabled, true, 'high-quality mode restores shadow maps');
  assert.equal(graphicsState.rendererInfo.pixelRatio, 2, 'high-quality mode restores device pixel ratio cap');
  await qualityToggle.click();
  await page.waitForFunction(() => document.querySelector('.graphics-quality-toggle')?.textContent === 'Graphics: Low');
  console.log('PASS mobile low/high graphics toggle switches render resolution and shadow maps');

  const up = page.locator('.touch-up');
  await up.dispatchEvent('pointerdown', { pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1 });
  await page.waitForTimeout(550);
  await up.dispatchEvent('pointerup', { pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0, buttons: 0 });
  await page.waitForTimeout(200);
  const afterMove = await page.evaluate(() => window.__LAST_DIYA_E2E__?.getState());
  assert.ok(afterMove.position.z < before.position.z - 0.6, `touch movement should move the player forward, before z=${before.position.z} after z=${afterMove.position.z}`);
  console.log('PASS holding the touch movement control advances the player');

  await page.evaluate(() => window.__LAST_DIYA_E2E__?.moveTo(0, -4));
  await page.waitForFunction(
    () => (document.querySelector('.prompt')?.textContent ?? '').toLowerCase().includes('light the diya'),
    undefined,
    { timeout: timeoutMs },
  );
  await page.locator('.touch-interact').dispatchEvent('pointerdown', { pointerId: 8, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1 });
  await page.locator('.touch-interact').dispatchEvent('pointerup', { pointerId: 8, pointerType: 'touch', isPrimary: true, button: 0, buttons: 0 });
  await page.waitForFunction(
    () => document.querySelector('.light-readout #light')?.textContent?.trim() === 'LIGHT 10%',
    undefined,
    { timeout: timeoutMs },
  );
  console.log('PASS touch interact lights the diya through the real server interaction path');

  assert.deepEqual(pageErrors, [], 'mobile browser should have no uncaught page errors');
  console.log('PASS mobile touch controls completed without uncaught page errors');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
