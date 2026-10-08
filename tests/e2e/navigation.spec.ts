import { expect, test } from '@playwright/test';
import { PRODUCTION_LEVEL_CATALOG } from '../../src/core/level-catalog';
import { createCompleteAttempt } from '../../src/core/stage4-attempt-factory';
import { createInitialStage4GameState, createStage4GameState } from '../../src/core/stage4-game-state';
import { mapStage4RuntimeToSaveV4 } from '../../src/core/persistence/stage4-runtime-mapping-v4';
import { commitSnapshot } from '../../src/systems/persistence/crash-safe-snapshot-store';
import { MemoryStorage } from '../helpers/memory-storage';

function historicalSnapshot() {
  const storage = new MemoryStorage();
  const level = { ...PRODUCTION_LEVEL_CATALOG.levels[0]!, levelId: 'retired-level' };
  const made = createCompleteAttempt({ level, runId: 'historical-attempt', generationProvenance: {
    seed: 17, rngVersion: 'mulberry32-v1', generationVersion: 'mine-placement-v1',
  } });
  if (made.status !== 'created') throw new Error('historical fixture');
  const runtime = createStage4GameState({ ...createInitialStage4GameState(), currentAttempt: made.attempt });
  const mapped = mapStage4RuntimeToSaveV4(runtime, 4);
  if (mapped.status !== 'mapped' || commitSnapshot(storage, JSON.stringify(mapped.document), 4).status !== 'committed') {
    throw new Error('historical save fixture');
  }
  return { storage, document: mapped.document };
}

test('real browser Home, level selection, Game return, Settings, Feedback and reload retain one saved attempt', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await page.getByRole('button', { name: 'Levels' }).first().click();
  await expect(page.getByRole('heading', { name: 'Levels' })).toBeVisible();
  await expect(page.locator('[data-level-id="level-001"]')).toBeEnabled();
  await page.locator('[data-level-id="level-001"]').click();
  await expect(page.getByRole('heading', { name: 'Game' })).toBeVisible();
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
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

test('historical missing-catalog attempt uses explicit two-commit replacement in a real browser', async ({ page }) => {
  const { storage } = historicalSnapshot();
  await page.addInitScript((values) => {
    if (sessionStorage.getItem('historical-seeded')) return;
    for (const [key, value] of values) localStorage.setItem(key, value);
    sessionStorage.setItem('historical-seeded', 'yes');
  }, [...storage.data]);
  await page.goto('/');
  await page.getByRole('button', { name: 'Levels' }).first().click();
  await expect(page.locator('[data-level-id="retired-level"]')).toHaveCount(0);
  await page.locator('[data-level-id="level-001"]').click();
  await expect(page.getByRole('button', { name: 'Confirm replacement' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('button', { name: 'Confirm replacement' })).toHaveCount(0);
  await page.locator('[data-level-id="level-001"]').click();
  await page.getByRole('button', { name: 'Confirm replacement' }).click();
  await expect(page.getByRole('heading', { name: 'Game' })).toBeVisible();
  await expect(page.locator('#page')).toContainText('level-001');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
});

test('browser confirmation rejects an intervening committed revision without discarding the save', async ({ page }) => {
  const { storage, document } = historicalSnapshot();
  const original = [...storage.data];
  if (commitSnapshot(storage, JSON.stringify({ ...document, revision: 5 }), 5).status !== 'committed') {
    throw new Error('competing writer fixture');
  }
  const competing = [...storage.data];
  await page.addInitScript((values) => { for (const [key, value] of values) localStorage.setItem(key, value); }, original);
  await page.goto('/');
  await page.getByRole('button', { name: 'Levels' }).first().click();
  await page.locator('[data-level-id="level-001"]').click();
  await page.evaluate((values) => { for (const [key, value] of values) localStorage.setItem(key, value); }, competing);
  await page.getByRole('button', { name: 'Confirm replacement' }).click();
  await expect(page.locator('#page [role="status"]')).toContainText('Your saved game changed');
  await expect(page.getByRole('heading', { name: 'Levels' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('minepilot:persistence:head') ?? 'null').revision)).toBe(5);
});
