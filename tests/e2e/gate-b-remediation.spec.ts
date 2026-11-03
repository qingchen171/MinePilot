import { expect, test } from '@playwright/test';
import { boardBrowserSave } from '../helpers/s5-06-browser-save';

test('ordinary window focus changes preserve Home and Levels re-entry without writes', async ({ page }) => {
  const fixture = boardBrowserSave('number', { x: 4, y: 4 });
  await page.addInitScript(entries => {
    for (const [key, value] of entries) localStorage.setItem(key, value);
  }, fixture.entries);
  await page.goto('/');
  await page.locator('[data-action="continue"]').click();
  const before = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  for (const route of ['Home', 'Levels']) {
    // Exercise the actual browser-entrypoint listeners, not a navigation helper.
    await page.evaluate(() => {
      window.dispatchEvent(new Event('blur'));
      window.dispatchEvent(new Event('focus'));
    });
    await page.getByRole('button', { name: route, exact: true }).first().click();
    if (route === 'Home') await page.locator('[data-action="continue"]').click();
    else await page.getByRole('button', { name: 'Game', exact: true }).first().click();
    await expect(page.locator('html')).toHaveAttribute('data-page', 'game');
    await expect(page.locator('[data-cell-index="40"]')).toBeEnabled();
    await expect(page.locator('.board-number-badge')).toHaveText(String(fixture.expectedNumber));
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).toBe(before);
  }
});

test('real competing commit still blocks re-entry until explicit authority reload', async ({ page }) => {
  const fixture = boardBrowserSave('number', { x: 4, y: 4 });
  await page.goto('/');
  await page.evaluate(entries => {
    for (const [key, value] of entries) localStorage.setItem(key, value);
  }, fixture.entries);
  await page.reload();
  await page.locator('[data-action="continue"]').click();
  const other = await page.context().newPage();
  await other.goto('/');
  await other.locator('[data-action="continue"]').click();
  await other.locator('[data-cell-index="0"]').click({ button: 'right' });
  const committed = await page.evaluate(() => localStorage.getItem('minepilot:persistence:head'));
  expect(JSON.parse(committed!).revision).toBe(5);
  await expect(page.locator('[data-cell-index="1"]')).toBeDisabled();
  await page.getByRole('button', { name: 'Home', exact: true }).first().click();
  await page.evaluate(() => {
    window.dispatchEvent(new Event('blur'));
    window.dispatchEvent(new Event('focus'));
  });
  await page.locator('[data-action="continue"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-page', 'home');
  await expect(page.locator('#page')).toContainText('Your saved game changed');
  // Home intentionally has no mutation/retry controls; F5 explicitly reopens
  // the committed authority without clearing or manufacturing a saved state.
  await page.reload();
  await page.locator('[data-action="continue"]').click();
  await expect(page.locator('[data-cell-index="0"]')).toHaveAttribute('data-appearance', 'flagged');
  expect(await page.evaluate(() => localStorage.getItem('minepilot:persistence:head'))).toBe(committed);
  await other.close();
});

for (const [name, x, y] of [['center', 4, 4], ['top-left', 0, 0], ['top-right', 8, 0]] as const) {
  test(`1366 current-number composition ${name}`, async ({ page }, info) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    // Validated preloaded v4 compatibility state from a generated production L1 Board.
    const fixture = boardBrowserSave('number', { x, y });
    await page.addInitScript(entries => {
      for (const [key, value] of entries) localStorage.setItem(key, value);
    }, fixture.entries);
    await page.goto('/');
    await page.locator('[data-action="continue"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-phaser-ready', 'true');
    await expect(page.locator('.board-number-badge')).toHaveText(String(fixture.expectedNumber));
    await page.mouse.move(2, 2);
    await page.screenshot({ path: info.outputPath(`number-${name}.png`) });
  });
}
