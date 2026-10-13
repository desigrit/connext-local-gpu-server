
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const destination = new URL('../../docs/previews/', import.meta.url);
const output = name => fileURLToPath(new URL(name, destination));
await mkdir(fileURLToPath(destination), { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1120, height: 850 }, timezoneId: 'America/Los_Angeles', reducedMotion: 'reduce' });
try {
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:1420/?bars=compare');
  await page.getByRole('heading', { name: '6 · Hour clusters' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: output('gpu-bar-options.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: output('gpu-bar-options-mobile.png'), fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (overflow) throw new Error('Bar comparison overflows the phone viewport.');
  await page.setViewportSize({ width: 1120, height: 760 });
  await page.goto('http://127.0.0.1:1420/?demo=healthy');
  await page.getByRole('heading', { name: 'Your server is within reach.' }).waitFor();
  await page.screenshot({ path: output('bar-header-restored.png'), fullPage: true });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).waitFor();
  await page.screenshot({ path: output('settings-cancel-save.png'), fullPage: true });
  console.log('Captured six bar directions and the restored header/settings with synthetic data.');
} finally { await context.close(); await browser.close(); }
