import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('desktop starts clean, toggles with Control and remembers the choice', async ({ page }) => {
  await page.goto('/?demo=healthy');
  const shell = page.locator('.app-shell');
  await expect(shell).toHaveAttribute('data-theme', 'clean');
  await page.keyboard.press('Control+Shift+K');
  await expect(shell).toHaveAttribute('data-theme', 'vines');
  await expect(page.locator('.vine-frame')).toBeVisible();
  await page.reload();
  await expect(shell).toHaveAttribute('data-theme', 'vines');
  await page.keyboard.press('Control+Shift+K');
  await expect(shell).toHaveAttribute('data-theme', 'clean');
  await expect(page.locator('.vine-frame')).toHaveCount(0);
  await page.reload();
  await expect(shell).toHaveAttribute('data-theme', 'clean');
});

test('the shortcut ignores other modifiers and held-key repeats', async ({ page }) => {
  await page.goto('/?demo=healthy');
  const shell = page.locator('.app-shell');
  await expect(shell).toHaveAttribute('data-theme', 'clean');
  await page.keyboard.press('Control+K');
  await page.keyboard.press('Meta+Shift+K');
  await page.keyboard.press('Control+Alt+Shift+K');
  await expect(shell).toHaveAttribute('data-theme', 'clean');
  await page.keyboard.down('Control');
  await page.keyboard.down('Shift');
  await page.keyboard.down('K');
  await expect(shell).toHaveAttribute('data-theme', 'vines');
  await page.keyboard.down('K');
  await expect(shell).toHaveAttribute('data-theme', 'vines');
  await page.keyboard.up('K');
  await page.keyboard.up('Shift');
  await page.keyboard.up('Control');
});

test('vines leave controls usable, respect reduced motion and fit narrow windows', async ({ page }) => {
  await page.goto('/?demo=healthy');
  await page.getByRole('heading', { name: 'Your server is within reach.' }).waitFor();
  await page.keyboard.press('Control+Shift+K');
  await expect(page.locator('.vine-frame')).toHaveCSS('animation-name', 'none');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Server name').fill('Still reachable');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeFocused();
  for (const width of [1120, 800, 600, 360]) {
    await page.setViewportSize({ width, height: 760 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(result.violations).toEqual([]);
});

test('Android keeps the clean appearance with an attached keyboard', async ({ browser }) => {
  const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36' });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem('shambu.window-theme', 'vines'));
  await page.goto('/?demo=healthy');
  await page.keyboard.press('Control+Shift+K');
  await expect(page.locator('.app-shell')).toHaveAttribute('data-theme', 'clean');
  await expect(page.locator('.vine-frame')).toHaveCount(0);
  await context.close();
});
