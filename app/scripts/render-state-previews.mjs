import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const destination = new URL('../../docs/previews/', import.meta.url);
await mkdir(destination, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1120, height: 760 }, timezoneId: 'America/Los_Angeles', reducedMotion: 'reduce' });
try {
  const page = await context.newPage();
  const cases = ['healthy', 'offline', 'tailscale', 'forwarding', 'pairing', 'companion', 'cpu', 'empty', 'stale', 'remote'];
  for (const scenario of cases) {
    await page.goto('http://127.0.0.1:1420/?demo=' + scenario);
    await page.getByRole('button', { name: 'Refresh status', exact: true }).waitFor();
    await page.locator('.status-row.state-ok, .status-row.state-error, .status-row.state-warning').first().waitFor();
    await page.locator('.checklist[aria-busy="false"]').waitFor();
    await page.getByText('Design preview', { exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: fileURLToPath(new URL(scenario + '.png', destination)), fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const scenario of ['offline', 'pairing']) {
    await page.goto('http://127.0.0.1:1420/?demo=' + scenario);
    await page.getByRole('button', { name: 'Refresh status', exact: true }).waitFor();
    await page.locator('.status-row.state-ok, .status-row.state-error, .status-row.state-warning').first().waitFor();
    await page.locator('.checklist[aria-busy="false"]').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: fileURLToPath(new URL('mobile-' + scenario + '.png', destination)), fullPage: true });
  }
  console.log('Captured 10 desktop and 2 phone state previews using synthetic data only.');
} finally { await context.close(); await browser.close(); }
