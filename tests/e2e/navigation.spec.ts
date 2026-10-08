import { expect, test } from '@playwright/test';

test('real browser Home, level selection, Game return, Settings, Feedback and reload retain one saved attempt', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await page.getByRole('button', { name: 'Levels' }).first().click();
  await expect(page.getByRole('heading', { name: 'Levels' })).toBeVisible();
  await expect(page.locator('[data-level-id="level-001"]')).toBeEnabled();
  await page.locator('[data-level-id="level-001"]').click();
  await expect(page.getByRole('heading', { name: 'Game' })).toBeVisible();
  await page.getByRole('button', { name: 'Shop' }).click();
  await expect(page.locator('#page [role="status"]')).toContainText('Shop is available only when no attempt');
  await expect(page.getByRole('heading', { name: 'Game' })).toBeVisible();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.locator('[data-action="route-settings"]')).toBeFocused();
  const music = page.locator('[data-setting="musicEnabled"]');
  await expect(music).toBeChecked();
  await music.uncheck();
  await expect(music).not.toBeChecked();
  await page.getByRole('button', { name: 'Feedback' }).click();
  await expect(page.getByRole('link', { name: 'Send feedback by email' })).toHaveAttribute('href', 'mailto:qingchen6757@gmail.com');
  await page.getByRole('button', { name: 'Home' }).click();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.locator('[data-setting="musicEnabled"]')).not.toBeChecked();
});

test('explicit saved leave is required before Shop, with no automatic re-entry purchase', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Levels' }).first().click();
  await page.locator('[data-level-id="level-001"]').click();
  await page.getByRole('button', { name: 'Leave attempt to open Shop' }).click();
  await expect(page.locator('#shop')).toBeVisible();
  await expect(page.locator('#shop')).toContainText('Coins: 0');
  await page.getByRole('button', { name: 'Home' }).click();
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Continue' })).toHaveCount(0);
});

test('corrupt persisted pointer opens non-destructive Recovery and user-initiated Feedback', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('minepilot:persistence:head', '{corrupt'));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Recovery' })).toBeVisible();
  await expect(page.locator('[data-level-id]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Reload game' }).click();
  await expect(page.getByRole('heading', { name: 'Recovery' })).toBeVisible();
  await page.getByRole('button', { name: 'Feedback' }).first().click();
  await expect(page.getByRole('link', { name: 'Send feedback by email' })).toHaveAttribute('href', 'mailto:qingchen6757@gmail.com');
  expect(await page.evaluate(() => localStorage.getItem('minepilot:persistence:head'))).toBe('{corrupt');
});
