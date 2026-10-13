import { test, expect, type Page } from '@playwright/test';
import type { GpuMetrics, Settings } from '../src/types';

declare global {
  interface Window {
    gpuFixture: { metrics: GpuMetrics | null; calls: number; checks: number; hold: boolean; release: (() => void)[] };
  }
}

async function installHost(page: Page) {
  await page.clock.install();
  await page.addInitScript(() => {
    const settings = { mode: 'remote', endpoint: 'http://192.0.2.10:11434', name: 'Home', diagnosticsKey: 'a'.repeat(64), diagnosticsUrl: '' };
    window.gpuFixture = { metrics: { sampleAgeMs: 0, devices: [{ index: 0, loadPercent: 71, memoryUsedMib: 16384, memoryTotalMib: 49152 }] }, calls: 0, checks: 0, hold: false, release: [] };
    Object.assign(window, { isTauri: true, __TAURI_INTERNALS__: { invoke: async (command: string, args?: { settings: Settings }) => {
      const fixture = window.gpuFixture;
      if (command === 'load_settings') return settings;
      if (command === 'save_settings') return args!.settings;
      if (command === 'get_gpu_metrics') {
        fixture.calls++;
        const captured = structuredClone(fixture.metrics);
        if (fixture.hold) await new Promise<void>(resolve => fixture.release.push(resolve));
        return captured;
      }
      if (command === 'companion_availability') return 'installed';
      if (command === 'check_readiness') {
        fixture.checks++;
        return {
          checkedAtMs: Date.now(), endpoint: args!.settings.endpoint, mode: 'remote', hostDetails: 'linked', gpuName: 'NVIDIA Quadro RTX 8000', serverName: 'The Jungle PC',
          version: 'fixture', latencyMs: 1, modelCount: 1, installedModels: [], loadedModels: [],
          checks: ['ollama', 'tailscale', 'forwarding', 'models', 'gpu'].map(id => ({ id, title: id === 'models' ? 'Model library' : id, state: 'ok', label: 'Active', detail: '', help: null })),
        };
      }
      return null;
    } } });
  });
  await page.goto('/');
  await expect(page.locator('.gpu-metrics')).toContainText('71%');
  await page.clock.runFor(2100);
  await expect(page.locator('.gpu-name')).toHaveText('Nvidia Quadro RTX 8000');
}

test('paired GPU load and memory sit below the name and refresh without a readiness probe', async ({ page }) => {
  await installHost(page);
  await expect(page.locator('.gpu-metrics')).toContainText('VRAM 16/48 G');
  await expect(page.locator('.gpu-details')).toHaveCSS('text-align', 'right');
  await expect(page.getByText('Remote GPU:', { exact: false })).toHaveCount(0);
  const name = await page.locator('.gpu-name').boundingBox();
  const metrics = await page.locator('.gpu-metrics').boundingBox();
  expect(metrics!.y).toBeGreaterThan(name!.y);
  const checks = await page.evaluate(() => window.gpuFixture.checks);
  await page.evaluate(() => { window.gpuFixture.metrics!.devices[0].loadPercent = 0; window.gpuFixture.metrics!.devices[0].memoryUsedMib = 0; });
  await page.clock.runFor(5100);
  await expect(page.locator('.gpu-metrics')).toContainText('GPU load 0%');
  await expect(page.locator('.gpu-metrics')).toContainText('VRAM 0/48 G');
  expect(await page.evaluate(() => window.gpuFixture.checks)).toBe(checks);
  await page.evaluate(() => { window.gpuFixture.metrics!.devices[0].loadPercent = null; });
  await page.clock.runFor(5100);
  await expect(page.locator('.gpu-metrics')).toContainText('GPU load N/A');
  await expect(page.locator('.gpu-metrics')).toContainText('VRAM 0/48 G');
});

test('expired GPU readings disappear even while the next request is stalled', async ({ page }) => {
  await installHost(page);
  await page.evaluate(() => { window.gpuFixture.hold = true; window.gpuFixture.metrics!.sampleAgeMs = 15001; });
  await page.clock.runFor(16000);
  await expect(page.locator('.gpu-metrics')).toHaveText('GPU load N/AVRAM N/A');
  await page.evaluate(() => { window.gpuFixture.hold = false; window.gpuFixture.release.splice(0).forEach(resolve => resolve()); });
  await expect(page.locator('.gpu-metrics')).toHaveText('GPU load N/AVRAM N/A');
  await expect(page.getByRole('heading', { name: 'Your server is within reach.' })).toBeVisible();
});

test('hidden windows pause polling and resume with new readings', async ({ page }) => {
  await installHost(page);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const before = await page.evaluate(() => window.gpuFixture.calls);
  await page.clock.runFor(20000);
  expect(await page.evaluate(() => window.gpuFixture.calls)).toBe(before);
  await expect(page.locator('.gpu-metrics')).toContainText('GPU load N/A');
  await page.evaluate(() => {
    window.gpuFixture.metrics!.devices[0].loadPercent = 23;
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('.gpu-metrics')).toContainText('GPU load 23%');
});

test('a late response from the old server cannot populate a new connection', async ({ page }) => {
  await installHost(page);
  await page.evaluate(() => { window.gpuFixture.hold = true; });
  await page.clock.runFor(5100);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Ollama URL').fill('http://192.0.2.11:11434');
  await page.evaluate(() => { window.gpuFixture.metrics = null; window.gpuFixture.hold = false; });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.evaluate(() => window.gpuFixture.release.splice(0).forEach(resolve => resolve()));
  await expect(page.locator('.gpu-metrics')).toHaveText('GPU load N/AVRAM N/A');
  await page.clock.runFor(2100);
  await expect(page.locator('.endpoint')).toHaveText('http://192.0.2.11:11434');
});
