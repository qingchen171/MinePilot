import { expect, test } from '@playwright/test';
import { boardBrowserSave } from '../helpers/s5-06-browser-save';

async function revision(page: import('@playwright/test').Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('minepilot:persistence:head') ?? 'null').revision as number);
}

test('G2 real desktop: catalog coin Reward → committed leave → Shop → new Attempt → F5', async ({ page }) => {
  const fixture = boardBrowserSave('coin-reward');
  if (fixture.rewardTarget === null) throw new Error('catalog coin target');
  await page.addInitScript((entries: [string, string][]) => {
    if (sessionStorage.getItem('s5-09-coin-installed') === 'yes') return;
    for (const [key, value] of entries) localStorage.setItem(key, value);
    sessionStorage.setItem('s5-09-coin-installed', 'yes');
  }, fixture.entries);
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue' }).click();
  const initial = await revision(page);
  expect(initial).toBe(4);
  await page.locator(`[data-cell-index="${fixture.rewardTarget.y * 9 + fixture.rewardTarget.x}"]`).click();
  expect(await revision(page)).toBe(initial + 1);
  await expect(page.getByRole('heading', { name: 'Reward saved' })).toBeVisible();
  await expect(page.locator('#page')).toContainText('level-001');

  await page.getByRole('button', { name: 'Leave attempt to open Shop' }).click();
  expect(await revision(page)).toBe(initial + 2);
  await expect(page.locator('#shop')).toContainText('Coins: 1');
  await expect(page.getByRole('button', { name: 'Continue' })).toHaveCount(0);

  await page.locator('button[data-shop-item="lucky"]').click();
  expect(await revision(page)).toBe(initial + 3);
  await expect(page.locator('#shop')).toContainText('Coins: 0');
  await expect(page.locator('#shop')).toContainText('Purchase saved.');
  await page.getByRole('button', { name: 'Levels' }).click();
  await page.locator('[data-level-id="level-001"]').click();
  expect(await revision(page)).toBe(initial + 4);
  await expect(page.getByRole('heading', { name: 'Game' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
  expect(await revision(page)).toBe(initial + 4);
  await expect(page.locator('.board-hit-cell')).toHaveCount(81);
  await expect(page.getByRole('heading', { name: 'Reward saved' })).toHaveCount(0);
});
