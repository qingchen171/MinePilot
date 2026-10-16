import { expect, test } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';
import { createLevelCatalog, PRODUCTION_LEVEL_CATALOG } from '../../src/core/level-catalog';
import { createBoard, createCellState } from '../../src/core/board';
import { countAdjacentMines, getNeighborCoordinates } from '../../src/core/neighborhood';
import { createCompleteAttempt } from '../../src/core/stage4-attempt-factory';
import { createInitialStage4GameState, createStage4GameState } from '../../src/core/stage4-game-state';
import { createOnBoardPosition, createRunState } from '../../src/core/run';
import { mapStage4RuntimeToSaveV4 } from '../../src/core/persistence/stage4-runtime-mapping-v4';
import { validateSaveDocumentV4 } from '../../src/core/persistence/save-v4';
import { commitSnapshot } from '../../src/systems/persistence/crash-safe-snapshot-store';
import { MemoryStorage } from '../helpers/memory-storage';

const base = PRODUCTION_LEVEL_CATALOG.levels[0]!;
const madeCatalog = createLevelCatalog([base,
  { ...base, levelId: 'level-002' },
  { ...base, levelId: 'level-003', board: { ...base.board, obstacleCoordinates: [{ x: 0, y: 0 }] } },
  { ...base, levelId: 'level-004' },
  { ...base, levelId: 'level-005' },
]);
if (madeCatalog.status !== 'created') throw new Error('controlled browser catalog invalid');
const catalog = madeCatalog.catalog;
const catalogLiteral = JSON.stringify(catalog.levels);
let server: ViteDevServer;
let browserUrl: string;

/** Browser-only Vite transform: the same validated catalog drives production session and public projection. */
test.beforeAll(async () => {
  server = await createServer({ configFile: false, root: process.cwd(),
    server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false },
    plugins: [{ name: 's5-07-controlled-catalog', enforce: 'pre', transform(source, id) {
      if (!id.replaceAll('\\', '/').endsWith('/src/core/level-catalog.ts')) return;
      const anchor = 'export const PRODUCTION_LEVEL_CATALOG = productionCatalog.catalog;';
      if (!source.includes(anchor)) throw new Error('catalog replacement anchor missing');
      return source.replace(anchor, `const controlledBrowserCatalog = createLevelCatalog(${catalogLiteral});\n` +
        `if (controlledBrowserCatalog.status !== 'created') throw new Error('controlled catalog invalid');\n` +
        `export const PRODUCTION_LEVEL_CATALOG = controlledBrowserCatalog.catalog;`);
    } }],
  });
  await server.listen();
  browserUrl = server.resolvedUrls?.local[0] ?? '';
  if (!browserUrl) throw new Error('controlled browser server unavailable');
});
test.afterAll(async () => { await server?.close(); });

function savedEntries(levelId: string | null) {
  const initial = createInitialStage4GameState();
  const account = { ...initial.account, completedLevelIds: ['level-001', 'level-002', 'level-003', 'level-004'],
    inventory: { ...initial.account.inventory, lucky: 0 } };
  let currentAttempt = null;
  let mineIndex = -1;
  let moveIndex = -1;
  let originIndex = -1;
  if (levelId !== null) {
    const level = catalog.levels.find((entry) => entry.levelId === levelId);
    if (!level) throw new Error('controlled level missing');
    const created = createCompleteAttempt({ level, runId: `browser-${levelId}`,
      generationProvenance: { seed: 123456789, rngVersion: 'mulberry32-v1', generationVersion: 'mine-placement-v1' } });
    if (created.status !== 'created') throw new Error('controlled attempt creation failed');
    currentAttempt = created.attempt;
    mineIndex = currentAttempt.run.board.cells.findIndex((cell) => cell.kind === 'mine');
    if (levelId === 'level-002') {
      const board = currentAttempt.run.board;
      const width = board.dimensions.width;
      const rewardCoordinates = new Set(currentAttempt.rewards.map((reward) =>
        `${reward.coordinate.x},${reward.coordinate.y}`));
      for (let index = 0; index < board.cells.length && originIndex < 0; index += 1) {
        const coordinate = { x: index % width, y: Math.floor(index / width) };
        if (board.cells[index]?.kind !== 'safe' || rewardCoordinates.has(`${coordinate.x},${coordinate.y}`) ||
            countAdjacentMines(board, coordinate) === 0) continue;
        const neighbor = getNeighborCoordinates(board, coordinate).find((candidate) => {
          const candidateIndex = candidate.y * width + candidate.x;
          return board.cells[candidateIndex]?.kind === 'safe';
        });
        if (neighbor) { originIndex = index; moveIndex = neighbor.y * width + neighbor.x; }
      }
      if (originIndex < 0 || moveIndex < 0) throw new Error('L2 numbered Safe transition unavailable');
      const explored = createBoard(board.dimensions, board.cells.map((cell, index) => index === originIndex
        ? createCellState({ terrain: 'playable', containsMine: false, explored: true, mineRevealed: false, flagged: false })
        : cell));
      const coordinate = { x: originIndex % width, y: Math.floor(originIndex / width) };
      currentAttempt = { ...currentAttempt,
        run: createRunState(explored, createOnBoardPosition(coordinate), { hasTakenStep: true }) };
    }
  }
  const runtime = createStage4GameState({ ...initial, account, currentAttempt });
  const mapped = mapStage4RuntimeToSaveV4(runtime, 0);
  if (mapped.status !== 'mapped') throw new Error('controlled v4 mapping failed');
  const validated = validateSaveDocumentV4(JSON.parse(JSON.stringify(mapped.document)) as unknown);
  if (validated.status !== 'validated') throw new Error('controlled v4 validation failed');
  const storage = new MemoryStorage();
  if (commitSnapshot(storage, JSON.stringify(validated.document), 0).status !== 'committed')
    throw new Error('controlled snapshot commit failed');
  return { entries: [...storage.data.entries()], mineIndex, moveIndex, originIndex };
}

