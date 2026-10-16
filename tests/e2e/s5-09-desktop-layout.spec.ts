import { expect, test, type Page } from '@playwright/test';
import { boardBrowserSave } from '../helpers/s5-06-browser-save';

const viewports = [{ width: 1280, height: 720 }, { width: 1024, height: 768 }] as const;

async function checkPage(page: Page, name: string, board = false) {
  const failures = await page.evaluate(() => {
    const issues: string[] = [];
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
      issues.push(`horizontal overflow ${document.documentElement.scrollWidth}/${document.documentElement.clientWidth}`);
    const controls = document.querySelectorAll<HTMLElement>(
      '#navigation button, #page button, #page input, #page a[href], #game-controls button, #shop button');
    for (const control of controls) {
      if (control.getClientRects().length === 0) continue;
      control.scrollIntoView({ block: 'center', inline: 'nearest' });
      const rect = control.getBoundingClientRect();
      const label = control.getAttribute('data-action') ?? control.getAttribute('data-game-action') ??
        control.getAttribute('data-shop-item') ?? control.textContent?.trim() ?? control.tagName;
      if (rect.width <= 0 || rect.height <= 0 || rect.left < -1 || rect.right > innerWidth + 1 ||
          rect.top < -1 || rect.bottom > innerHeight + 1) issues.push(`clipped ${label}`);
      else {
        const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        if (top !== control && !control.contains(top)) issues.push(`obscured ${label}`);
      }
    }
    return issues;
  });
  expect(failures, name).toEqual([]);
  if (!board) return;
  for (const index of [0, 4, 40, 76, 80]) {
    const cell = page.locator(`[data-cell-index="${index}"]`);
    await cell.evaluate((node) => node.scrollIntoView({ block: 'center', inline: 'nearest' }));
    const canvas = await page.locator('#game-stage canvas').boundingBox();
    expect(canvas, `${name} canvas`).not.toBeNull();
    const rect = await cell.boundingBox();
    expect(rect, `${name} cell ${index}`).not.toBeNull();
    expect(rect!.x).toBeGreaterThanOrEqual(canvas!.x - 1);
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(canvas!.x + canvas!.width + 1);
    expect(rect!.y).toBeGreaterThanOrEqual(canvas!.y - 1);
    expect(rect!.y + rect!.height).toBeLessThanOrEqual(canvas!.y + canvas!.height + 1);
    const hit = await cell.evaluate((node) => {
      const bounds = node.getBoundingClientRect();
      return document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
        ?.getAttribute('data-cell-index');
    });
    expect(hit, `${name} hit coordinate ${index}`).toBe(String(index));
  }
}

async function fixture(page: Page, variant: 'pending' | 'failed' | 'won') {
  const values = boardBrowserSave(variant).entries;
  await page.addInitScript((entries: [string, string][]) => {
    for (const [key, value] of entries) localStorage.setItem(key, value);
  }, values);
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue' }).click();
}

for (const viewport of viewports) {
  test(`G8 ${viewport.width}x${viewport.height}: Home, Levels, Shop, Settings, Feedback and active Game`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await checkPage(page, 'Home');
    await page.getByRole('button', { name: 'Home' }).focus();
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => {
      const active = document.activeElement;
      const style = active === null ? null : getComputedStyle(active);
      return { visible: active?.matches(':focus-visible'), outline: style?.outlineStyle,
        width: style?.outlineWidth, shadow: style?.boxShadow };
    });
    expect(focus.visible).toBe(true);
    expect((focus.outline !== 'none' && focus.width !== '0px') ||
      (focus.shadow !== undefined && focus.shadow !== 'none')).toBe(true);
    await page.getByRole('button', { name: 'Levels' }).first().click();
    await checkPage(page, 'Levels');
    await page.getByRole('button', { name: 'Shop' }).click();
    await checkPage(page, 'Shop');
    await page.getByRole('button', { name: 'Settings' }).click();
    await checkPage(page, 'Settings');
    await page.getByRole('button', { name: 'Feedback' }).click();
    await checkPage(page, 'Feedback');
    await page.getByRole('button', { name: 'Levels' }).click();
    await page.locator('[data-level-id="level-001"]').click();
    await checkPage(page, 'active Game', true);
  });

  for (const variant of ['pending', 'failed', 'won'] as const) {
    test(`G8 ${viewport.width}x${viewport.height}: validated v4 ${variant} controls`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await fixture(page, variant);
      await expect(page.getByRole('heading', { name: 'Game' })).toBeVisible();
      await checkPage(page, `${variant} Game`, true);
    });
  }

  test(`G8 ${viewport.width}x${viewport.height}: non-destructive Recovery and Feedback`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => localStorage.setItem('minepilot:persistence:head', '{corrupt'));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Recovery' })).toBeVisible();
    await checkPage(page, 'Recovery');
    await page.getByRole('button', { name: 'Feedback' }).first().click();
    await checkPage(page, 'Recovery Feedback');
  });
}
