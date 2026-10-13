import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';

test('healthy screen exposes the external URL, GPU name, and installed models', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/?demo=healthy');
  await expect(page.getByRole('heading', { name: 'Your server is within reach.' })).toBeVisible();
  await expect(page.getByText('Design preview')).toBeVisible();
  await expect(page.locator('.endpoint')).toHaveText('http://192.0.2.10:11434');
  await page.getByRole('button', { name: 'Copy server URL', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('http://192.0.2.10:11434');
  await expect(page.getByText('NVIDIA Quadro RTX 8000', { exact: true })).toBeVisible();
  await expect(page.locator('.status-row summary')).toHaveCount(1);
  await page.locator('summary').filter({ hasText: 'Model library' }).click();
  await expect(page.getByRole('list', { name: 'Installed models' }).getByRole('listitem')).toHaveCount(3);
  await expect(page.getByText('example-chat:8b', { exact: true })).toBeVisible();
  await expect(page.getByText('4.9 GB', { exact: true })).toBeVisible();
  await expect(page.locator('.status-label').filter({ hasText: /^Active$/ })).toHaveCount(3);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.locator('.mascot, .wordmark, .sign-off')).toHaveCount(0);
  await page.getByRole('button', { name: 'Refresh status', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Checking server' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Refresh status', exact: true })).toBeEnabled();
});

test('unreachable API does not retain an all-clear headline', async ({ page }) => {
  await page.goto('/?demo=offline');
  await expect(page.getByRole('heading', { name: 'Something is out of reach.' })).toBeVisible();
  await expect(page.getByText('Unreachable', { exact: true })).toBeVisible();
  await expect(page.getByText('Check that Ollama is running and the port is correct.')).toBeVisible();
});

test('CPU allocation gets attention without changing the server', async ({ page }) => {
  await page.goto('/?demo=cpu');
  await expect(page.getByRole('heading', { name: 'A little attention needed.' })).toBeVisible();
  await expect(page.getByText('CPU detected', { exact: true })).toBeVisible();
});

test('remote settings reject localhost and persist a valid address', async ({ page }) => {
  await page.goto('/?demo=healthy');
  await expect(page.getByRole('button', { name: 'Refresh status', exact: true })).toBeEnabled();
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

test('refresh runs every two minutes and stale readings never stay green', async ({ page }) => {
  await page.clock.install();
  await page.goto('/?demo=healthy');
  await page.clock.runFor(1000);
  await expect(page.getByRole('heading', { name: 'Your server is within reach.' })).toBeVisible();
  await page.clock.runFor(70000);
  await expect(page.locator('.freshness')).toContainText('1m ago');
  await page.clock.runFor(50000);
  await expect(page.locator('.freshness')).toContainText('Just now');
  await page.getByRole('button', { name: 'Connection', exact: true }).click();
  await page.clock.runFor(160000);
  await expect(page.getByRole('heading', { name: 'Time for a fresh look.' })).toBeVisible();
  await expect(page.locator('.connection-status')).not.toHaveClass(/is-connected/);
  await page.getByRole('button', { name: 'Close connection settings' }).click();
  await page.clock.runFor(1000);
  await expect(page.locator('.freshness')).toContainText('Just now');
  await expect(page.locator('.connection-status')).toHaveClass(/is-connected/);
});

test('desktop and phone stay readable and accessible', async ({ page }) => {
  await mkdir('../.impeccable/review', { recursive: true });
  for (const [name, width, height, scenario] of [
    ['desktop', 1040, 728, 'healthy'], ['mobile', 390, 844, 'remote'], ['mobile-error', 390, 844, 'offline'],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/?demo=' + scenario);
    await expect(page.getByRole('button', { name: 'Refresh status', exact: true })).toBeEnabled();
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
  await expect(page.getByRole('button', { name: 'Refresh status', exact: true })).toBeEnabled();
  await expect(page.getByText('GPU details not linked', { exact: true })).toBeVisible();
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


test('a slim 24-hour strip exposes custom hover and keyboard hour readings', async ({ page }) => {
  await page.goto('/?demo=healthy');
  await expect(page.getByRole('heading', { name: 'Your server is within reach.' })).toBeVisible();
  await expect(page.locator('.hour-column')).toHaveCount(25);
  expect(await page.locator('.hour-active').count()).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: /^(24h|48h)$/ })).toHaveCount(0);
  await expect(page.locator('.activity-axis, .activity-key, .activity-explainer')).toHaveCount(0);
  await expect(page.getByRole('slider')).toHaveCount(0);
  const last = page.locator('.hour-column').last();
  await last.hover();
  await expect(page.getByRole('tooltip')).toHaveText(/\d+(?::\d+)?(?:am|pm) .+: Idle$/);
  await expect(last).toHaveClass(/hour-selected/);
  await expect(last).not.toHaveAttribute('title');
  const hoveredReading = await page.getByRole('tooltip').textContent();
  await last.click();
  await last.press('ArrowLeft');
  await expect(page.locator('.hour-column').nth(23)).toBeFocused();
  await expect(page.locator('.hour-column').nth(23)).toHaveClass(/hour-selected/);
  await expect(page.getByRole('tooltip')).not.toHaveText(hoveredReading!);
  await page.keyboard.press('Home');
  await expect(page.locator('.hour-column').first()).toBeFocused();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.goto('/?demo=remote');
  await expect(page.getByRole('heading', { name: 'Your server is within reach.' })).toBeVisible();
  await expect(page.locator('.hour-active')).toHaveCount(0);
  await expect(page.locator('.hour-column[aria-label$=": Idle"]')).toHaveCount(25);
});

test('activity buckets cover boundary hours without using legacy or future data', async ({ page }) => {
  await page.goto('/?demo=healthy');
  const result = await page.evaluate(async () => {
    const modulePath = '/src/GpuActivity.tsx';
    const { activityHours } = await import(/* @vite-ignore */ modulePath);
    const hour = 3600000;
    const now = Date.parse('2026-10-12T20:30:00Z');
    const current = Math.floor(now / hour) * hour;
    const history = { source: 'ollama-gpu-estimate', sampledAtMs: now, bursts: [], activeHours: [current - 49 * hour, current - 48 * hour, current - 24 * hour, current, current + hour] };
    const short = activityHours(history, now);
    const legacy = activityHours({ sampledAtMs: now, bursts: [current], activeHours: [current] }, now);
    return {
      shortActive: short.filter((item: { active: boolean }) => item.active).length,
      firstActive: short[0].active, lastActive: short.at(-1).active,
      legacyActive: legacy.some((item: { active: boolean }) => item.active),
    };
  });
  expect(result).toEqual({ shortActive: 2, firstActive: true, lastActive: true, legacyActive: false });
});
