import { chromium } from 'playwright';
import WebSocket from 'ws';

const gameUrl = process.env.GAME_URL ?? 'http://127.0.0.1:5174/?e2e=1';
const clientCount = Number(process.env.BROWSER_PERF_CLIENTS ?? 30);
const sampleDurationMs = Number(process.env.BROWSER_PERF_SAMPLE_MS ?? 2500);
const repeatsPerMode = Number(process.env.BROWSER_PERF_REPEATS ?? 3);
const startupTimeoutMs = Number(process.env.BROWSER_STARTUP_TIMEOUT_MS ?? 60000);
const failures = [];
const consoleErrors = [];
let browser;
let page;
const peers = [];

if (!Number.isInteger(clientCount) || clientCount < 2 || clientCount > 30) throw new Error('BROWSER_PERF_CLIENTS must be an integer from 2 to 30');
if (!Number.isFinite(sampleDurationMs) || sampleDurationMs < 1500 || sampleDurationMs > 10000) throw new Error('BROWSER_PERF_SAMPLE_MS must be between 1500 and 10000');
if (!Number.isInteger(repeatsPerMode) || repeatsPerMode < 2 || repeatsPerMode > 5) throw new Error('BROWSER_PERF_REPEATS must be from 2 to 5');

function percentile(sorted, p) {
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] : 0;
}

function connectPeer(index, roomId) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(process.env.GAME_SERVER_URL ?? 'ws://127.0.0.1:8787');
    const peer = { index, socket, id: null, transform: null, roomSnapshot: null, settled: false };
    const timer = setTimeout(() => { socket.terminate(); reject(new Error('simulated peer ' + index + ' connection timed out')); }, startupTimeoutMs);
    const finish = () => {
      if (peer.settled || !peer.id || !peer.transform || !peer.roomSnapshot) return;
      peer.settled = true;
      clearTimeout(timer);
      resolve(peer);
    };
    socket.on('open', () => {
      socket.send(JSON.stringify({ type: 'hello', clientVersion: 'browser-render-performance' }));
      socket.send(JSON.stringify({ type: 'join_room', roomId }));
    });
    socket.on('message', (raw) => {
      let message;
      try { message = JSON.parse(raw.toString()); } catch { return; }
      if (message.type === 'session_assigned') { peer.id = message.playerId; peer.transform = message.transform; finish(); }
      if (message.type === 'room_snapshot') { peer.roomSnapshot = message; finish(); }
      if (message.type === 'error') {
        if (!peer.settled) {
          clearTimeout(timer);
          peer.settled = true;
          reject(new Error('simulated peer ' + index + ' rejected: ' + message.code + ' ' + message.message));
        }
      }
    });
    socket.on('error', (error) => { if (!peer.settled) { clearTimeout(timer); peer.settled = true; reject(error); } });
  });
}

