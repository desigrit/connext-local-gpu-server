import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('version is at the bottom and an up-to-date app stays quiet', async ({ page }) => {
  await page.setViewportSize({ width: 1120, height: 760 });
  await page.goto('/?demo=healthy');
  const footer = page.getByRole('contentinfo', { name: 'App version and updates' });
  await expect(footer).toContainText('v1.0.4');
  await expect(footer.getByRole('button')).toHaveCount(0);
  const version = await page.locator('.app-version').boundingBox();
  expect(version!.x).toBeLessThan(30);
  expect(version!.y).toBeGreaterThan(700);
});

test('update becomes real download progress, then a user-controlled restart', async ({ page }) => {
  await page.goto('/?demo=healthy&update=available');
  await page.getByRole('button', { name: 'Update to 1.1.0' }).click();
  const progress = page.getByRole('progressbar', { name: 'Downloading update' });
  await expect(progress).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restart to update to 1.1.0' })).toHaveCount(0);
  await expect(progress).toHaveAttribute('aria-valuetext', 'Verifying update');
  await expect(page.getByRole('button', { name: 'Restart to update to 1.1.0' })).toBeVisible();
  await expect(page.locator('html')).not.toHaveAttribute('data-preview-update-installed');
  await page.getByRole('button', { name: 'Restart to update to 1.1.0' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-preview-update-installed', 'true');
});

test('interrupted downloads can be retried without changing server readiness', async ({ page }) => {
  await page.goto('/?demo=healthy&update=download-error');
  await page.getByRole('button', { name: 'Update to 1.1.0' }).click();
  await expect(page.getByRole('alert')).toHaveText('Download interrupted. Check your connection and retry.');
  await expect(page.getByRole('heading', { name: 'Your server is within reach.' })).toBeVisible();
  await page.getByRole('button', { name: 'Retry to 1.1.0' }).click();
  await expect(page.getByRole('button', { name: 'Restart to update to 1.1.0' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('install failures keep the verified download ready to retry', async ({ page }) => {
  await page.goto('/?demo=healthy&update=install-error');
  await page.getByRole('button', { name: 'Update to 1.1.0' }).click();
  const restart = page.getByRole('button', { name: 'Restart to update to 1.1.0' });
  await restart.click();
  await expect(page.getByRole('alert')).toContainText('Could not install the update.');
  await expect(restart).toBeEnabled();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
});

test('unknown download sizes stay indeterminate until verification finishes', async ({ page }) => {
  await page.goto('/?demo=healthy&update=unknown-size');
  await page.getByRole('button', { name: 'Update to 1.1.0' }).click();
  await expect(page.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
  await expect(page.getByRole('button', { name: 'Restart to update to 1.1.0' })).toBeVisible();
});

test('Android shows its version without update controls, even when a newer release exists', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 720 }, userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36' });
  const page = await context.newPage();
  await page.goto('/?demo=healthy&update=available');
  const footer = page.getByRole('contentinfo', { name: 'App version and updates' });
  await expect(footer).toContainText('v1.0.4');
  await expect(footer.getByRole('button')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(audit.violations).toEqual([]);
  await context.close();
});

test('arrow cursor covers controls, links, text and editable fields', async ({ page }) => {
  await page.goto('/?demo=healthy&update=available');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  for (const selector of ['h1', '.endpoint', '#server-name', '#server-url', '.update-pill', '.connection-button', 'summary', '.row-launch']) {
    const target = page.locator(selector).first();
    if (await target.count()) await expect(target).toHaveCSS('cursor', 'default');
  }
  await page.getByLabel('Server name').fill('Still editable');
  await expect(page.getByLabel('Server name')).toHaveValue('Still editable');
});
