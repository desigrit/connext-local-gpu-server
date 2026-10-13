import { test, expect, type Page } from '@playwright/test';

async function toggleAndWatch(page: Page, trigger: string, below: string) {
  return page.evaluate(({ trigger, below }) => new Promise<{ header: number; below: number }[]>(resolve => {
    const frames: { header: number; below: number }[] = [];
    const record = () => frames.push({
      header: document.querySelector('.app-header')!.getBoundingClientRect().top,
      below: document.querySelector(below)!.getBoundingClientRect().top,
    });
    record();
    document.querySelector<HTMLButtonElement>(trigger)!.click();
    const started = performance.now();
    const frame = () => {
      record();
      if (performance.now() - started < 450) requestAnimationFrame(frame);
      else resolve(frames);
    };
    requestAnimationFrame(frame);
  }), { trigger, below });
}

for (const width of [1120, 390]) {
  test(`disclosures grow downward without moving the header at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/?demo=healthy');
    await expect(page.getByRole('heading', { name: 'Your server is within reach.' })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    for (const [trigger, below] of [['.model-toggle', '.activity-strip'], ['.connection-button', '.server-strip']]) {
      const frames = await toggleAndWatch(page, trigger, below);
      expect(Math.max(...frames.map(frame => frame.header)) - Math.min(...frames.map(frame => frame.header))).toBeLessThan(1);
      expect(frames.at(-1)!.below - frames[0].below).toBeGreaterThan(60);
      expect(new Set(frames.map(frame => Math.round(frame.below))).size).toBeGreaterThan(4);
      await expect(page.locator(trigger)).toHaveAttribute('aria-expanded', 'true');

      const closing = await toggleAndWatch(page, trigger, below);
      expect(Math.max(...closing.map(frame => frame.header)) - Math.min(...closing.map(frame => frame.header))).toBeLessThan(1);
      expect(closing.at(-1)!.below).toBeCloseTo(frames[0].below, 0);
      await expect(page.locator(trigger)).toHaveAttribute('aria-expanded', 'false');
    }
    await expect(page.getByLabel('Ollama URL')).toHaveCount(0);
  });
}

test('rapid reversals settle on the latest state and closed Settings cannot receive focus', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/?demo=healthy');
  await expect(page.getByRole('heading', { name: 'Your server is within reach.' })).toBeVisible();
  await page.evaluate(async () => {
    const button = document.querySelector<HTMLButtonElement>('.connection-button')!;
    button.click();
    await new Promise(resolve => setTimeout(resolve, 70));
    button.click();
    await new Promise(resolve => setTimeout(resolve, 70));
    button.click();
  });
  await expect(page.getByLabel('Ollama URL')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('#connection-settings')).toHaveAttribute('inert', '');
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeFocused();
  await expect(page.getByLabel('Ollama URL')).toHaveCount(0);
});

test('reduced motion keeps both disclosures usable without a spatial transition', async ({ page }) => {
  await page.goto('/?demo=healthy');
  await expect(page.getByRole('heading', { name: 'Your server is within reach.' })).toBeVisible();
  await page.getByRole('button', { name: /Model library/ }).click();
  await expect(page.getByRole('list', { name: 'Installed models' })).toBeVisible();
  await expect(page.locator('.status-row .reveal-panel')).toHaveCSS('transition-duration', '0s');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Ollama URL')).toBeFocused();
  await expect(page.locator('#connection-settings')).toHaveCSS('transition-duration', '0s');
});
