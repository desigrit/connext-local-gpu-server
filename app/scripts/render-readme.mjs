import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1120, height: 760 }, reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('shambu.window-theme', 'clean'));
  await page.goto('http://127.0.0.1:1420/?demo=healthy');
  await page.getByRole('heading', { name: 'Your server is within reach.' }).waitFor();
  await page.addStyleTag({ content: '.preview-notice { display: none; }' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: fileURLToPath(new URL('../../docs/previews/app.png', import.meta.url)) });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Pairing code').waitFor();
  await page.screenshot({ path: fileURLToPath(new URL('../../docs/previews/settings-pairing.png', import.meta.url)), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.screenshot({ path: fileURLToPath(new URL('../../docs/previews/app-mobile.png', import.meta.url)), fullPage: true });
  console.log('Captured desktop, pairing settings, and phone with synthetic data only.');
} finally { await browser.close(); }
