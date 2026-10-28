import { chromium } from 'playwright';

const gameUrl = process.env.GAME_URL ?? 'http://127.0.0.1:5174/?e2e=1';
const clientCount = Number(process.env.BROWSER_PERF_CLIENTS ?? 6);
const sampleDurationMs = Number(process.env.BROWSER_PERF_SAMPLE_MS ?? 6000);
const startupTimeoutMs = Number(process.env.BROWSER_STARTUP_TIMEOUT_MS ?? 60000);
const failures = [];
const consoleErrors = [];
let browser;

if (!Number.isInteger(clientCount) || clientCount < 2 || clientCount > 12) throw new Error('BROWSER_PERF_CLIENTS must be an integer from 2 to 12');
if (!Number.isFinite(sampleDurationMs) || sampleDurationMs < 2000 || sampleDurationMs > 30000) throw new Error('BROWSER_PERF_SAMPLE_MS must be between 2000 and 30000');

function percentile(sorted, p) {
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] : 0;
}

try {
  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });

  const pages = await Promise.all(Array.from({ length: clientCount }, () => browser.newPage({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 })));
  await Promise.all(pages.map(async (page, index) => {
    page.on('pageerror', (error) => failures.push('client ' + (index + 1) + ': ' + error.message));
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push('client ' + (index + 1) + ': ' + message.text()); });
    page.on('requestfailed', (request) => consoleErrors.push('client ' + (index + 1) + ' request failed: ' + request.url() + ' - ' + (request.failure()?.errorText ?? 'unknown')));
    await page.goto(gameUrl, { waitUntil: 'commit', timeout: startupTimeoutMs });
    await page.waitForFunction(() => !!document.querySelector('#connection') && !!window.__LAST_DIYA_E2E__, undefined, { timeout: startupTimeoutMs });
  }));

  await Promise.all(pages.map((page) => page.waitForFunction(
    () => document.querySelector('#connection')?.textContent === 'ONLINE',
    undefined,
    { timeout: startupTimeoutMs },
  )));
  await Promise.all(pages.map((page) => page.waitForFunction(
    (expected) => window.__LAST_DIYA_E2E__?.getState().remotePlayerCount === expected,
    clientCount - 1,
    { timeout: startupTimeoutMs },
  )));

  const identities = await Promise.all(pages.map((page) => page.evaluate(() => {
    const state = window.__LAST_DIYA_E2E__?.getState();
    const canvas = document.querySelector('#game canvas');
    return {
      playerId: state?.playerId,
      remotePlayerCount: state?.remotePlayerCount ?? -1,
      rendererInfo: state?.rendererInfo ?? null,
      webglAvailable: !!canvas && !!canvas.getContext('webgl2'),
      visible: document.visibilityState === 'visible',
    };
  })));
  if (new Set(identities.map((entry) => entry.playerId)).size !== clientCount || identities.some((entry) => !entry.playerId)) {
    throw new Error('Browser contexts did not receive unique player identities');
  }
  if (identities.some((entry) => entry.remotePlayerCount !== clientCount - 1)) {
    throw new Error('At least one client did not render all expected remote avatars');
  }
  if (identities.some((entry) => !entry.webglAvailable)) throw new Error('WebGL2 was not available in every game client');
  console.log('PASS ' + clientCount + ' Chromium clients connected with ' + (clientCount - 1) + ' remote avatars each');

  // Move every local avatar while sampling real requestAnimationFrame intervals.
  await Promise.all(pages.map((page) => page.keyboard.down('w')));
  const metrics = await Promise.all(pages.map(async (page, index) => page.evaluate(async ({ sampleDurationMs, index }) => {
    const frameTimes = [];
    const start = performance.now();
    await new Promise((resolve) => {
      const sample = (now) => {
        frameTimes.push(now);
        if (now - start >= sampleDurationMs) resolve(undefined);
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    const intervals = frameTimes.slice(1).map((time, frameIndex) => time - frameTimes[frameIndex]).sort((a, b) => a - b);
    const elapsedMs = (frameTimes.at(-1) ?? start) - (frameTimes[0] ?? start);
    const stats = window.__LAST_DIYA_E2E__?.getState();
    const avgFps = elapsedMs > 0 ? (frameTimes.length - 1) / elapsedMs * 1000 : 0;
    const p95FrameMs = intervals.length ? intervals[Math.min(intervals.length - 1, Math.ceil(intervals.length * 0.95) - 1)] : 0;
    const p99FrameMs = intervals.length ? intervals[Math.min(intervals.length - 1, Math.ceil(intervals.length * 0.99) - 1)] : 0;
    const heapBytes = performance.memory?.usedJSHeapSize ?? null;
    return {
      client: index + 1,
      frames: frameTimes.length,
      sampleElapsedMs: Number(elapsedMs.toFixed(2)),
      averageFps: Number(avgFps.toFixed(2)),
      p50FrameMs: Number(intervals.length ? intervals[Math.floor((intervals.length - 1) * 0.50)].toFixed(2) : 0),
      p95FrameMs: Number(p95FrameMs.toFixed(2)),
      p99FrameMs: Number(p99FrameMs.toFixed(2)),
      estimatedP5Fps: Number((p95FrameMs > 0 ? 1000 / p95FrameMs : 0).toFixed(2)),
      remotePlayerCount: stats?.remotePlayerCount ?? -1,
      renderer: stats?.rendererInfo ?? null,
      jsHeapMb: heapBytes === null ? null : Number((heapBytes / 1024 / 1024).toFixed(1)),
      webglAvailable: !!document.querySelector('#game canvas')?.getContext('webgl2'),
    };
  }, { sampleDurationMs, index })));
  await Promise.all(pages.map((page) => page.keyboard.up('w')));

  if (failures.length) throw new Error('Browser runtime errors: ' + failures.join('; '));
  if (consoleErrors.length) throw new Error('Browser console/request errors: ' + consoleErrors.join(' | '));
  if (metrics.some((entry) => entry.frames < 10 || entry.averageFps < 1 || !entry.renderer || entry.renderer.calls < 1)) {
    throw new Error('At least one client did not produce a usable rendering sample: ' + JSON.stringify(metrics));
  }
  const sortedFps = metrics.map((entry) => entry.averageFps).sort((a, b) => a - b);
  const sortedP95 = metrics.map((entry) => entry.p95FrameMs).sort((a, b) => a - b);
  const summary = {
    clientCount, sampleDurationMs, clientsWithExpectedRemoteAvatars: metrics.filter((entry) => entry.remotePlayerCount === clientCount - 1).length,
    averageFpsMedian: Number(percentile(sortedFps, 0.5).toFixed(2)),
    averageFpsMinimum: Number(sortedFps[0].toFixed(2)),
    frameTimeP95MedianMs: Number(percentile(sortedP95, 0.5).toFixed(2)),
    frameTimeP95MaximumMs: Number(sortedP95.at(-1).toFixed(2)),
    jsHeapMbMedian: metrics.every((entry) => entry.jsHeapMb !== null) ? Number(percentile(metrics.map((entry) => entry.jsHeapMb).sort((a,b) => a-b), 0.5).toFixed(1)) : null,
    perClient: metrics,
  };
  console.log('BROWSER_PERF_RESULT ' + JSON.stringify(summary));
  console.log('PASS browser rendering benchmark | ' + clientCount + ' clients | ' + (clientCount - 1) + ' remote avatars per client | median FPS ' + summary.averageFpsMedian + ' | median p95 frame time ' + summary.frameTimeP95MedianMs + 'ms');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
