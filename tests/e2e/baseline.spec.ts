import { expect, test } from '@playwright/test';

test('Phaser initializes in a real browser', async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));

  await page.goto('/');

  await expect(page).toHaveTitle('MinePilot Engineering Baseline');
  await expect(page.locator('html')).toHaveAttribute('data-phaser-ready', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-phaser-version', '3.90.0');
  await expect(page.getByRole('status')).toHaveText('Phaser 3 engineering baseline ready');
  await expect(page.locator('#game canvas')).toHaveCount(1);
  expect(pageErrors).toEqual([]);
});
