import { expect, test } from '@playwright/test';
import { createInitialStage4AccountState, createStage4AccountState } from '../../src/core/stage4-account';
import { createInitialStage4GameState, createStage4GameState } from '../../src/core/stage4-game-state';
import { mapStage4RuntimeToSaveV3 } from '../../src/core/persistence/stage4-runtime-mapping';
import { commitSnapshot } from '../../src/systems/persistence/crash-safe-snapshot-store';
import { MemoryStorage } from '../helpers/memory-storage';

function savedAccount() {
  const storage = new MemoryStorage();
  const account = createStage4AccountState({ ...createInitialStage4AccountState(), coins: 20 });
  const mapped = mapStage4RuntimeToSaveV3(createStage4GameState({ ...createInitialStage4GameState(), account, currentAttempt: null }), 4);
  if (mapped.status !== 'mapped') throw new Error('browser fixture');
  if (commitSnapshot(storage, JSON.stringify(mapped.document), 4).status !== 'committed') throw new Error('snapshot fixture');
  return [...storage.data];
}

test('Shop presents trusted prices, one purchase per activation and explicit buy-again', async ({ page }) => {
  const entries = savedAccount();
  await page.addInitScript((values) => {
    if (sessionStorage.getItem('shop-fixture-seeded') === 'yes') return;
    for (const [key, value] of values) localStorage.setItem(key, value);
    sessionStorage.setItem('shop-fixture-seeded', 'yes');
  }, entries);
  await page.goto('/');
  await page.getByRole('button', { name: 'Shop' }).click();
  const shop = page.locator('#shop');
  await expect(shop.getByRole('heading', { name: 'Shop' })).toBeVisible();
  await expect(shop).toContainText('Lucky — 1 coins');
  await expect(shop).toContainText('Detection — 2 coins');
  await expect(shop).toContainText('Revive — 4 coins');
  await expect(shop).toContainText('Airplane — 8 coins');
  // Two events on the original control model a double-click/key repeat across a synchronous commit.
  await shop.locator('button[data-shop-item="lucky"]').evaluate((button) => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await expect(shop).toContainText('Coins: 19');
  await expect(shop).toContainText('Purchase saved.');
  await expect(shop.locator('button[data-shop-item]')).toHaveCount(0);
  const writerIdentity = () => page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('minepilot:persistence:writer-lease') ?? 'null');
    return { sessionId: stored?.sessionId, leaseToken: stored?.leaseToken };
  });
  const ownerBeforeRoute = await writerIdentity();
  await page.getByRole('button', { name: 'Home' }).click();
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  await expect(shop).toContainText('Coins: 19');
  await expect(shop.getByRole('button', { name: 'Buy again' })).toBeVisible();
  expect(await writerIdentity()).toEqual(ownerBeforeRoute);
  const repeatPrevented = await shop.getByRole('button', { name: 'Buy again' }).evaluate((button) => {
    const repeatedEnter = new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true, cancelable: true });
    button.dispatchEvent(repeatedEnter);
    return repeatedEnter.defaultPrevented;
  });
  expect(repeatPrevented).toBe(true);
  await shop.getByRole('button', { name: 'Buy again' }).click();
  await shop.locator('button[data-shop-item="lucky"]').click();
  await expect(shop).toContainText('Coins: 18');
  expect(await writerIdentity()).toEqual(ownerBeforeRoute);
  await page.reload();
  await page.getByRole('button', { name: 'Shop' }).click();
  await expect(shop).toContainText('Coins: 18');
  await expect(shop).toContainText('Lucky — 1 coins · Owned: 3');
});

test('Shop exit cancels a retained purchase Retry without silently re-authorizing it', async ({ page }) => {
  const entries = savedAccount();
  await page.addInitScript((values) => {
    for (const [key, value] of values) localStorage.setItem(key, value);
  }, entries);
  await page.goto('/');
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  await page.evaluate(() => {
    const original = Storage.prototype.getItem;
    let once = true;
    Storage.prototype.getItem = function (key) {
      if (once && key === 'minepilot:persistence:writer-lease') {
        once = false;
        throw new Error('browser-injected pre-commit lease read failure');
      }
      return original.call(this, key);
    };
  });
  const shop = page.locator('#shop');
  await shop.locator('button[data-shop-item="lucky"]').click();
  await expect(shop.getByRole('button', { name: 'Try again' })).toBeVisible();
  await page.getByRole('button', { name: 'Home' }).click();
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  await expect(shop.getByRole('button', { name: 'Try again' })).toHaveCount(0);
  await expect(shop.getByRole('button', { name: 'Reload game' })).toBeVisible();
  await expect(shop).toContainText('Coins: 20');
  await shop.getByRole('button', { name: 'Reload game' }).click();
  await expect(shop.getByRole('button', { name: 'Buy again' })).toBeVisible();
  await shop.getByRole('button', { name: 'Buy again' }).click();
  await shop.locator('button[data-shop-item="lucky"]').click();
  await expect(shop).toContainText('Coins: 19');
});
