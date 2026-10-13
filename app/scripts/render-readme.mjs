import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1300, height: 840 }, reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('shambu.window-theme', 'clean'));
  await page.goto('http://127.0.0.1:1420/?demo=healthy');
  await page.getByRole('heading', { name: 'Your server is within reach.' }).waitFor();
  await page.addStyleTag({ content: '.preview-notice { display: none; }' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: fileURLToPath(new URL('../../docs/previews/app.png', import.meta.url)) });
  console.log('Captured the main app screen for the README.');
} finally { await browser.close(); }
