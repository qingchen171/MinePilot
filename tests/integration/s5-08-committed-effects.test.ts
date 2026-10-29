import { describe, expect, it } from 'vitest';
import { createPresentationRoot } from '../../src/presentation-root';
import { createProductionStage4Session } from '../../src/systems/persistence/production-stage4-runtime';
import { loadCommittedSnapshot, SNAPSHOT_STORAGE_KEYS } from '../../src/systems/persistence/crash-safe-snapshot-store';
import { WRITER_LEASE_STORAGE_KEY } from '../../src/systems/persistence/writer-lease';
import { MemoryStorage } from '../helpers/memory-storage';
import { boardBrowserSave } from '../helpers/s5-06-browser-save';
import { SHOP_PRICES } from '../../src/config/shop-prices';
import { validateShopCatalog } from '../../src/core/shop';
import { createInitialStage4GameState, createStage4GameState } from '../../src/core/stage4-game-state';
import { createStage4AccountState } from '../../src/core/stage4-account';
import { createBoard, createCellState } from '../../src/core/board';
import { createOnBoardPosition, createRunState } from '../../src/core/run';
import { mapStage4RuntimeToSaveV4 } from '../../src/core/persistence/stage4-runtime-mapping-v4';
import { validateSaveDocumentV4 } from '../../src/core/persistence/save-v4';
import { commitSnapshot } from '../../src/systems/persistence/crash-safe-snapshot-store';
import { loadProductionPersistedSave } from '../../src/systems/persistence/persistence-coordinator';

const identity = { sessionId: 'effect-owner', leaseToken: 'effect-token' };
const clock = { nowMs: () => 100 };
const technical = { nextRunId: () => 'effect-run', nextGenerationSeed: () => 123456789,
  nextDetectionSeed: () => 44 };
function fixture(storage = new MemoryStorage()) {
  const validated = validateShopCatalog(SHOP_PRICES);
  if (validated.status !== 'valid') throw new Error('Shop fixture');
  const session = createProductionStage4Session(storage, identity, clock, validated.catalog);
  return { storage, session, root: createPresentationRoot(session, technical, validated.catalog) };
}
function persisted(runtime: ReturnType<typeof createStage4GameState>) {
  const mapped = mapStage4RuntimeToSaveV4(runtime, 4);
  if (mapped.status !== 'mapped') throw new Error('v4 fixture mapping');
  const validated = validateSaveDocumentV4(JSON.parse(JSON.stringify(mapped.document)) as unknown);
  if (validated.status !== 'validated') throw new Error('strict v4 fixture validation');
  const storage = new MemoryStorage();
  if (commitSnapshot(storage, JSON.stringify(validated.document), 4).status !== 'committed')
    throw new Error('v4 fixture commit');
  return storage;
}

