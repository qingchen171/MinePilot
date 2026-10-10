import { expect, test } from '@playwright/test';
import { boardBrowserSave } from '../helpers/s5-06-browser-save';

async function revision(page: import('@playwright/test').Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('minepilot:persistence:head') ?? 'null').revision as number);
}
async function installFixture(page: import('@playwright/test').Page, entries: [string, string][]) {
  await page.addInitScript((snapshot: [string, string][]) => {
    if (sessionStorage.getItem('s5-07-fixture-installed') === 'yes') return;
    localStorage.clear();
    for (const [key, value] of snapshot) localStorage.setItem(key, value);
    sessionStorage.setItem('s5-07-fixture-installed', 'yes');
  }, entries);
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
  await page.getByRole('button', { name: 'Home' }).first().focus();
  await expect(airplane).toBeDisabled();
  await page.locator('[data-cell-index="0"]').focus();
  await expect(airplane).toBeEnabled();
  await airplane.click();
  expect(await revision(page)).toBe(before + 1);
  await expect(page.locator('[data-game-action="airplane"]')).toBeDisabled();
  await expect(page.locator('.game-detail')).toContainText('Uses remaining: 0');
  const ack = page.locator('[data-game-action="acknowledge-tutorial"]');
  await expect(ack).toBeVisible();
  const beforeAck = await revision(page);
  await ack.click();
  expect(await revision(page)).toBe(beforeAck + 1);
  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('.game-detail')).toContainText('Uses remaining: 0');
  await expect(page.locator('[data-game-action="acknowledge-tutorial"]')).not.toHaveAttribute('data-milestone-id', 'l1-movement-current-number');
});

test('actual pending and failed controls never resolve before a committed action', async ({ page }) => {
  const fixture = boardBrowserSave('pending');
  await installFixture(page, fixture.entries);
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

test('Benben claim is a separate guarded action and the temporary card survives F5', async ({ page }) => {
  const fixture = boardBrowserSave('benben-available');
  await installFixture(page, fixture.entries);
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('[data-game-action="claim-benben"]')).toBeEnabled();
  const before = await revision(page);
  await page.locator('[data-game-action="defer-benben"]').click();
  expect(await revision(page)).toBe(before);
  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.locator('[data-game-action="claim-benben"]').click();
  expect(await revision(page)).toBe(before + 1);
  await expect(page.locator('.game-detail')).toContainText('Temporary item');
  await expect(page.locator('[data-game-action="claim-benben"]')).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('.game-detail')).toContainText('Temporary item');
});

test('committed win offers Replay/Dismiss but not unavailable Next in the one-level catalog', async ({ page }) => {
  const fixture = boardBrowserSave('won');
  await installFixture(page, fixture.entries);
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('[data-game-action="replay"]')).toBeVisible();
  await expect(page.locator('[data-game-action="next"]')).toHaveCount(0);
  await expect(page.locator('[data-game-action="dismiss"]')).toBeVisible();
  await expect(page.locator('[data-game-action="detection"]')).toHaveCount(0);
  const before = await revision(page);
  await page.locator('[data-game-action="dismiss"]').click();
  expect(await revision(page)).toBe(before + 1);
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
});

test('Detection native double-click commits once, then a distinct keyboard activation remains legal', async ({ page }) => {
  const fixture = boardBrowserSave('detection-rich');
  await installFixture(page, fixture.entries);
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue' }).click();
  const before = await revision(page);
  await page.locator('[data-game-action="detection"]').click({ clickCount: 2 });
  expect(await revision(page)).toBe(before + 1);
  await expect(page.locator('.game-detail')).toContainText('Uses remaining: 1');
  await page.locator('[data-game-action="detection"]').focus();
  await page.locator('[data-game-action="detection"]').press('Enter');
  expect(await revision(page)).toBe(before + 2);
  await expect(page.locator('.game-detail')).toContainText('Uses remaining: 0');
});

test('real first Mine auto-Lucky then later pending Revive survives browser reload', async ({ page }) => {
  const fixture = boardBrowserSave('waiting');
  expect(fixture.anotherMine).not.toBeNull();
  await installFixture(page, fixture.entries);
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue' }).click();
  const firstIndex = fixture.mine.y * 9 + fixture.mine.x;
  const secondIndex = fixture.anotherMine!.y * 9 + fixture.anotherMine!.x;
  const before = await revision(page);
  await page.locator(`[data-cell-index="${firstIndex}"]`).click();
  expect(await revision(page)).toBe(before + 1);
  await expect(page.locator('.board-position')).toContainText('revealed mine');
  await expect(page.locator('.game-detail')).toContainText('Lucky saved this step');
  await expect(page.locator('[data-game-action="revive"]')).toHaveCount(0);
  await page.locator(`[data-cell-index="${secondIndex}"]`).click();
  await expect(page.locator('[data-game-action="revive"]')).toBeEnabled();
  await page.locator('[data-game-action="revive"]').click();
  await expect(page.locator('.board-position')).toContainText('revealed mine');
  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('.board-position')).toContainText('revealed mine');
  await expect(page.locator('.game-detail')).toContainText('Uses remaining: 0');
});

test('one committed Reward receipt appears once; F5 restores claimed assets without replaying the receipt', async ({ page }) => {
  const fixture = boardBrowserSave('waiting');
  expect(fixture.rewardTarget).not.toBeNull();
  await installFixture(page, fixture.entries);
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue' }).click();
  const index = fixture.rewardTarget!.y * 9 + fixture.rewardTarget!.x;
  const before = await revision(page);
  await page.locator(`[data-cell-index="${index}"]`).click();
  expect(await revision(page)).toBe(before + 1);
  await expect(page.getByRole('heading', { name: 'Reward saved' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Claimed rewards' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Reward saved' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Claimed rewards' })).toBeVisible();
});

test('Game control keyboard focus loss cancels a held activation without blocking the next key', async ({ page }) => {
  const fixture = boardBrowserSave('detection-rich');
  await installFixture(page, fixture.entries);
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue' }).click();
  const before = await revision(page);
  await page.locator('[data-game-action="detection"]').focus();
  await page.keyboard.down('Enter');
  await page.locator('#page h2').focus();
  await page.keyboard.up('Enter');
  expect(await revision(page)).toBe(before);
  await page.locator('[data-game-action="detection"]').focus();
  await page.locator('[data-game-action="detection"]').press('Enter');
  expect(await revision(page)).toBe(before + 1);
});

test('competing writer does not publish stale Game Item state and explicit reload restores authority', async ({ page }) => {
  const fixture = boardBrowserSave('detection-rich');
  await installFixture(page, fixture.entries);
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue' }).click();
  const competitor = await page.context().newPage();
  await competitor.goto('/');
  await competitor.getByRole('button', { name: 'Continue' }).click();
  const before = await revision(page);
  await competitor.locator('[data-game-action="detection"]').click();
  expect(await revision(page)).toBe(before + 1);
  await page.locator('[data-game-action="detection"]').click();
  expect(await revision(page)).toBe(before + 1);
  await expect(page.locator('[data-game-action="reload"]')).toBeVisible();
  await page.locator('[data-game-action="reload"]').click();
  await expect(page.locator('.game-detail')).toContainText('Uses remaining: 1');
  await competitor.close();
});
