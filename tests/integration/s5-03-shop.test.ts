import { describe, expect, it, vi } from 'vitest';
import { SHOP_PRICES } from '../../src/config/shop-prices';
import { validateShopCatalog } from '../../src/core/shop';
import { createInitialStage4AccountState, createStage4AccountState } from '../../src/core/stage4-account';
import { createInitialStage4GameState, createStage4GameState } from '../../src/core/stage4-game-state';
import { createInitialBoard } from '../../src/core/initial-board';
import { createBoard, createCellState } from '../../src/core/board';
import { createOnBoardPosition, createRunState, createWaitingPosition } from '../../src/core/run';
import { createInitialRunItemState } from '../../src/core/run-item-state';
import { mapStage4RuntimeToSaveV3 } from '../../src/core/persistence/stage4-runtime-mapping';
import { commitSnapshot, loadCommittedSnapshot, SNAPSHOT_STORAGE_KEYS } from '../../src/systems/persistence/crash-safe-snapshot-store';
import { createProductionStage4Session } from '../../src/systems/persistence/production-stage4-runtime';
import { MemoryStorage } from '../helpers/memory-storage';
import { serializeSaveDocumentV1 } from '../../src/core/persistence/save-v1';
import { serializeSaveDocumentV2 } from '../../src/core/persistence/save-v2';
import { emptySaveCandidateV2 } from '../helpers/save-v2';
import { createPresentationRoot } from '../../src/presentation-root';
import { createCompleteAttempt } from '../../src/core/stage4-attempt-factory';
import { PRODUCTION_LEVEL_CATALOG } from '../../src/core/level-catalog';

const checked = validateShopCatalog(SHOP_PRICES);
if (checked.status !== 'valid') throw new Error('Shop config');
const catalog = checked.catalog;
const owner = { sessionId: 'shop-owner', leaseToken: 'shop-token' };
const clock = { nowMs: () => 100 };

function seeded(coins: number, inventoryOverride: Record<string, number> = {}) {
  const storage = new MemoryStorage();
  const initial = createInitialStage4AccountState();
  const runtime = createStage4GameState({ ...createInitialStage4GameState(),
    account: createStage4AccountState({ ...initial, coins,
      inventory: { ...initial.inventory, ...inventoryOverride },
      completedLevelIds: ['completed-a'], oneTimeClaimIds: ['claim-a'],
      benbenByLevel: [{ levelId: 'level-001', failureStreak: 2, status: 'unavailable' }],
    }), currentAttempt: null,
  });
  const mapped = mapStage4RuntimeToSaveV3(runtime, 4);
  if (mapped.status !== 'mapped') throw new Error('v3 fixture');
  expect(commitSnapshot(storage, JSON.stringify(mapped.document), 4).status).toBe('committed');
  return { storage, session: createProductionStage4Session(storage, owner, clock, catalog) };
}

function purchase(revision: number | null, item: unknown, expectedRunId: string | null = null) {
  return { kind: 'purchase' as const, item, expectedRevision: revision, expectedRunId };
}
const snapshotWrite = (operation: string) => Object.values(SNAPSHOT_STORAGE_KEYS)
  .some((key) => operation === `write:${key}`);

