import { expect, test } from '@playwright/test';
import { boardBrowserSave } from '../helpers/s5-06-browser-save';

async function revision(page: import('@playwright/test').Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('minepilot:persistence:head') ?? 'null').revision as number);
}
async function start(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Levels' }).first().click();
  await page.locator('[data-level-id="level-001"]').click();
  await expect(page.getByRole('heading', { name: 'Game' })).toBeVisible();
}

test('actual Game: tutorial ack is explicit, Airplane uses selected DOM target, Save v4 reopens usage', async ({ page }) => {
  await start(page);
  await expect(page.locator('.game-detail')).toContainText('Items');
  const airplane = page.locator('[data-game-action="airplane"]');
  await expect(airplane).toBeDisabled();
  const before = await revision(page);
  await page.locator('[data-cell-index="0"]').focus();
  await expect(airplane).toBeEnabled();
  await airplane.click();
  expect(await revision(page)).toBe(before + 1);
  await expect(page.locator('[data-game-action="airplane"]')).toBeDisabled();
  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('.game-detail')).toContainText('Uses remaining: 0');
  const ack = page.locator('[data-game-action="acknowledge-tutorial"]');
  await expect(ack).toBeVisible();
  const beforeAck = await revision(page);
  await ack.click();
  expect(await revision(page)).toBe(beforeAck + 1);
  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('[data-game-action="acknowledge-tutorial"]')).not.toHaveAttribute('data-milestone-id', 'l1-movement-current-number');
});

test('actual pending and failed controls never resolve before a committed action', async ({ page }) => {
  const fixture = boardBrowserSave('pending');
  await page.addInitScript((entries: [string, string][]) => {
    localStorage.clear(); for (const [key, value] of entries) localStorage.setItem(key, value);
  }, fixture.entries);
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('[data-game-action="failure"]')).toBeVisible();
  await expect(page.locator('[data-game-action="detection"]')).toHaveCount(0);
  const before = await revision(page);
  await page.locator('[data-game-action="failure"]').click();
  expect(await revision(page)).toBe(before + 1);
  await expect(page.locator('[data-game-action="retry"]')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('[data-game-action="retry"]')).toBeVisible();
});

test('account-only Shop offers the persisted first-shop tutorial without buying', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Shop' }).first().click();
  await expect(page.locator('[data-action="tutorial-first-shop"]')).toBeVisible();
  await expect(page.locator('#shop')).toContainText('The Shop exchanges coins');
  await page.locator('[data-action="tutorial-first-shop"]').click();
  expect(await revision(page)).toBe(0);
  await page.reload();
  await page.getByRole('button', { name: 'Shop' }).first().click();
  await expect(page.locator('[data-action="tutorial-first-shop"]')).toHaveCount(0);
});