async function install(page: import('@playwright/test').Page, entries: [string, string][]) {
  await page.addInitScript((snapshot: [string, string][]) => {
    if (sessionStorage.getItem('s5-07-controlled-installed') === 'yes') return;
    localStorage.clear();
    for (const [key, value] of snapshot) localStorage.setItem(key, value);
    sessionStorage.setItem('s5-07-controlled-installed', 'yes');
  }, entries);
  await page.goto(browserUrl);
}

test('controlled L2/L3 catalog is shared by selection and guarded browser execution; obstacle stays public', async ({ page }) => {
  const saved = savedEntries(null);
  await install(page, saved.entries);
  await page.getByRole('button', { name: 'Levels' }).first().click();
  await expect(page.locator('[data-level-id="level-002"]')).toBeEnabled();
  await expect(page.locator('[data-level-id="level-003"]')).toBeEnabled();
  await page.locator('[data-level-id="level-003"]').click();
  await expect(page.getByRole('heading', { name: 'Game' })).toBeVisible();
  await expect(page.locator('[data-appearance="obstacle"]')).toHaveCount(1);
  await expect(page.locator('.game-detail')).toContainText('Choose a cell, then use Flag');
  await page.locator('[data-game-action="toggle-help"]').click();
  await expect(page.locator('.game-detail')).toContainText('Obstacles cannot be entered');
  const revisionBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('minepilot:persistence:head') ?? 'null').revision as number);
  await page.locator('[data-cell-index="1"]').click({ button: 'right' });
  const revisionAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('minepilot:persistence:head') ?? 'null').revision as number);
  expect(revisionAfter).toBe(revisionBefore + 1);
  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('[data-appearance="obstacle"]')).toHaveCount(1);
  await expect(page.locator('[data-cell-index="1"]')).toHaveAttribute('data-appearance', 'flagged');
});

test('controlled L2 committed move-away prompts once, F5 keeps Help without replay or hidden-cell leakage', async ({ page }) => {
  const saved = savedEntries('level-002');
  await install(page, saved.entries);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('.board-current-number')).toContainText(/Nearby mines: [1-8]/);
  await page.locator(`[data-cell-index="${saved.moveIndex}"]`).click();
  await expect(page.locator('.game-detail')).toContainText('The number belongs to your current cell');
  await expect(page.locator(`[data-cell-index="${saved.originIndex}"]`)).toHaveAttribute('data-appearance', 'explored');
  await expect(page.locator(`[data-cell-index="${saved.originIndex}"]`))
    .not.toHaveAttribute('aria-label', /Nearby mines:/);
  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('.game-detail')).not.toContainText('The number belongs to your current cell');
  await page.locator('[data-game-action="toggle-help"]').click();
  await expect(page.locator('.game-detail')).toContainText('The number belongs to your current cell');
  const unknown = page.locator('[data-appearance="unknown"]');
  expect(await unknown.count()).toBeGreaterThan(0);
  const labels = await unknown.evaluateAll((cells) => cells.map((cell) => cell.getAttribute('aria-label')));
  expect(new Set(labels.map((label) => label?.replace(/Row \d+, column \d+: /, ''))).size).toBe(1);
});

test('controlled L5 pending Mine and settled Failure show the frozen contextual help in browser', async ({ page }) => {
  const saved = savedEntries('level-005');
  await install(page, saved.entries);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.locator(`[data-cell-index="${saved.mineIndex}"]`).click();
  await expect(page.locator('.game-detail')).toContainText('A failed attempt can be retried');
  await page.locator('[data-game-action="failure"]').click();
  await expect(page.locator('[data-game-action="retry"]')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('.game-detail')).toContainText('A failed attempt can be retried');
});