try {
  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  page = await browser.newPage({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('requestfailed', (request) => consoleErrors.push('request failed: ' + request.url() + ' - ' + (request.failure()?.errorText ?? 'unknown')));

  await page.goto(gameUrl, { waitUntil: 'commit', timeout: startupTimeoutMs });
  await page.waitForFunction(() => !!document.querySelector('#connection') && !!window.__LAST_DIYA_E2E__, undefined, { timeout: startupTimeoutMs });
  await page.waitForFunction(() => document.querySelector('#connection')?.textContent === 'ONLINE' && !!window.__LAST_DIYA_E2E__?.getState().playerId, undefined, { timeout: startupTimeoutMs });

  // The game itself renders one WebGL canvas. The other room members use WebSocket peers only.
  // This exercises a full 30-player scene without running 30 software-rendered canvases in CI.
  const roomId = 'main-street';
  const botCount = clientCount - 1;
  peers.push(...await Promise.all(Array.from({ length: botCount }, (_, index) => connectPeer(index + 1, roomId))));
  if (new Set(peers.map((peer) => peer.id)).size !== botCount) throw new Error('Simulated peers did not get unique IDs');
  const identities = await page.evaluate(() => {
    const state = window.__LAST_DIYA_E2E__?.getState();
    const canvas = document.querySelector('#game canvas');
    return { playerId: state?.playerId, remotePlayerCount: state?.remotePlayerCount ?? -1, remoteAvatarLodEnabled: state?.remoteAvatarLodEnabled ?? false, renderer: state?.rendererInfo ?? null, position: state?.position, webglAvailable: !!canvas && !!canvas.getContext('webgl2'), visibilityState: document.visibilityState };
  });
  await page.waitForFunction((expected) => {
    const state = window.__LAST_DIYA_E2E__?.getState();
    return state?.remotePlayerCount === expected && state.remoteAvatarLodEnabled === (expected >= 8);
  }, botCount, { timeout: startupTimeoutMs });
  if (!identities.playerId || peers.some((peer) => peer.id === identities.playerId)) throw new Error('Browser player identity collided with a simulated peer');
  if (!identities.webglAvailable) throw new Error('WebGL2 is not available in the measured browser');
  const allTransforms = [identities.position, ...peers.map((peer) => peer.transform)];
  const spawnKeys = new Set(allTransforms.map((t) => [t.x, t.y, t.z].map((v) => Number(v).toFixed(3)).join(',')));
  if (spawnKeys.size !== clientCount) throw new Error('Expected ' + clientCount + ' distinct player spawn transforms, got ' + spawnKeys.size);
  console.log('PASS one Chromium WebGL client connected to ' + botCount + ' simulated peers; all ' + botCount + ' remote avatars loaded');

  // Pair an on/off dynamic shadow-map A/B on the same canvas and scene.
  await page.bringToFront();
  await page.waitForTimeout(1500);
  async function captureSample(shadowsEnabled) {
    await page.evaluate((enabled) => {
      const bridge = window.__LAST_DIYA_E2E__;
      if (!bridge?.setShadowMapEnabled) throw new Error('Shadow A/B test bridge unavailable');
      bridge.setShadowMapEnabled(enabled);
    }, shadowsEnabled);
    await page.waitForTimeout(350);
    return page.evaluate(async ({ durationMs, shadowsEnabled }) => {
      const frameTimes = [];
      const start = performance.now();
      let timedOut = false;
      await new Promise((resolve) => {
        const fallback = window.setTimeout(() => { timedOut = true; resolve(undefined); }, durationMs * 3);
        const onFrame = (now) => {
          frameTimes.push(now);
          if (now - start >= durationMs) { window.clearTimeout(fallback); resolve(undefined); }
          else window.requestAnimationFrame(onFrame);
        };
        window.requestAnimationFrame(onFrame);
      });
      const intervals = frameTimes.slice(1).map((time, index) => time - frameTimes[index]).sort((a, b) => a - b);
      const elapsedMs = (frameTimes.at(-1) ?? start) - (frameTimes[0] ?? start);
      const state = window.__LAST_DIYA_E2E__?.getState();
      const avgFps = elapsedMs > 0 ? (frameTimes.length - 1) / elapsedMs * 1000 : 0;
      const p95FrameMs = intervals.length ? intervals[Math.min(intervals.length - 1, Math.ceil(intervals.length * 0.95) - 1)] : 0;
      const p99FrameMs = intervals.length ? intervals[Math.min(intervals.length - 1, Math.ceil(intervals.length * 0.99) - 1)] : 0;
      const heapBytes = performance.memory?.usedJSHeapSize ?? null;
      return {
        shadowsEnabled, frames: frameTimes.length, timedOut,
        sampleElapsedMs: Number(elapsedMs.toFixed(2)), averageFps: Number(avgFps.toFixed(2)),
        p50FrameMs: Number((intervals.length ? intervals[Math.floor((intervals.length - 1) * 0.50)] : 0).toFixed(2)),
        p95FrameMs: Number(p95FrameMs.toFixed(2)), p99FrameMs: Number(p99FrameMs.toFixed(2)),
        remotePlayerCount: state?.remotePlayerCount ?? -1,
        crowdLodEnabled: state?.remoteAvatarLodEnabled ?? false,
        renderer: state?.rendererInfo ?? null,
        jsHeapMb: heapBytes === null ? null : Number((heapBytes / 1024 / 1024).toFixed(1)),
        webglAvailable: !!document.querySelector('#game canvas')?.getContext('webgl2'),
        visibilityState: document.visibilityState,
      };
    }, { durationMs: sampleDurationMs, shadowsEnabled });
  }

  const samples = { on: [], off: [] };
  for (let round = 0; round < repeatsPerMode; round += 1) {
    // Alternate order so warm-up and runner drift do not always favor one mode.
    const order = round % 2 === 0 ? [true, false] : [false, true];
    for (const enabled of order) {
      const sample = await captureSample(enabled);
      samples[enabled ? 'on' : 'off'].push(sample);
    }
  }
  const allSamples = [...samples.on, ...samples.off];
  const median = (values) => percentile([...values].sort((a, b) => a - b), 0.5);
  const summarizeMode = (entries) => ({
    medianAverageFps: Number(median(entries.map((entry) => entry.averageFps)).toFixed(2)),
    medianP50FrameMs: Number(median(entries.map((entry) => entry.p50FrameMs)).toFixed(2)),
    medianP95FrameMs: Number(median(entries.map((entry) => entry.p95FrameMs)).toFixed(2)),
    maxP95FrameMs: Number(Math.max(...entries.map((entry) => entry.p95FrameMs)).toFixed(2)),
    medianDrawCalls: Number(median(entries.map((entry) => entry.renderer?.calls ?? 0)).toFixed(1)),
    medianTriangles: Number(median(entries.map((entry) => entry.renderer?.triangles ?? 0)).toFixed(1)),
    medianJsHeapMb: Number(median(entries.map((entry) => entry.jsHeapMb ?? 0)).toFixed(1)),
    samples: entries,
  });

  if (failures.length) throw new Error('Browser runtime errors: ' + failures.join('; '));
  if (consoleErrors.length) throw new Error('Browser console/request errors: ' + consoleErrors.join(' | '));
  if (allSamples.some((sample) => sample.timedOut || sample.frames < 2 || !sample.webglAvailable || !sample.renderer || sample.renderer.calls < 1)) {
    throw new Error('One or more A/B samples did not produce valid WebGL frame data: ' + JSON.stringify(allSamples));
  }
  if (allSamples.some((sample) => sample.remotePlayerCount !== botCount || sample.crowdLodEnabled !== (botCount >= 8))) {
    throw new Error('One or more A/B samples did not retain the expected crowd LOD and remote avatars: ' + JSON.stringify(allSamples));
  }
  const maximumDrawCalls = Math.max(...allSamples.map((sample) => sample.renderer.calls));
  if (clientCount >= 20 && maximumDrawCalls > 500) throw new Error('Crowd LOD did not reduce renderer draw calls below 500: ' + maximumDrawCalls);
  const shadowOn = summarizeMode(samples.on);
  const shadowOff = summarizeMode(samples.off);
  const summary = {
    totalPlayers: clientCount, simulatedSocketPeers: botCount, remoteAvatarsInMeasuredCanvas: botCount,
    distinctSpawnPositions: spawnKeys.size, crowdLodEnabled: identities.remoteAvatarLodEnabled,
    repeatsPerShadowMode: repeatsPerMode, sampleDurationMs,
    shadowMapOn: shadowOn, shadowMapOff: shadowOff,
    p95FrameTimeChangePercent: shadowOn.medianP95FrameMs > 0
      ? Number(((shadowOff.medianP95FrameMs - shadowOn.medianP95FrameMs) / shadowOn.medianP95FrameMs * 100).toFixed(1))
      : null,
  };
  console.log('BROWSER_PERF_AB_RESULT ' + JSON.stringify(summary));
  console.log('PASS browser rendering shadow A/B | ' + clientCount + ' players | ' + botCount + ' remote avatars | ' + repeatsPerMode + ' samples per shadow mode | max draw calls ' + maximumDrawCalls);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  for (const peer of peers) if (peer.socket.readyState !== WebSocket.CLOSED) peer.socket.close();
  if (browser) await browser.close();
}