describe('S5-03 Shop production authority', () => {
  it('commits exactly one item and a trusted debit through v3, then reopens the complete Account', () => {
    const { storage, session } = seeded(20);
    const before = session.read();
    expect(before.status).toBe('loaded');
    const result = session.execute(purchase(4, 'airplane'));
    expect(result).toMatchObject({ status: 'committed', revision: 5, runtime: { account: { coins: 12, inventory: { airplane: 2 } }, currentAttempt: null } });
    const reopened = createProductionStage4Session(storage, owner, clock, catalog).read();
    expect(reopened).toMatchObject({ status: 'loaded', persistence: { revision: 5, sourceSaveVersion: 4 }, runtime: {
      account: { coins: 12, inventory: { airplane: 2 }, completedLevelIds: ['completed-a'], oneTimeClaimIds: ['claim-a'],
        benbenByLevel: [{ levelId: 'level-001', failureStreak: 2, status: 'unavailable' }] },
      currentAttempt: null,
    } });
    expect(before).toMatchObject({ runtime: { account: { coins: 20, inventory: { airplane: 1 } } } });
    expect(session.execute(purchase(5, 'airplane'))).toMatchObject({ status: 'committed', revision: 6, runtime: { account: { coins: 4, inventory: { airplane: 3 } } } });
  });

  it('rejects insufficient, invalid and overflow without snapshot writes or publishable candidate', () => {
    for (const [coins, item, inventory, reason] of [
      [0, 'lucky', {}, 'insufficient-coins'], [10, 'bogus', {}, 'invalid-shop-item'],
      [1, 'lucky', { lucky: Number.MAX_SAFE_INTEGER }, 'inventory-overflow'],
    ] as const) {
      const { storage, session } = seeded(coins, inventory);
      const before = loadCommittedSnapshot(storage);
      const writes = storage.operations.filter(snapshotWrite).length;
      expect(session.execute(purchase(4, item))).toEqual({ status: 'rejected', reason });
      expect(loadCommittedSnapshot(storage)).toEqual(before);
      expect(storage.operations.filter(snapshotWrite).length).toBe(writes);
      expect(session.read()).toMatchObject({ status: 'loaded', persistence: { revision: 4 } });
    }
  });

  it('rejects every non-null Attempt phase before any purchase; forged runId remains a guard conflict', () => {
    const base = createInitialBoard({ dimensions: { width: 2, height: 1 }, mineCoordinates: [{ x: 1, y: 0 }], obstacleCoordinates: [] });
    if (base.status !== 'created') throw new Error('board fixture');
    for (const phase of ['active', 'pending-mine-encounter', 'failed', 'won'] as const) {
      const board = phase === 'won' ? createBoard(base.board.dimensions, [
        createCellState({ terrain: 'playable', containsMine: false, explored: true, mineRevealed: false, flagged: false }),
        base.board.cells[1]!,
      ]) : base.board;
      const run = createRunState(board, phase === 'won' ? createOnBoardPosition({ x: 0, y: 0 }) : createWaitingPosition(), {
        hasTakenStep: phase !== 'active', phase: phase === 'active' || phase === 'won' ? { kind: phase } : {
          kind: phase, encounter: { target: { x: 1, y: 0 }, occurredOnFirstStep: true },
        },
      });
      const initial = createInitialStage4AccountState();
      const runtime = createStage4GameState({ ...createInitialStage4GameState(),
        account: createStage4AccountState({ ...initial, coins: 20, completedLevelIds: phase === 'won' ? ['level-001'] : [] }),
        currentAttempt: {
          runId: 'shop-run', levelId: 'level-001', generationProvenance: null, run,
          runItems: createInitialRunItemState(null), rewards: [], temporaryBenbenCard: null,
          terminalDisposition: phase === 'won' || phase === 'failed' ? 'settled' : 'not-applicable',
        },
      });
      const storage = new MemoryStorage();
      const mapped = mapStage4RuntimeToSaveV3(runtime, 4);
      if (mapped.status !== 'mapped') throw new Error(`mapped ${phase}`);
      expect(commitSnapshot(storage, JSON.stringify(mapped.document), 4).status).toBe('committed');
      const session = createProductionStage4Session(storage, owner, clock, catalog);
      expect(session.execute(purchase(4, 'lucky', 'shop-run'))).toEqual({ status: 'rejected', reason: 'shop-requires-account-only' });
      expect(session.execute(purchase(4, 'lucky'))).toEqual({ status: 'rejected', reason: 'run-id-conflict' });
      expect(loadCommittedSnapshot(storage)).toMatchObject({ status: 'loaded', revision: 4 });
    }
  });

  it('preserves old authority on stale revision, competing lease and uncertain head outcome', () => {
    const { storage, session } = seeded(2);
    expect(session.execute(purchase(3, 'lucky'))).toEqual({ status: 'rejected', reason: 'revision-conflict' });
    const competing = createProductionStage4Session(storage, { sessionId: 'other', leaseToken: 'other' }, clock, catalog);
    expect(session.execute(purchase(4, 'lucky'))).toMatchObject({ status: 'committed', revision: 5 });
    expect(competing.execute(purchase(4, 'lucky'))).toEqual({ status: 'rejected', reason: 'owned-by-another-session' });
    const before = session.read();
    storage.failNext('write', SNAPSHOT_STORAGE_KEYS.head);
    expect(session.execute(purchase(5, 'lucky'))).toEqual({ status: 'rejected', reason: 'commit-commit-outcome-uncertain' });
    expect(session.read()).toBe(before);
  });

  it('does not publish a complete purchase candidate when the inactive slot write fails', () => {
    const { storage, session } = seeded(2);
    const before = session.read();
    const committed = loadCommittedSnapshot(storage);
    if (committed.status !== 'loaded') throw new Error('snapshot fixture');
    storage.failNext('write', committed.slot === 'A' ? SNAPSHOT_STORAGE_KEYS.slotB : SNAPSHOT_STORAGE_KEYS.slotA);
    expect(session.execute(purchase(4, 'lucky'))).toEqual({ status: 'rejected', reason: 'commit-persistence-commit-failure' });
    expect(session.read()).toBe(before);
    expect(loadCommittedSnapshot(storage)).toEqual(committed);
  });

  it('keeps Shop persistence failure conservative and never replays an uncertain purchase', () => {
    const first = seeded(3);
    const technical = { nextRunId: () => 'unused', nextGenerationSeed: () => 0, nextDetectionSeed: () => 0 };
    const root = createPresentationRoot(first.session, technical, catalog);
    const committed = loadCommittedSnapshot(first.storage);
    if (committed.status !== 'loaded') throw new Error('snapshot fixture');
    first.storage.failNext('write', committed.slot === 'A' ? SNAPSHOT_STORAGE_KEYS.slotB : SNAPSHOT_STORAGE_KEYS.slotA);
    expect(root.shopPurchase('lucky')).toMatchObject({ status: 'rejected',
      reason: 'commit-persistence-commit-failure', policy: { category: 'pre-commit-discard', retainEnvelope: false } });
    expect(root.shopActions()).toMatchObject({ retry: false, reload: true });
    expect(root.shopRetryRetained()).toMatchObject({ status: 'unavailable', reason: 'operation-unresolved' });
    expect(first.session.read()).toMatchObject({ status: 'loaded', runtime: { account: { coins: 3 } } });

    const second = seeded(3);
    const uncertain = createPresentationRoot(second.session, technical, catalog);
    second.storage.failNext('write', SNAPSHOT_STORAGE_KEYS.head);
    expect(uncertain.shopPurchase('lucky')).toMatchObject({ status: 'rejected',
      reason: 'commit-commit-outcome-uncertain', policy: { category: 'uncertain', retainEnvelope: false } });
    expect(uncertain.shopRetryRetained()).toMatchObject({ status: 'unavailable', reason: 'operation-unresolved' });
    expect(uncertain.shopActions()).toMatchObject({ retry: false, reload: true });
  });

  it('invalid config disables purchase without altering other production capabilities', () => {
    const { storage } = seeded(5);
    const session = createProductionStage4Session(storage, owner, clock, null);
    const beforeOperations = storage.operations.length;
    expect(session.execute(purchase(4, 'lucky'))).toEqual({ status: 'rejected', reason: 'invalid-request' });
    expect(storage.operations.slice(beforeOperations)).toEqual([]);
    expect(session.read()).toMatchObject({ status: 'loaded', runtime: { account: { coins: 5 } } });
    const root = createPresentationRoot(session, { nextRunId: () => 'unused', nextGenerationSeed: () => 0,
      nextDetectionSeed: () => 0 }, null);
    expect(root.read()).toMatchObject({ status: 'loaded', view: { shop: { status: 'unavailable', offers: [] } } });
  });

  it('uses one validated catalog for authority and advisory projection with no technical entropy draw', () => {
    const { storage, session } = seeded(8);
    const technical = { nextRunId: vi.fn(() => 'never'), nextGenerationSeed: vi.fn(() => 0), nextDetectionSeed: vi.fn(() => 0) };
    const root = createPresentationRoot(session, technical, catalog);
    expect(root.read()).toMatchObject({ status: 'loaded', view: { shop: { status: 'available', offers: [
      { item: 'lucky', price: 1, affordable: true }, { item: 'detection', price: 2, affordable: true },
      { item: 'revive', price: 4, affordable: true }, { item: 'airplane', price: 8, affordable: true },
    ] } } });
    const result = root.shopPurchase('airplane');
    expect(result).toMatchObject({ status: 'committed', snapshot: { view: { account: { coins: 0 } } } });
    if (result?.status !== 'committed') throw new Error('purchase fixture');
    expect(result.snapshot.status).toBe('loaded');
    if (result.snapshot.status !== 'loaded') throw new Error('projection fixture');
    expect(result.snapshot.view.shop.offers.every((offer) => !offer.affordable)).toBe(true);
    expect(root.shopPurchase('airplane')).toBeNull();
    expect(root.read()).toMatchObject({ status: 'loaded', view: { account: { coins: 0 } } });
    expect(loadCommittedSnapshot(storage)).toMatchObject({ status: 'loaded', revision: 5 });
    expect(technical.nextRunId).not.toHaveBeenCalled();
    expect(technical.nextGenerationSeed).not.toHaveBeenCalled();
    expect(technical.nextDetectionSeed).not.toHaveBeenCalled();
  });

  it('earns a real coin after fresh/v1/v2 read, then buys via v3 and reopens without migration writeback', () => {
    const level = PRODUCTION_LEVEL_CATALOG.levels[0]!;
    let coinSeed: number | null = null;
    for (let seed = 0; seed < 100; seed++) {
      const made = createCompleteAttempt({ level, runId: 'shop-reward-run', generationProvenance: {
        seed, rngVersion: 'mulberry32-v1', generationVersion: 'mine-placement-v1',
      } });
      if (made.status === 'created' && made.attempt.rewards.some((reward) => reward.payload.kind === 'coins')) {
        coinSeed = seed;
        break;
      }
    }
    if (coinSeed === null) throw new Error('Coin Reward fixture');
    for (const source of ['fresh', 'v1', 'v2'] as const) {
      const storage = new MemoryStorage();
      if (source !== 'fresh') {
        const serialized = source === 'v1'
          ? serializeSaveDocumentV1({ revision: 4, activeRun: null })
          : serializeSaveDocumentV2(emptySaveCandidateV2(4));
        if (serialized.status !== 'serialized') throw new Error('legacy save fixture');
        expect(commitSnapshot(storage, JSON.stringify(serialized.document), 4).status).toBe('committed');
      }
      const session = createProductionStage4Session(storage, owner, clock, catalog);
      const initial = session.read();
      expect(initial.status).toBe(source === 'fresh' ? 'fresh' : 'loaded');
      const oldRevision = source === 'fresh' ? null : 4;
      expect(session.execute(purchase(oldRevision, 'lucky'))).toEqual({ status: 'rejected', reason: 'insufficient-coins' });
      const started = session.execute({ kind: 'start', levelId: 'level-001', expectedRevision: oldRevision,
        expectedRunId: null, creation: { runId: `shop-${source}-run`, baseSeed: coinSeed,
          rngVersion: 'mulberry32-v1', generationVersion: 'mine-placement-v1' } });
      if (started.status !== 'committed' || started.runtime.currentAttempt === null) throw new Error('start fixture');
      const coinReward = started.runtime.currentAttempt.rewards.find((reward) => reward.payload.kind === 'coins');
      if (coinReward === undefined) throw new Error('coin reward');
      const moved = session.execute({ kind: 'move', coordinate: coinReward.coordinate,
        expectedRevision: started.revision, expectedRunId: `shop-${source}-run` });
      if (moved.status !== 'committed') throw new Error(`coin move: ${JSON.stringify(moved)}`);
      expect(moved.runtime.account.coins).toBeGreaterThanOrEqual(1);
      const abandoned = session.execute({ kind: 'abandon', expectedRevision: moved.revision, expectedRunId: `shop-${source}-run` });
      if (abandoned.status !== 'committed') throw new Error(`abandon: ${JSON.stringify(abandoned)}`);
      const bought = session.execute(purchase(abandoned.revision, 'lucky'));
      expect(bought).toMatchObject({ status: 'committed', runtime: { currentAttempt: null } });
      if (bought.status !== 'committed') return;
      const reopened = createProductionStage4Session(storage, owner, clock, catalog).read();
      expect(reopened).toMatchObject({ status: 'loaded', persistence: { revision: bought.revision, sourceSaveVersion: 4 },
        runtime: { account: { inventory: { lucky: bought.runtime.account.inventory.lucky }, coins: bought.runtime.account.coins } } });
    }
  });
});
