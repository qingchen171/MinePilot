import { expect, test, type Page } from '@playwright/test';
import { boardBrowserSave } from '../helpers/s5-06-browser-save';

const viewports = [{ width: 1280, height: 720 }, { width: 1024, height: 768 },
  { width: 1366, height: 768 }, { width: 1920, height: 1080 }] as const;

async function checkPage(page: Page, name: string, board = false) {
  // The frozen remediation moves help/history into native on-demand drawers.
  // Open them so the same clipping/obstruction assertions also test their controls.
  for (const summary of await page.locator('#game-controls details > summary').all()) {
    if (await summary.locator('..').getAttribute('open') === null) await summary.click();
  }
  const failures = await page.evaluate(() => {
    const issues: string[] = [];
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
      issues.push(`horizontal overflow ${document.documentElement.scrollWidth}/${document.documentElement.clientWidth}`);
    const controls = document.querySelectorAll<HTMLElement>(
      '#navigation button, #page button, #page input, #page a[href], #game-controls button, #shop button');
    for (const control of controls) {
      if (control.getClientRects().length === 0) continue;
      control.scrollIntoView({ block: 'center', inline: 'nearest' });
      const rect = control.getBoundingClientRect();
      const label = control.getAttribute('data-action') ?? control.getAttribute('data-game-action') ??
        control.getAttribute('data-shop-item') ?? control.textContent?.trim() ?? control.tagName;
      if (rect.width <= 0 || rect.height <= 0 || rect.left < -1 || rect.right > innerWidth + 1 ||
          rect.top < -1 || rect.bottom > innerHeight + 1) issues.push(`clipped ${label}`);
      else {
        for (let ancestor = control.parentElement; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
          const style = getComputedStyle(ancestor);
          const clipX = /hidden|clip|auto|scroll/.test(style.overflowX);
          const clipY = /hidden|clip|auto|scroll/.test(style.overflowY);
          const bounds = ancestor.getBoundingClientRect();
          if ((clipX && (rect.left < bounds.left - 1 || rect.right > bounds.right + 1)) ||
              (clipY && (rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1)))
            issues.push(`ancestor-clipped ${label}`);
        }
        for (const xFraction of [.05, .5, .95]) for (const yFraction of [.05, .5, .95]) {
          const top = document.elementFromPoint(rect.left + rect.width * xFraction,
            rect.top + rect.height * yFraction);
          if (top !== control && !control.contains(top)) issues.push(`obscured ${label} ${xFraction}/${yFraction}`);
        }
      }
    }
    return issues;
  });
  expect(failures, name).toEqual([]);
  if (!board) return;
  for (const index of [0, 4, 40, 76, 80]) {
    const cell = page.locator(`[data-cell-index="${index}"]`);
    await cell.evaluate((node) => node.scrollIntoView({ block: 'center', inline: 'nearest' }));
    const canvas = await page.locator('#game-stage canvas').boundingBox();
    expect(canvas, `${name} canvas`).not.toBeNull();
    const rect = await cell.boundingBox();
    expect(rect, `${name} cell ${index}`).not.toBeNull();
    expect(rect!.x).toBeGreaterThanOrEqual(canvas!.x - 1);
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(canvas!.x + canvas!.width + 1);
    expect(rect!.y).toBeGreaterThanOrEqual(canvas!.y - 1);
    expect(rect!.y + rect!.height).toBeLessThanOrEqual(canvas!.y + canvas!.height + 1);
    const hit = await cell.evaluate((node) => {
      const bounds = node.getBoundingClientRect();
      return document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
        ?.getAttribute('data-cell-index');
    });
    expect(hit, `${name} hit coordinate ${index}`).toBe(String(index));
  }
}

async function checkFocus(page: Page, name: string, selector: string) {
  const control = page.locator(selector).first();
  await expect(control, `${name} keyboard control`).toBeVisible();
  await control.focus();
  await page.keyboard.press('Shift'); // Keyboard modality without moving focus out to browser chrome.
  const focus = await control.evaluate((node) => {
    const style = getComputedStyle(node);
    return { focused: document.activeElement === node, active: document.activeElement?.outerHTML.slice(0, 120),
      target: node.outerHTML.slice(0, 120), visible: node.matches(':focus-visible'),
      outline: style.outlineStyle, width: style.outlineWidth, shadow: style.boxShadow,
      tabbable: node.tabIndex >= 0 && !node.matches(':disabled') };
  });
  expect(focus.focused, `${name}: ${JSON.stringify(focus)}`).toBe(true);
  expect(focus.tabbable, name).toBe(true);
  expect(focus.visible, name).toBe(true);
  expect((focus.outline !== 'none' && focus.width !== '0px') || focus.shadow !== 'none', name).toBe(true);
}

