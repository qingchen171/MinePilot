import { expect, test } from '@playwright/test';
import { boardBrowserSave } from '../helpers/s5-06-browser-save';

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

test('touch long-press contextmenu and its compatibility click submit only one Flag', async ({ page }) => {
  await openBoard(page);
  const initial = await revision(page);
  const first = page.locator('[data-cell-index="0"]');
  await first.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 7, button: 0 });
  await first.dispatchEvent('contextmenu', { button: 2, detail: 0 });
  await first.dispatchEvent('click', { button: 0, detail: 1 });
  expect(await revision(page)).toBe(initial + 1);
  await expect(first).toHaveAttribute('data-appearance', 'flagged');
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

test('touch mode is visible and changes only touch activation, not desktop primary click', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await openBoard(page);
  const first = page.locator('[data-cell-index="0"]');
  const second = page.locator('[data-cell-index="1"]');
  await page.locator('[data-action="touch-flag"]').click();
  await expect(page.locator('[data-action="touch-flag"]')).toHaveAttribute('aria-pressed', 'true');
  const before = await revision(page);
  await first.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 9, button: 0 });
  await first.dispatchEvent('click', { button: 0, detail: 1 });
  await expect(first).toHaveAttribute('data-appearance', 'flagged');
  expect(await revision(page)).toBe(before + 1);
  await second.click({ button: 'right' });
  await expect(second).toHaveAttribute('data-appearance', 'flagged');
});

for (const variant of ['pending', 'failed', 'won', 'occupancy', 'zero', 'number'] as const) {
  test(`public ${variant} feedback reconstructs from a valid committed v4 snapshot`, async ({ page }) => {
    const fixture = boardBrowserSave(variant);
    const scenario = page;
    await scenario.addInitScript((entries: [string, string][]) => {
      localStorage.clear();
      for (const [key, value] of entries) localStorage.setItem(key, value);
    }, fixture.entries);
    await scenario.goto('/');
    await scenario.getByRole('button', { name: 'Continue' }).click();
    await expect(scenario.locator('.board-hit-cell')).toHaveCount(81);
    const before = await revision(scenario);
    const first = scenario.locator('[data-cell-index="0"]');
    if (variant === 'pending' || variant === 'failed' || variant === 'won') {
      await expect(first).toBeDisabled();
      await expect(scenario.locator('[data-action="board-flag"]')).toBeDisabled();
      expect(await revision(scenario)).toBe(before);
    } else {
      await expect(first).toBeEnabled();
    }
    if (variant === 'occupancy') {
      const index = fixture.selected!.y * 9 + fixture.selected!.x;
      await expect(scenario.locator(`[data-cell-index="${index}"]`)).toHaveAttribute('data-character', 'true');
      await expect(scenario.locator('.board-position')).toContainText('revealed mine');
      await expect(scenario.locator('.board-current-number')).toBeEmpty();
    }
    if (variant === 'zero') {
      await expect(scenario.locator('.board-current-number')).toHaveText('No nearby mines here.');
      await expect(scenario.locator('.board-current-number')).not.toContainText('0');
    }
    if (variant === 'number') {
      await expect(scenario.locator('.board-current-number')).toHaveText(`Nearby mines: ${fixture.expectedNumber}`);
    }
    await scenario.reload();
  });
}

test('a committed-authority reload disables an old same-size board press and restores safe focus', async ({ page }) => {
  await openBoard(page);
  const first = page.locator('[data-cell-index="0"]');
  await first.focus();
  const before = await revision(page);
  await page.evaluate(async () => {
    const modulePath: string = '/src/main.ts';
    const { presentationRoot } = await import(modulePath);
    presentationRoot?.reload();
  });
  await expect(page.getByRole('heading', { name: 'Game' })).toBeFocused();
  await first.dispatchEvent('click', { detail: 1 });
  expect(await revision(page)).toBe(before);
  await page.getByRole('button', { name: 'Game', exact: true }).click();
  await expect(first).toBeEnabled();
});

test('primary same-cell double click does not submit twice after a synchronous commit', async ({ page }) => {
  const fixture = boardBrowserSave('zero');
  expect(fixture.moveTarget).not.toBeNull();
  const targetIndex = fixture.moveTarget!.y * 9 + fixture.moveTarget!.x;
  async function countFor(double: boolean) {
    const scenario = await page.context().newPage();
    await scenario.addInitScript((entries: [string, string][]) => {
      localStorage.clear(); for (const [key, value] of entries) localStorage.setItem(key, value);
    }, fixture.entries);
    await scenario.goto('/');
    await scenario.getByRole('button', { name: 'Continue' }).click();
    await scenario.evaluate(() => {
      const tracked = window as unknown as Window & { leaseWrites: number };
      tracked.leaseWrites = 0;
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (key === 'minepilot:persistence:writer-lease') tracked.leaseWrites += 1;
        return original.call(this, key, value);
      };
    });
    const cell = scenario.locator(`[data-cell-index="${targetIndex}"]`);
    if (double) await cell.dblclick(); else await cell.click();
    const writes = await scenario.evaluate(() => (window as unknown as Window & { leaseWrites: number }).leaseWrites);
    await scenario.close();
    return writes;
  }
  const single = await countFor(false);
  const double = await countFor(true);
  expect(single).toBeGreaterThan(0);
  expect(double).toBe(single);
});

