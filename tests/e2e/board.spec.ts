import { expect, test } from '@playwright/test';

async function openBoard(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Levels' }).first().click();
  await page.locator('[data-level-id="level-001"]').click();
  await expect(page.getByRole('heading', { name: 'Game' })).toBeVisible();
  await expect(page.locator('.board-hit-cell')).toHaveCount(81);
}

async function revision(page: import('@playwright/test').Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('minepilot:persistence:head') ?? 'null').revision as number);
}

test('real board: public hidden cells, explicit Flag, right-click, primary Move and exact reload', async ({ page }) => {
  await openBoard(page);
  const first = page.locator('[data-cell-index="0"]');
  const second = page.locator('[data-cell-index="1"]');
  await expect(first).toHaveAttribute('data-appearance', 'unknown');
  await expect(second).toHaveAttribute('data-appearance', 'unknown');
  await expect(first).toHaveAttribute('aria-label', 'Row 1, Column 1, Unknown cell');
  await expect(second).toHaveAttribute('aria-label', 'Row 1, Column 2, Unknown cell');
  await expect(page.locator('[data-action="board-flag"]')).toBeDisabled();
  await first.focus();
  await expect(page.locator('[data-action="board-flag"]')).toBeEnabled();
  await page.locator('[data-action="board-flag"]').click();
  await expect(first).toHaveAttribute('data-appearance', 'flagged');
  await second.click({ button: 'right' });
  await expect(second).toHaveAttribute('data-appearance', 'flagged');
  const flaggedRevision = await revision(page);
  await first.click(); // Flag remains the authoritative movement safety lock.
  expect(await revision(page)).toBe(flaggedRevision);
  await first.click({ button: 'right' });
  await expect(first).toHaveAttribute('data-appearance', 'unknown');
  await first.click();
  expect(await revision(page)).toBe(flaggedRevision + 2);
  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('[data-cell-index="1"]')).toHaveAttribute('data-appearance', 'flagged');
  await expect(page.locator('.board-hit-cell')).toHaveCount(81);
});

test('native same-target double click is one submission, while another target remains immediately usable', async ({ page }) => {
  await openBoard(page);
  const initial = await revision(page);
  const first = page.locator('[data-cell-index="0"]');
  await first.click({ button: 'right', clickCount: 2 });
  expect(await revision(page)).toBe(initial + 1);
  await page.locator('[data-cell-index="1"]').click({ button: 'right' });
  expect(await revision(page)).toBe(initial + 2);
});

test('keyboard focus never moves character; resize and scroll retain one coordinate grid', async ({ page }) => {
  await openBoard(page);
  const before = await revision(page);
  const first = page.locator('[data-cell-index="0"]');
  await first.focus();
  await first.press('ArrowRight');
  await expect(page.locator('[data-cell-index="1"]')).toBeFocused();
  expect(await revision(page)).toBe(before);
  await page.setViewportSize({ width: 500, height: 800 });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const canvas = await page.locator('#game-stage canvas').boundingBox();
  const corner = await page.locator('[data-cell-index="80"]').boundingBox();
  expect(canvas).not.toBeNull(); expect(corner).not.toBeNull();
  expect(corner!.x).toBeGreaterThanOrEqual(canvas!.x);
  expect(corner!.x + corner!.width).toBeLessThanOrEqual(canvas!.x + canvas!.width + 1);
  expect(corner!.y + corner!.height).toBeLessThanOrEqual(canvas!.y + canvas!.height + 1);
  await page.locator('[data-cell-index="1"]').press('Enter');
  expect(await revision(page)).toBe(before + 1);
});

test('committed competing abandon removes the old board hit surface on reload', async ({ page }) => {
  await openBoard(page);
  const other = await page.context().newPage();
  await other.goto('/');
  await other.getByRole('button', { name: 'Continue' }).click();
  await other.evaluate(() => {
    const key = 'minepilot:persistence:writer-lease';
    const lease = JSON.parse(localStorage.getItem(key) ?? 'null') as { expiresAtMs: number };
    localStorage.setItem(key, JSON.stringify({ ...lease, expiresAtMs: Date.now() - 1 }));
  });
  await other.getByRole('button', { name: 'Leave attempt to open Shop' }).click();
  await page.evaluate(async () => {
    const modulePath: string = '/src/main.ts';
    const { presentationRoot } = await import(modulePath);
    presentationRoot?.reload();
  });
  await page.getByRole('button', { name: 'Game', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await expect(page.locator('.board-hit-cell')).toHaveCount(0);
  await other.close();
});
