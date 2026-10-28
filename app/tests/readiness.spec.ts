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
  await expect(page.getByText('Nvidia Quadro RTX 8000', { exact: true })).toBeVisible();
  await expect(page.locator('.model-toggle')).toHaveCount(1);
  await page.getByRole('button', { name: /Model library/ }).click();
  await expect(page.getByRole('list', { name: 'Installed models' }).getByRole('listitem')).toHaveCount(3);
  await expect(page.getByText('Qwen 3 8B (4-bit quant)', { exact: true })).toBeVisible();
  await expect(page.getByText('4.9 GB', { exact: true })).toBeVisible();
  await expect(page.locator('.status-label').filter({ hasText: /^Active$/ })).toHaveCount(3);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.locator('.app-identity, .brand-header')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toHaveText('');
  await expect(page.getByRole('heading', { name: 'GPU usage', exact: true })).toBeVisible();
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
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Remote server', exact: true }).click();
  await page.getByLabel('Ollama URL').fill('http://localhost:11434');
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await expect(page.getByRole('alert')).toHaveText('Localhost means this device. Enter the address of your GPU PC.');
  await page.getByLabel('Ollama URL').fill('http://192.0.2.10:11434');
  await page.getByLabel('Server name').fill('Home server');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('http://192.0.2.10:11434', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Home server', exact: true })).toBeVisible();
  await expect(page.getByText('Tailscale on server', { exact: true })).toBeVisible();
  await expect(page.getByText('Not linked', { exact: true })).toHaveCount(2);
});

test('paired remote devices use the name saved on the GPU PC', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('shambu-demo-settings', JSON.stringify({
    mode: 'remote', endpoint: 'http://192.0.2.10:11434', name: 'Local alias', diagnosticsKey: 'a'.repeat(64), diagnosticsUrl: '',
  })));
  await page.goto('/?demo=remote');
  await expect(page.getByRole('heading', { name: 'The Jungle PC', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Local alias', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Server name')).toHaveValue('The Jungle PC');
  await expect(page.getByLabel('Server name')).toHaveAttribute('readonly', '');
  await page.getByLabel('Ollama URL').fill('http://192.0.2.11:11434');
  await expect(page.getByLabel('Server name')).toHaveValue('Local alias');
  await expect(page.getByLabel('Server name')).toBeEditable();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'The Jungle PC', exact: true })).toBeVisible();
});

test('refresh runs every five minutes and stale readings never stay green', async ({ page }) => {
  await page.clock.install();
  await page.goto('/?demo=healthy');
  await page.clock.runFor(2500);
  await expect(page.getByRole('heading', { name: 'Your server is within reach.' })).toBeVisible();
  await page.clock.runFor(110000);
  await expect(page.locator('.freshness')).toContainText('Just now');
  await page.clock.runFor(20000);
  await expect(page.locator('.freshness')).toContainText('2 minutes ago');
  await page.clock.runFor(60000);
  await expect(page.locator('.freshness')).toContainText('3 minutes ago');
  await page.clock.runFor(110000);
  await expect(page.locator('.freshness')).toContainText('Just now');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.clock.runFor(340000);
  await expect(page.getByRole('heading', { name: 'Time for a fresh look.' })).toBeVisible();
  await expect(page.locator('.connection-status')).not.toHaveClass(/is-connected/);
  await expect(page.getByText('These readings are out of date.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Refresh status', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.clock.runFor(2500);
  await expect(page.locator('.freshness')).toContainText('Just now');
  await expect(page.locator('.connection-status')).toHaveClass(/is-connected/);
});

test('desktop and phone stay readable and accessible', async ({ page }) => {
  await mkdir('../.impeccable/review', { recursive: true });
  for (const [name, width, height, scenario] of [
    ['desktop', 1120, 728, 'healthy'], ['mobile', 390, 844, 'remote'], ['mobile-error', 390, 844, 'offline'],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/?demo=' + scenario);
    await expect(page.getByRole('button', { name: 'Refresh status', exact: true })).toBeEnabled();
    await expect(page.getByRole('heading', { name: scenario === 'offline' ? 'Something is out of reach.' : scenario === 'remote' ? 'A little attention needed.' : 'Your server is within reach.' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Server readiness checks' })).toHaveAttribute('aria-busy', 'false');
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(result.violations).toEqual([]);
    await page.screenshot({ path: '../.impeccable/review/' + name + '.png', fullPage: true });
  }
  await page.setViewportSize({ width: 320, height: 740 });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Ollama URL')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '../.impeccable/review/settings.png', fullPage: true });
});


test('pairing validation identifies its field and a valid key links host details', async ({ page }) => {
  await page.goto('/?demo=remote');
  await expect(page.getByRole('button', { name: 'Refresh status', exact: true })).toBeEnabled();
  await expect(page.getByText('Details not linked', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Server name').fill('');
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Server name')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Ollama URL')).toHaveAttribute('aria-invalid', 'false');
  await page.getByLabel('Server name').fill('Home server');
  await page.getByLabel('Pairing code').fill('incomplete');
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Pairing code')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Ollama URL')).toHaveAttribute('aria-invalid', 'false');
  await page.getByLabel('Pairing code').fill('SHAMBU42');
  await page.getByText('Custom host status port', { exact: true }).click();
  await page.getByLabel('Host status URL').fill('http://192.0.2.20:11435');
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Host status URL')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Ollama URL')).toHaveAttribute('aria-invalid', 'false');
  await page.getByLabel('Host status URL').fill('');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Not linked', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Not linked', { exact: true })).toHaveCount(2);
});