test('keyboard hold and assistive click use one activation each', async ({ page }) => {
  const fixture = boardBrowserSave('zero');
  await page.addInitScript((entries: [string, string][]) => {
    localStorage.clear(); for (const [key, value] of entries) localStorage.setItem(key, value);
  }, fixture.entries);
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue' }).click();
  const target = page.locator(`[data-cell-index="${fixture.moveTarget!.y * 9 + fixture.moveTarget!.x}"]`);
  await target.focus();
  const before = await revision(page);
  await target.press('Enter');
  expect(await revision(page)).toBe(before + 1);
  await target.dispatchEvent('keydown', { key: 'Enter', repeat: true });
  await target.dispatchEvent('keyup', { key: 'Enter' });
  expect(await revision(page)).toBe(before + 1);
  const unknown = page.locator('.board-hit-cell[data-appearance="unknown"]').first();
  await unknown.dispatchEvent('click', { detail: 0 });
  expect(await revision(page)).toBe(before + 2);
});

test('zoom, DPR, route reconstruction and scroll keep one public board geometry', async ({ page }) => {
  await openBoard(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.locator('.board-hit-cell')).toHaveCount(0);
  await page.getByRole('button', { name: 'Game', exact: true }).click();
  await expect(page.locator('.board-hit-cell')).toHaveCount(81);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 500, height: 800, deviceScaleFactor: 2, mobile: false });
  await page.evaluate(() => { document.body.style.zoom = '125%'; window.scrollTo(0, document.body.scrollHeight); });
  const canvas = await page.locator('#game-stage canvas').boundingBox();
  const first = await page.locator('[data-cell-index="0"]').boundingBox();
  const last = await page.locator('[data-cell-index="80"]').boundingBox();
  expect(canvas).not.toBeNull(); expect(first).not.toBeNull(); expect(last).not.toBeNull();
  expect(first!.x).toBeGreaterThanOrEqual(canvas!.x);
  expect(first!.y).toBeGreaterThanOrEqual(canvas!.y);
  expect(last!.x + last!.width).toBeLessThanOrEqual(canvas!.x + canvas!.width + 1);
  expect(last!.y + last!.height).toBeLessThanOrEqual(canvas!.y + canvas!.height + 1);
  expect(await page.evaluate(() => devicePixelRatio)).toBe(2);
});

test('competing writer loss never draws an uncommitted destination', async ({ page }) => {
  const fixture = boardBrowserSave('zero');
  await page.addInitScript((entries: [string, string][]) => {
    localStorage.clear(); for (const [key, value] of entries) localStorage.setItem(key, value);
  }, fixture.entries);
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue' }).click();
  const original = page.locator('.board-hit-cell[data-character="true"]');
  const originalIndex = await original.getAttribute('data-cell-index');
  const move = page.locator(`[data-cell-index="${fixture.moveTarget!.y * 9 + fixture.moveTarget!.x}"]`);
  const other = await page.context().newPage();
  await other.goto('/');
  await other.getByRole('button', { name: 'Continue' }).click();
  await other.locator('.board-hit-cell[data-appearance="unknown"]').first().click({ button: 'right' });
  await move.click();
  await expect(page.locator('.board-hit-cell[data-character="true"]')).toHaveAttribute('data-cell-index', originalIndex!);
  await expect(page.locator('#page [role="status"]')).toContainText('Reload');
  await other.close();
});

test('uncertain new-head failure never replays or paints a fictional destination', async ({ page }) => {
  const fixture = boardBrowserSave('zero');
  await page.addInitScript((entries: [string, string][]) => {
    localStorage.clear(); for (const [key, value] of entries) localStorage.setItem(key, value);
  }, fixture.entries);
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue' }).click();
  const originalIndex = await page.locator('.board-hit-cell[data-character="true"]').getAttribute('data-cell-index');
  const before = await revision(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    let failed = false;
    Storage.prototype.setItem = function(key, value) {
      if (!failed && key === 'minepilot:persistence:head') {
        failed = true; throw new Error('injected head failure');
      }
      return original.call(this, key, value);
    };
  });
  const move = page.locator(`[data-cell-index="${fixture.moveTarget!.y * 9 + fixture.moveTarget!.x}"]`);
  await move.click();
  await expect(page.locator('.board-hit-cell[data-character="true"]')).toHaveAttribute('data-cell-index', originalIndex!);
  expect(await revision(page)).toBe(before);
  await expect(page.locator('#page [role="status"]')).toContainText('uncertain');
  await move.click();
  expect(await revision(page)).toBe(before);
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