describe('S5-08 operation-bound evidence over real guarded Save v4', () => {
  it('delivers one detached handoff only from the exact committed operation, never read or reopen', () => {
    const f = fixture();
    expect(f.root.read()).toMatchObject({ status: 'fresh' });
    const result = f.root.submit({ kind: 'start', levelId: 'level-001' });
    expect(result.status).toBe('committed');
    if (result.status !== 'committed') return;
    const handoff = result.effectHandoff!;
    expect(handoff).toMatchObject({ kind: 'start', before: { attempt: null }, after: { attempt: { levelId: 'level-001' } } });
    expect(Object.isFrozen(handoff.before.account.inventory)).toBe(true);
    expect(Object.isFrozen(handoff.after.attempt?.board.cells)).toBe(true);
    expect(JSON.stringify(handoff)).not.toMatch(/effect-run|123456789|oneTimeClaimId|baseSeed|runId/);
    expect(f.root.takeEffect(result)).toMatchObject({ operationId: handoff.operationId, kind: 'saved' });
    expect(f.root.takeEffect(result)).toBeNull();
    expect(f.root.takeEffect({ status: 'committed', effectHandoff: { ...handoff, operationId: 'forged' } })).toBeNull();
    expect(f.root.read()).toEqual(result.snapshot);
    expect(f.root.reload()).toEqual(result.snapshot);
    expect(fixture(f.storage).root.read())
      .toEqual(result.snapshot);
    expect(loadCommittedSnapshot(f.storage)).toMatchObject({ status: 'loaded', revision: 0 });
  });

  it('preserves original envelope identity through an exact, user-initiated precommit Retry', () => {
    const f = fixture();
    f.storage.failNext('read', WRITER_LEASE_STORAGE_KEY);
    const rejected = f.root.submit({ kind: 'start', levelId: 'level-001' });
    expect(rejected).toMatchObject({ status: 'rejected', policy: { retainEnvelope: true } });
    expect(f.root.takeEffect(rejected)).toBeNull();
    f.root.markAuthorityDirty();
    expect(f.root.submit({ kind: 'start', levelId: 'level-001' })).toMatchObject({ status: 'unavailable' });
    const retry = f.root.retryRetained();
    expect(retry.status).toBe('committed');
    if (retry.status !== 'committed') return;
    expect(retry.effectHandoff).toMatchObject({ operationId: 'operation-1', kind: 'start' });
    expect(f.root.authorityIsDirty()).toBe(false);
    expect(f.root.takeEffect(retry)?.operationId).toBe('operation-1');
    expect(f.root.takeEffect(retry)).toBeNull();
    expect(loadCommittedSnapshot(f.storage)).toMatchObject({ status: 'loaded', revision: 0 });
  });

  it('an external invalidation preserves precisely owned Game and Shop tutorial Retry until explicit choice', () => {
    const game = fixture();
    expect(game.root.submit({ kind: 'start', levelId: 'level-001' }).status).toBe('committed');
    game.storage.failNext('read', WRITER_LEASE_STORAGE_KEY);
    expect(game.root.submit({ kind: 'flag', coordinate: { x: 0, y: 0 }, flagged: true }))
      .toMatchObject({ status: 'rejected', policy: { retainEnvelope: true } });
    expect(game.root.gameRetryAvailable()).toBe(true);
    game.root.markAuthorityDirty();
    expect(game.root.gameRetryAvailable()).toBe(true);
    expect(game.root.submit({ kind: 'detection' })).toMatchObject({ status: 'unavailable' });
    const retried = game.root.gameRetry();
    expect(retried).toMatchObject({ status: 'committed', effectHandoff: { operationId: 'operation-2', kind: 'flag' } });
    expect(game.root.authorityIsDirty()).toBe(false);

    const shop = fixture();
    expect(shop.root.navigation.navigate('shop').status).toBe('navigated');
    shop.storage.failNext('read', WRITER_LEASE_STORAGE_KEY);
    expect(shop.root.submit({ kind: 'acknowledge-tutorial', milestoneId: 'first-shop' }))
      .toMatchObject({ status: 'rejected', policy: { retainEnvelope: true } });
    shop.root.markAuthorityDirty();
    expect(shop.root.shopTutorialRetryAvailable()).toBe(true);
    expect(shop.root.shopTutorialRetry()).toMatchObject({ status: 'committed', effectHandoff: { kind: 'acknowledge-tutorial' } });
    expect(shop.root.authorityIsDirty()).toBe(false);
  });

  it('rejects stale/uncertain commits without handoff or fictional receipt', () => {
    const stale = fixture();
    expect(fixture(stale.storage).root.submit({ kind: 'start', levelId: 'level-001' }).status).toBe('committed');
    const result = stale.root.submit({ kind: 'start', levelId: 'level-001' });
    expect(result).toMatchObject({ status: 'rejected', reason: 'revision-conflict' });
    expect(stale.root.takeEffect(result)).toBeNull();
    const uncertain = fixture();
    uncertain.storage.failNext('write', SNAPSHOT_STORAGE_KEYS.head);
    const unproved = uncertain.root.submit({ kind: 'start', levelId: 'level-001' });
    expect(unproved).toMatchObject({ status: 'rejected', reason: 'commit-commit-outcome-uncertain' });
    expect(uncertain.root.takeEffect(unproved)).toBeNull();
    expect(uncertain.root.retryRetained()).toMatchObject({ status: 'unavailable' });
  });

  it('offers Reward celebration only for a real same-operation receipt and never for reopened facts', () => {
    const saved = boardBrowserSave('waiting');
    expect(saved.rewardTarget).not.toBeNull();
    const storage = new MemoryStorage();
    for (const [key, value] of saved.entries) storage.data.set(key, value);
    const f = fixture(storage);
    const outcome = f.root.submit({ kind: 'move', coordinate: saved.rewardTarget! });
    expect(outcome.status).toBe('committed');
    if (outcome.status !== 'committed') return;
    expect(outcome.rewardReceipt).toMatchObject({ status: 'proven', entries: [{}] });
    expect(f.root.takeEffect(outcome)).toMatchObject({ kind: 'reward', rewardCount: 1 });
    expect(f.root.takeEffect(outcome)).toBeNull();
    const reopened = fixture(storage).root;
    expect(reopened.read()).toEqual(outcome.snapshot);
    expect(loadCommittedSnapshot(storage)).toMatchObject({ status: 'loaded' });
  });

  it('projects proven Lucky, pending, Revive, Detection, Benben and Failure cues from guarded commands', () => {
    const f = fixture();
    expect(f.root.submit({ kind: 'start', levelId: 'level-001' }).status).toBe('committed');
    const loaded = f.session.read();
    if (loaded.status !== 'loaded' || loaded.runtime.currentAttempt === null) throw new Error('fixture');
    const board = loaded.runtime.currentAttempt.run.board;
    const mines = board.cells.flatMap((cell, index) => cell.kind === 'mine' ? [index] : []);
    const target = (index: number) => ({ x: index % board.dimensions.width, y: Math.floor(index / board.dimensions.width) });
    const lucky = f.root.submit({ kind: 'move', coordinate: target(mines[0]!) });
    expect(lucky).toMatchObject({ status: 'committed', firstLucky: true });
    expect(f.root.takeEffect(lucky)).toMatchObject({ kind: 'lucky' });
    const pending = f.root.submit({ kind: 'move', coordinate: target(mines[1]!) });
    expect(pending.status).toBe('committed');
    expect(f.root.takeEffect(pending)).toMatchObject({ kind: 'pending',
      requestedTarget: target(mines[1]!), committedDestination: target(mines[0]!), effectAnchor: target(mines[1]!) });
    const revive = f.root.submit({ kind: 'revive' });
    expect(revive.status).toBe('committed');
    expect(f.root.takeEffect(revive)).toMatchObject({ kind: 'revive' });

    const loadVariant = (variant: 'detection-rich' | 'benben-available' | 'pending') => {
      const saved = boardBrowserSave(variant); const storage = new MemoryStorage();
      for (const [key, value] of saved.entries) storage.data.set(key, value);
      return fixture(storage).root;
    };
    const detection = loadVariant('detection-rich');
    const scanned = detection.submit({ kind: 'detection' });
    expect(scanned.status).toBe('committed');
    expect(detection.takeEffect(scanned)).toMatchObject({ kind: 'detection' });
    const benben = loadVariant('benben-available');
    const claimed = benben.submit({ kind: 'claim-benben' });
    expect(claimed.status).toBe('committed');
    expect(benben.takeEffect(claimed)).toMatchObject({ kind: 'benben' });
    const failure = loadVariant('pending');
    const settled = failure.submit({ kind: 'failure' });
    expect(settled.status).toBe('committed');
    expect(failure.takeEffect(settled)).toMatchObject({ kind: 'failure' });
  });

  it('proves Airplane and final-Safe victory from exact guarded production operations', () => {
    const airplane = fixture();
    expect(airplane.root.submit({ kind: 'start', levelId: 'level-001' }).status).toBe('committed');
    const flew = airplane.root.submit({ kind: 'airplane', coordinate: { x: 0, y: 0 } });
    expect(flew.status).toBe('committed');
    if (flew.status !== 'committed') return;
    expect(flew.effectHandoff).toMatchObject({ kind: 'airplane', target: { x: 0, y: 0 } });
    expect(airplane.root.takeEffect(flew)?.kind).toMatch(/^(airplane|reward)$/);
    expect(airplane.root.takeEffect(flew)).toBeNull();
    expect(loadCommittedSnapshot(airplane.storage)).toMatchObject({ status: 'loaded', revision: 1 });

    const wonSnapshot = boardBrowserSave('won');
    const source = new MemoryStorage();
    for (const [key, value] of wonSnapshot.entries) source.data.set(key, value);
    const loaded = loadProductionPersistedSave(source);
    if (loaded.status !== 'loaded' || loaded.runtime.currentAttempt === null) throw new Error('won fixture');
    const old = loaded.runtime.currentAttempt;
    const board = old.run.board;
    const last = board.cells.findIndex((cell, index) => cell.kind === 'safe' &&
      !old.rewards.some((reward) => reward.coordinate.x === index % board.dimensions.width &&
        reward.coordinate.y === Math.floor(index / board.dimensions.width)));
    const position = board.cells.findIndex((cell, index) => cell.kind === 'safe' && index !== last);
    if (last < 0 || position < 0) throw new Error('final Safe fixture');
    const cells = board.cells.map((cell, index) => index === last
      ? createCellState({ terrain: 'playable', containsMine: false, explored: false,
        mineRevealed: false, flagged: false }) : cell);
    const nearWinBoard = createBoard(board.dimensions, cells);
    const run = createRunState(nearWinBoard,
      createOnBoardPosition({ x: position % board.dimensions.width,
        y: Math.floor(position / board.dimensions.width) }), { hasTakenStep: true });
    const runtime = createStage4GameState({ ...loaded.runtime,
      account: { ...loaded.runtime.account, completedLevelIds: [] },
      currentAttempt: { ...old, run, terminalDisposition: 'not-applicable' } });
    const win = fixture(persisted(runtime));
    const result = win.root.submit({ kind: 'move', coordinate: { x: last % board.dimensions.width,
      y: Math.floor(last / board.dimensions.width) } });
    expect(result).toMatchObject({ status: 'committed', snapshot: { status: 'loaded',
      view: { attempt: { phase: 'won' } } } });
    if (result.status !== 'committed') return;
    expect(win.root.takeEffect(result)?.kind).toBe('victory');
    expect(win.root.takeEffect(result)).toBeNull();
  });

  it('keeps Shop and Settings committed handoffs generic and never infers a Reward', () => {
    const initial = createInitialStage4GameState();
    const storage = persisted(createStage4GameState({ ...initial,
      account: createStage4AccountState({ ...initial.account, coins: 20 }), currentAttempt: null }));
    const f = fixture(storage);
    const purchased = f.root.shopPurchase('airplane');
    expect(purchased).toMatchObject({ status: 'committed', snapshot: { status: 'loaded',
      view: { account: { coins: 12, inventory: { airplane: 2 } } } } });
    if (purchased?.status !== 'committed') return;
    expect(purchased.effectHandoff).toMatchObject({ kind: 'purchase', before: { attempt: null },
      after: { attempt: null } });
    expect(f.root.takeEffect(purchased)?.kind).toBe('saved');
    expect(f.root.takeEffect(purchased)).toBeNull();
    const settings = f.root.submit({ kind: 'set-setting', key: 'musicEnabled', enabled: false });
    expect(settings).toMatchObject({ status: 'committed', snapshot: { status: 'loaded',
      view: { settings: { musicEnabled: false } } } });
    if (settings.status !== 'committed') return;
    expect(settings.effectHandoff).toMatchObject({ kind: 'set-setting' });
    expect(f.root.takeEffect(settings)?.kind).toBe('saved');
    expect(f.root.takeEffect(settings)).toBeNull();
    expect(fixture(storage).root.read()).toEqual(settings.snapshot);
  });
});
