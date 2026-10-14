import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { Settings } from '../src/types';

declare global {
  interface Window {
    settingsFixture: { calls: number; failPairing: boolean; holdNextCheck: boolean; releaseCheck: (() => void) | null };
    clickAnimations: number;
  }
}

async function installHost(page: Page) {
  await page.clock.install();
  await page.addInitScript(() => {
    let settings = { mode: 'host', endpoint: 'http://127.0.0.1:11434', name: 'Home server', diagnosticsKey: '', diagnosticsUrl: '' };
    window.settingsFixture = { calls: 0, failPairing: false, holdNextCheck: false, releaseCheck: null };
    Object.assign(window, { isTauri: true, __TAURI_INTERNALS__: { invoke: async (command: string, args?: { settings: Settings }) => {
      const fixture = window.settingsFixture;
      if (command === 'load_settings') return settings;
      if (command === 'save_settings') { settings = args!.settings; return settings; }
      if (command === 'get_pairing_code') {
        fixture.calls++;
        if (fixture.failPairing) throw new Error('Host companion is unavailable.');
        return { code: fixture.calls % 2 ? 'ABCD2345' : 'EFGH6789', expiresAtMs: Date.now() + 300000 };
      }
      if (command === 'companion_availability') return 'installed';
      if (command === 'check_readiness') {
        const result = {
          checkedAtMs: Date.now(), endpoint: args!.settings.endpoint, mode: args!.settings.mode, hostDetails: 'local',
          externalEndpoint: 'http://192.0.2.10:11434', gpuName: `GPU ${args!.settings.name}`,
          version: 'fixture', latencyMs: 1, modelCount: 1, installedModels: [], loadedModels: [],
          checks: ['ollama', 'tailscale', 'forwarding', 'models', 'gpu'].map(id => ({ id, title: id === 'models' ? 'Model library' : id, state: 'ok', label: 'Active', detail: '', help: null })),
        };
        if (fixture.holdNextCheck) {
          fixture.holdNextCheck = false;
          await new Promise<void>(resolve => { fixture.releaseCheck = resolve; });
        }
        return result;
      }
      return null;
    } } });
  });
  await page.goto('/');
  await page.clock.runFor(2100);
  await expect(page.getByRole('heading', { name: 'Your server is within reach.' })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Pairing code')).toHaveText('ABCD 2345');
}

test('pairing counts down, renews at expiry, and stops when Settings closes', async ({ page }) => {
  await installHost(page);
  await expect(page.locator('.pairing-countdown')).toHaveText('Expires in 5:00');
  await expect(page.getByRole('button', { name: 'New code', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Copy code', exact: true })).toHaveText('');
  await page.clock.runFor(1000);
  await expect(page.locator('.pairing-countdown')).toHaveText('Expires in 4:59');
  await page.clock.runFor(298000);
  await expect(page.locator('.pairing-countdown')).toHaveText('Expires in 0:01');
  expect(await page.evaluate(() => window.settingsFixture.calls)).toBe(1);
  await page.clock.runFor(1000);
  await expect(page.getByLabel('Pairing code')).toHaveText('EFGH 6789');
  await expect(page.locator('.pairing-countdown')).toHaveText('Expires in 5:00');
  await expect(page.getByRole('button', { name: 'Copy code', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.clock.runFor(310000);
  expect(await page.evaluate(() => window.settingsFixture.calls)).toBe(2);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Pairing code')).toHaveText('ABCD 2345');
});

test('expired codes cannot be copied and renewal recovers after a host outage or hidden window', async ({ page }) => {
  await installHost(page);
  await page.evaluate(() => { window.settingsFixture.failPairing = true; });
  await page.clock.runFor(300000);
  await expect(page.getByRole('button', { name: 'Copy code', exact: true })).toBeDisabled();
  await expect(page.getByRole('alert')).toHaveText('Host companion is unavailable.');
  await page.evaluate(() => { window.settingsFixture.failPairing = false; });
  await page.clock.runFor(14000);
  expect(await page.evaluate(() => window.settingsFixture.calls)).toBe(2);
  await page.clock.runFor(1000);
  await expect(page.getByRole('button', { name: 'Copy code', exact: true })).toBeEnabled();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(310000);
  expect(await page.evaluate(() => window.settingsFixture.calls)).toBe(3);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByLabel('Pairing code')).toHaveText('EFGH 6789');
  await expect(page.locator('.pairing-countdown')).toHaveText('Expires in 5:00');
});

test('Back cancels edits and Save requires a valid change', async ({ page }) => {
  await page.goto('/?demo=healthy');
  await expect(page.getByRole('heading', { name: 'Your server is within reach.' })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const save = page.getByRole('button', { name: 'Save', exact: true });
  await expect(save).toBeDisabled();
  await page.getByLabel('Server name').fill('  My GPU server  ');
  await expect(save).toBeDisabled();
  await page.getByLabel('Server name').fill('');
  await expect(save).toBeDisabled();
  await expect(page.getByLabel('Server name')).toHaveAccessibleDescription('Give your server a name between 1 and 60 characters.');
  await page.getByLabel('Server name').fill('Unsaved name');
  await expect(save).toBeEnabled();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Server name')).toHaveValue('My GPU server');
  await expect(save).toBeDisabled();
  await page.getByLabel('Server name').fill('Jungle PC');
  await save.click();
  await expect(page.getByRole('heading', { name: 'Jungle PC', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeFocused();
});

test('paired summary supports Change and Unpair without saving discarded changes', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('shambu-demo-settings', JSON.stringify({
    mode: 'remote', endpoint: 'http://192.0.2.10:11434', name: 'Home', diagnosticsKey: 'a'.repeat(64), diagnosticsUrl: '',
  })));
  await page.goto('/?demo=remote');
  await expect(page.getByRole('heading', { name: 'The Jungle PC', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('.paired-summary')).toContainText('Paired');
  await expect(page.getByLabel('Pairing code')).toHaveCount(0);
  await page.getByRole('button', { name: 'Change', exact: true }).click();
  await expect(page.getByLabel('Pairing code')).toBeFocused();
  await page.getByLabel('Pairing code').fill('SHAMBU42');
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Unpair', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('.paired-summary')).toBeVisible();
  await page.getByRole('button', { name: 'Unpair', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Not linked', { exact: true })).toHaveCount(2);
});

test('saving during a readiness check ignores the previous connection result', async ({ page }) => {
  await installHost(page);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.evaluate(() => { window.settingsFixture.holdNextCheck = true; });
  await page.getByRole('button', { name: 'Refresh status', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Server name').fill('New server');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.clock.runFor(2100);
  await expect(page.locator('.gpu-name')).toHaveText('GPU New server');
  await page.evaluate(() => window.settingsFixture.releaseCheck?.());
  await expect(page.locator('.gpu-name')).toHaveText('GPU New server');
});

test('click feedback works inside and outside Settings and respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    window.clickAnimations = 0;
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) { window.clickAnimations++; return animate.apply(this, args); };
  });
  await page.goto('/?demo=healthy');
  await expect(page.getByRole('heading', { name: 'Your server is within reach.' })).toBeVisible();
  await page.getByRole('button', { name: /Model library/ }).click();
  await expect.poll(() => page.evaluate(() => window.clickAnimations)).toBe(1);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const sliderPositions = () => page.locator('.settings-icon > .settings-slider').evaluateAll(sliders =>
    sliders.map(slider => Math.round(new DOMMatrix(getComputedStyle(slider).transform).m41)));
  await expect.poll(sliderPositions).toEqual([10, -10]);
  expect(await page.evaluate(() => window.clickAnimations)).toBe(1);
  await page.getByRole('button', { name: 'Remote server', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.clickAnimations)).toBe(2);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'This computer', exact: true }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect.poll(sliderPositions).toEqual([0, 0]);
  await expect(page.locator('.settings-icon > .settings-slider-top')).toHaveCSS('transition-duration', '0s');
  expect(await page.evaluate(() => window.clickAnimations)).toBe(2);
});

test('Settings stays accessible and fits desktop and narrow phones', async ({ page }) => {
  for (const width of [1300, 320]) {
    await page.setViewportSize({ width, height: 840 });
    await page.goto('/?demo=healthy');
    await expect(page.getByRole('heading', { name: 'Your server is within reach.' })).toBeVisible();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByLabel('Pairing code')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(result.violations).toEqual([]);
    await page.getByRole('button', { name: 'Remote server', exact: true }).click();
    await page.getByLabel('Ollama URL').fill('invalid');
    const errors = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(errors.violations).toEqual([]);
  }
});