test('a slim 48-hour strip exposes custom hover and keyboard hour readings', async ({ page }) => {
  await page.goto('/?demo=healthy');
  await expect(page.getByRole('heading', { name: 'Your server is within reach.' })).toBeVisible();
  await expect(page.locator('.hour-column')).toHaveCount(49);
  expect(await page.locator('.hour-active').count()).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: /^(24h|48h)$/ })).toHaveCount(0);
  await expect(page.locator('.activity-key, .activity-explainer')).toHaveCount(0);
  await expect(page.locator('.activity-times')).toHaveText('48h24hNow');
  await expect(page.getByRole('slider')).toHaveCount(0);
  const last = page.locator('.hour-column').last();
  await last.hover();
  await expect(page.getByRole('tooltip')).toHaveText(/^\d+(?::\d+)? (?:AM|PM) · Idle$/);
  await expect(last).toHaveClass(/hour-selected/);
  await expect(last).not.toHaveAttribute('title');
  const hoveredReading = await page.getByRole('tooltip').textContent();
  await last.click();
  await last.press('ArrowLeft');
  await expect(page.locator('.hour-column').nth(47)).toBeFocused();
  await expect(page.locator('.hour-column').nth(47)).toHaveClass(/hour-selected/);
  await expect(page.getByRole('tooltip')).not.toHaveText(hoveredReading!);
  await page.keyboard.press('Home');
  await expect(page.locator('.hour-column').first()).toBeFocused();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.goto('/?demo=remote');
  await expect(page.getByRole('heading', { name: 'A little attention needed.' })).toBeVisible();
  await expect(page.locator('.hour-active')).toHaveCount(0);
  await expect(page.locator('.hour-column[aria-label$=": Idle"]')).toHaveCount(49);
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
  expect(result).toEqual({ shortActive: 3, firstActive: true, lastActive: true, legacyActive: false });
});