/** Independent visual proof: Phaser's flag triangles must land inside these exact DOM hit cells. */
async function checkPhaserAlignment(page: Page) {
  const indices = [0, 4, 40, 76, 80];
  for (const index of indices) {
    await page.locator(`[data-cell-index="${index}"]`).click({ button: 'right' });
    await expect(page.locator(`[data-cell-index="${index}"]`)).toHaveAttribute('data-appearance', 'flagged');
  }
  await expect.poll(async () => {
    // CSS-resolution capture still samples the actual DPR2/zoomed composition.
    // Avoid serializing millions of individual byte numbers across the driver boundary.
    const screenshot = await page.locator('#game-stage canvas').screenshot({ scale: 'css' });
    return page.evaluate(async ({ encoded, targets }) => {
      const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${encoded}`)).blob());
      const scratch = document.createElement('canvas'); scratch.width = bitmap.width; scratch.height = bitmap.height;
      const context = scratch.getContext('2d');
      if (context === null) throw new Error('screenshot decoder');
      context.drawImage(bitmap, 0, 0); bitmap.close();
      const canvas = document.querySelector('#game-stage canvas')!.getBoundingClientRect();
      return targets.map((index) => {
        const rect = document.querySelector(`[data-cell-index="${index}"]`)!.getBoundingClientRect();
        // doc22 §3 moves public markers to the protected upper-right box.
        const x = Math.floor((rect.left + rect.width * .82 - canvas.left) * scratch.width / canvas.width);
        const y = Math.floor((rect.top + rect.height * .16 - canvas.top) * scratch.height / canvas.height);
        const pixel = context.getImageData(x, y, 1, 1).data;
        return pixel[0]! > pixel[1]! + 50 && pixel[0]! > pixel[2]! + 50;
      });
    }, { encoded: screenshot.toString('base64'), targets: indices });
  }, { timeout: 15_000, message: 'Phaser flag artwork aligns with corner, edge and center DOM hit cells' })
    .toEqual(indices.map(() => true));
}

async function fixture(page: Page, variant: 'pending' | 'failed' | 'won') {
  const values = boardBrowserSave(variant).entries;
  await page.addInitScript((entries: [string, string][]) => {
    for (const [key, value] of entries) localStorage.setItem(key, value);
  }, values);
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue' }).click();
}

test('Gate B DPR 2, CSS zoom and scroll retain unobscured controls and pixel-proven flag alignment', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  const page = await context.newPage(); await page.goto('/');
  await page.locator('[data-action="route-levels"]').first().click();
  await page.locator('[data-level-id="level-001"]').click();
  await page.evaluate(() => { document.body.style.zoom = '125%'; window.dispatchEvent(new Event('resize')); });
  await checkPage(page, 'zoomed Game', true); await checkPhaserAlignment(page);
  expect(await page.evaluate(() => devicePixelRatio)).toBe(2); await context.close();
});

for (const viewport of viewports) {
  test(`G8 ${viewport.width}x${viewport.height}: Home, Levels, Shop, Settings, Feedback and active Game`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.bringToFront();
    await page.reload(); // Establish foreground focus before keyboard checks; app reload is read-only.
    await checkPage(page, 'Home');
    await checkFocus(page, 'Home', '#page button');
    await page.getByRole('button', { name: 'Levels' }).first().click();
    await checkPage(page, 'Levels');
    await checkFocus(page, 'Levels', '#page button');
    await page.getByRole('button', { name: 'Shop' }).click();
    await checkPage(page, 'Shop');
    await checkFocus(page, 'Shop', '#navigation button');
    await page.getByRole('button', { name: 'Settings' }).click();
    await checkPage(page, 'Settings');
    await checkFocus(page, 'Settings', '#page input');
    await page.getByRole('button', { name: 'Feedback' }).click();
    await checkPage(page, 'Feedback');
    await checkFocus(page, 'Feedback', '#page a[href]');
    await page.getByRole('button', { name: 'Levels' }).click();
    await page.locator('[data-level-id="level-001"]').click();
    await checkPage(page, 'active Game', true);
    await checkFocus(page, 'active Game', '.board-hit-cell:not(:disabled)');
    await checkPhaserAlignment(page);
  });

  for (const variant of ['pending', 'failed', 'won'] as const) {
    test(`G8 ${viewport.width}x${viewport.height}: validated v4 ${variant} controls`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await fixture(page, variant);
      await expect(page.getByRole('heading', { name: 'Game' })).toBeVisible();
      await checkPage(page, `${variant} Game`, true);
      await checkFocus(page, `${variant} terminal control`, '#game-controls button:not(:disabled)');
    });
  }

  test(`G8 ${viewport.width}x${viewport.height}: non-destructive Recovery and Feedback`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => localStorage.setItem('minepilot:persistence:head', '{corrupt'));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Recovery' })).toBeVisible();
    await checkPage(page, 'Recovery');
    await checkFocus(page, 'Recovery', '#page button');
    await page.getByRole('button', { name: 'Feedback' }).first().click();
    await checkPage(page, 'Recovery Feedback');
    await checkFocus(page, 'Recovery Feedback', '#page a[href]');
  });
}
