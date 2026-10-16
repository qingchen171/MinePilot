import { expect, test } from '@playwright/test';

async function revision(page: import('@playwright/test').Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('minepilot:persistence:head') ?? 'null').revision as number);
}

test('committed Board feedback remains readable through resize, reduced motion and F5 without replay', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Levels' }).first().click();
  await page.locator('[data-level-id="level-001"]').click();
  await expect(page.locator('#status')).toHaveText('Saved.');
  const before = await revision(page);
  await page.locator('[data-cell-index="0"]').click({ button: 'right' });
  await expect(page.locator('[data-cell-index="0"]')).toHaveAttribute('data-appearance', 'flagged');
  expect(await revision(page)).toBe(before + 1);
  await page.setViewportSize({ width: 500, height: 800 });
  await expect(page.locator('#status')).toHaveText('Flag change saved.');
  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('[data-cell-index="0"]')).toHaveAttribute('data-appearance', 'flagged');
  expect(await revision(page)).toBe(before + 1);
  await expect(page.locator('#status')).not.toHaveText('Saved.');
});

test('cross-tab dirty signal suppresses stale input and keeps explicit Reload non-destructive', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Levels' }).first().click();
  await page.locator('[data-level-id="level-001"]').click();
  const initial = await revision(page);
  const other = await page.context().newPage();
  await other.goto('/');
  await other.getByRole('button', { name: 'Continue' }).click();
  await other.evaluate(() => { const key = 'minepilot:persistence:writer-lease';
    const lease = JSON.parse(localStorage.getItem(key) ?? 'null') as { expiresAtMs: number };
    localStorage.setItem(key, JSON.stringify({ ...lease, expiresAtMs: Date.now() - 1 })); });
  await other.locator('[data-cell-index="0"]').click({ button: 'right' });
  expect(await revision(page)).toBe(initial + 1);
  await expect(page.locator('[data-cell-index="1"]')).toBeDisabled();
  await expect(page.locator('#status')).toContainText('Reload');
  expect(await revision(page)).toBe(initial + 1);
  await page.locator('[data-game-action="reload"]').click();
  await expect(page.locator('[data-cell-index="0"]')).toHaveAttribute('data-appearance', 'flagged');
  await expect(page.locator('[data-cell-index="1"]')).toBeEnabled();
  expect(await revision(page)).toBe(initial + 1);
  await other.close();
});

test('delayed browser audio resume cannot start an expired source after committed Settings off', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const state = { pending: [] as (() => void)[], started: 0, stopped: 0 };
    (window as unknown as { __audioTest: typeof state }).__audioTest = state;
    class FakeAudioContext {
      currentTime = 0;
      destination = {};
      resume() { return new Promise<void>((resolve) => { state.pending.push(resolve); }); }
      createOscillator() { return { type: '', frequency: { value: 0 },
        connect: () => ({ connect: () => ({}) }), start: () => { state.started++; },
        stop: () => { state.stopped++; }, disconnect: () => {} }; }
      createGain() { return { gain: { value: 0, setTargetAtTime: () => {} },
        connect: () => ({}), disconnect: () => {} }; }
    }
    Object.defineProperty(window, 'AudioContext', { value: FakeAudioContext, configurable: true });
  });
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as { __audioTest: { pending: unknown[] } }).__audioTest.pending.length)).toBeGreaterThan(0);
  await page.locator('[data-setting="musicEnabled"]').uncheck();
  await page.locator('[data-setting="soundEffectsEnabled"]').uncheck();
  await page.evaluate(() => { const state = (window as unknown as { __audioTest: { pending: (() => void)[] } }).__audioTest;
    state.pending.splice(0).forEach((resolve) => resolve()); });
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as { __audioTest: { started: number } }).__audioTest.started)).toBe(0);
  await expect(page.locator('[data-setting="musicEnabled"]')).not.toBeChecked();
});