test('brand launch links are explicit and recovery previews return to healthy', async ({ page }) => {
  await page.goto('/?demo=tailscale');
  await expect(page.getByRole('heading', { name: 'A little attention needed.' })).toBeVisible();
  await expect(page.locator('.state-warning .state-dot')).toHaveCount(1);
  await expect(page.locator('.connection-status')).toHaveText('Connection issue');
  await expect(page.locator('.connection-status')).not.toHaveClass(/is-connected/);
  await expect(page.getByRole('button', { name: 'Open Tailscale on this device' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Ollama on this device' })).toBeVisible();
  expect(await page.locator<HTMLImageElement>('.brand-icon').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
  await page.getByRole('button', { name: 'Simulate recovery' }).click();
  await expect(page.getByRole('heading', { name: 'Your server is within reach.' })).toBeVisible();
  await expect(page.locator('.status-label').filter({ hasText: /^Active$/ })).toHaveCount(3);
  await expect(page.locator('.freshness')).toContainText('Just now');
  await page.getByRole('button', { name: /Model library/ }).click();
  await expect(page.getByRole('img', { name: 'Qwen', exact: true })).toHaveCount(2);
});

test('hour tooltips use the device timezone without displaying its name', async ({ browser }) => {
  const context = await browser.newContext({ timezoneId: 'Asia/Kolkata' });
  const page = await context.newPage();
  await page.clock.install({ time: new Date('2026-10-13T04:30:00Z') });
  await page.goto('/?demo=healthy');
  await page.clock.runFor(2500);
  await page.locator('.hour-column').last().hover();
  await expect(page.getByRole('tooltip')).toHaveText('9:30 AM · Idle');
  await context.close();
});

test('cancel discards connection edits while save persists them', async ({ page }) => {
  await page.goto('/?demo=healthy');
  await expect(page.getByRole('button', { name: 'Refresh status', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Server name').fill('Unsaved name');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Settings', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Server name')).toHaveValue('My GPU server');
  await page.getByLabel('Server name').fill('Saved name');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Saved name', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Saved name', exact: true })).toBeVisible();
});


test('refresh keeps the previous reading for at least two seconds', async ({ page }) => {
  await page.clock.install();
  await page.goto('/?demo=tailscale');
  await page.clock.runFor(2500);
  await expect(page.locator('.connection-status')).toHaveText('Connection issue');
  await page.getByRole('button', { name: 'Simulate recovery' }).click();
  await page.clock.runFor(1900);
  await expect(page.getByRole('button', { name: 'Checking server' })).toBeDisabled();
  await expect(page.locator('.connection-status')).toHaveText('Connection issue');
  await page.clock.runFor(200);
  await expect(page.locator('.connection-status')).toHaveText('Connected');
});

test('launch feedback is transient and row help waits two seconds', async ({ page }) => {
  await page.clock.install();
  await page.goto('/?demo=healthy');
  await page.clock.runFor(2500);
  await page.getByRole('button', { name: 'Open Ollama on this device' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Opening Ollama' })).toBeVisible();
  await page.clock.runFor(5000);
  await expect(page.getByText('Opening Ollama. Check the system tray.')).toHaveCount(0);
  await page.getByText('Forwarding', { exact: true }).hover();
  await page.clock.runFor(1800);
  await expect(page.locator('.row-tooltip')).toHaveCount(0);
  await page.clock.runFor(300);
  await expect(page.locator('.row-tooltip')).toContainText('private route');
  await page.keyboard.press('Escape');
  await page.mouse.move(0, 0);
  await expect(page.locator('.row-tooltip')).toHaveCount(0);
});

test('host pairing is visible and copyable without showing the stored credential', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/?demo=healthy');
  await expect(page.getByRole('heading', { name: 'Your server is within reach.' })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Pairing code')).toHaveText('SHAM BU42');
  await page.getByRole('button', { name: 'Copy code', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('SHAMBU42');
  await expect(page.getByRole('button', { name: 'Copied', exact: true })).toBeVisible();
  expect(await page.locator('.connection-panel').innerText()).not.toContain('a'.repeat(64));
});

test('missing local apps offer install actions without pretending the remote app is installed', async ({ page }) => {
  await page.goto('/?demo=missing');
  await expect(page.getByRole('button', { name: 'Install Ollama', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Install Tailscale', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Remote server', exact: true }).click();
  await page.getByLabel('Ollama URL').fill('http://192.0.2.10:11434');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Install Ollama', exact: true })).toHaveCount(0);
});
