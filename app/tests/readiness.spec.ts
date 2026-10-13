import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';

test('healthy checks, idle GPU, and expandable evidence', async ({ page }) => {
  await page.goto('/?demo=healthy');
  await expect(page.getByRole('heading', { name: 'Your server is within reach.' })).toBeVisible();
  await expect(page.getByText('Design preview')).toBeVisible();
  await page.locator('summary').filter({ hasText: 'Model allocation' }).click();
  await expect(page.getByText(/No model is loaded, so Ollama GPU use is not yet verified/)).toBeVisible();
  await page.getByRole('button', { name: 'Check again', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Checking server' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Check again', exact: true })).toBeEnabled();
});

test('unreachable API does not retain an all-clear headline', async ({ page }) => {
  await page.goto('/?demo=offline');
  await expect(page.getByRole('heading', { name: 'Something is out of reach.' })).toBeVisible();
  await expect(page.getByText('Unreachable', { exact: true })).toBeVisible();
  await page.locator('summary').filter({ hasText: 'Ollama local URL' }).click();
  await expect(page.getByText('Check that Ollama is running and the port is correct.')).toBeVisible();
});

test('CPU allocation gets attention without changing the server', async ({ page }) => {
  await page.goto('/?demo=cpu');
  await expect(page.getByRole('heading', { name: 'A little attention needed.' })).toBeVisible();
  await expect(page.getByText('CPU detected', { exact: true })).toBeVisible();
});

test('remote settings reject localhost and persist a valid address', async ({ page }) => {
  await page.goto('/?demo=healthy');
  await expect(page.getByRole('button', { name: 'Check again', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Connection', exact: true }).click();
  await page.getByRole('button', { name: 'Remote server', exact: true }).click();
  await page.getByLabel('Ollama URL').fill('http://localhost:11434');
  await page.getByRole('button', { name: 'Save & check' }).click();
  await expect(page.getByRole('alert')).toHaveText('Localhost means this device. Enter the address of your GPU PC.');
  await page.getByLabel('Ollama URL').fill('http://192.0.2.10:11434');
  await page.getByLabel('Server name').fill('Home server');
  await page.getByRole('button', { name: 'Save & check' }).click();
  await expect(page.getByText('http://192.0.2.10:11434', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Home server', exact: true })).toBeVisible();
  await expect(page.getByText('Tailscale on server', { exact: true })).toBeVisible();
  await expect(page.getByText('Not linked', { exact: true })).toHaveCount(2);
});

test('old readings lose the fresh headline when auto-check is paused', async ({ page }) => {
  await page.clock.install();
  await page.goto('/?demo=healthy');
  await page.clock.runFor(1000);
  await expect(page.getByRole('heading', { name: 'Your server is within reach.' })).toBeVisible();
  await page.getByLabel('Auto-check every 30s').uncheck();
  await page.clock.runFor(70000);
  await expect(page.getByRole('heading', { name: 'Time for a fresh look.' })).toBeVisible();
});

test('desktop and phone stay readable and accessible', async ({ page }) => {
  await mkdir('../.impeccable/review', { recursive: true });
  for (const [name, width, height, scenario] of [
    ['desktop', 1040, 728, 'healthy'], ['mobile', 390, 844, 'remote'], ['mobile-error', 390, 844, 'offline'],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/?demo=' + scenario);
    await expect(page.getByRole('button', { name: 'Check again', exact: true })).toBeEnabled();
    await expect(page.getByRole('heading', { name: scenario === 'offline' ? 'Something is out of reach.' : 'Your server is within reach.' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Server readiness checks' })).toHaveAttribute('aria-busy', 'false');
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(result.violations).toEqual([]);
    await page.screenshot({ path: '../.impeccable/review/' + name + '.png', fullPage: true });
  }
  await page.setViewportSize({ width: 320, height: 740 });
  await page.getByRole('button', { name: 'Connection', exact: true }).click();
  await expect(page.getByLabel('Ollama URL')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '../.impeccable/review/settings.png', fullPage: true });
});


test('pairing validation identifies its field and a valid key links host details', async ({ page }) => {
  await page.goto('/?demo=remote');
  await expect(page.getByRole('button', { name: 'Check again', exact: true })).toBeEnabled();
  await page.locator('summary').filter({ hasText: 'Model allocation' }).click();
  await expect(page.getByText('No model is loaded on the server. GPU hardware and driver readiness have not been verified.')).toBeVisible();
  await page.getByRole('button', { name: 'Connection', exact: true }).click();
  await page.getByLabel('Server name').fill('');
  await page.getByRole('button', { name: 'Save & check' }).click();
  await expect(page.getByLabel('Server name')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Ollama URL')).toHaveAttribute('aria-invalid', 'false');
  await page.getByLabel('Server name').fill('Home server');
  await page.getByLabel('Host pairing key').fill('incomplete');
  await page.getByRole('button', { name: 'Save & check' }).click();
  await expect(page.getByLabel('Host pairing key')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Ollama URL')).toHaveAttribute('aria-invalid', 'false');
  await page.getByLabel('Host pairing key').fill('a'.repeat(64));
  await page.getByText('Custom host status port', { exact: true }).click();
  await page.getByLabel('Host status URL').fill('http://192.0.2.20:11435');
  await page.getByRole('button', { name: 'Save & check' }).click();
  await expect(page.getByLabel('Host status URL')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Ollama URL')).toHaveAttribute('aria-invalid', 'false');
  await page.getByLabel('Host status URL').fill('');
  await page.getByRole('button', { name: 'Save & check' }).click();
  await expect(page.getByText('Not linked', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Not linked', { exact: true })).toHaveCount(2);
});


test('firefly hours count bursts and keep empty hours idle', async ({ page }) => {
  await page.goto('/?demo=healthy');
  await expect(page.getByText('32 bursts', { exact: true })).toBeVisible();
  const hour = page.getByRole('slider', { name: 'Inspect an hour of GPU activity' });
  await hour.focus();
  await hour.press('Home');
  await expect(hour).toHaveAttribute('aria-valuetext', /Idle$/);
  await hour.press('ArrowRight');
  await hour.press('ArrowRight');
  await hour.press('ArrowRight');
  await hour.press('ArrowRight');
  await expect(hour).toHaveAttribute('aria-valuetext', /1 burst$/);
  await expect(page.locator('.hour-reading strong')).toHaveText('1 burst');
  await hour.press('ArrowRight');
  await expect(page.locator('.hour-reading strong')).toHaveText('2 bursts');
  await hour.press('End');
  await expect(page.locator('.hour-reading strong')).toHaveText('Idle');
  await page.goto('/?demo=remote');
  await expect(page.getByText('0 bursts', { exact: true })).toBeVisible();
  await expect(page.locator('.hour-reading strong')).toHaveText('Idle');
});


test('the activity window includes its oldest partial hour and rejects outside timestamps', async ({ page }) => {
  await page.goto('/?demo=healthy');
  const counts = await page.evaluate(async () => {
    const modulePath = '/src/GpuActivity.tsx';
    const { activityHours } = await import(/* @vite-ignore */ modulePath);
    const now = Date.parse('2026-10-12T20:30:00Z');
    const cutoff = now - 24 * 3600000;
    const hours = activityHours({ sampledAtMs: now, bursts: [cutoff - 1, cutoff, cutoff + 1, now, now + 1] }, now);
    return { total: hours.reduce((sum: number, hour: { count: number }) => sum + hour.count, 0), oldest: hours[0].count, current: hours.at(-1).count };
  });
  expect(counts).toEqual({ total: 3, oldest: 2, current: 1 });
});
