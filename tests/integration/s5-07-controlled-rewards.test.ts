import { describe, expect, it } from 'vitest';
import { createLevelCatalog, PRODUCTION_LEVEL_CATALOG, type LevelDefinitionInput } from '../../src/core/level-catalog';
import { createCompleteAttempt } from '../../src/core/stage4-attempt-factory';
import { createInitialStage4GameState, createStage4GameState } from '../../src/core/stage4-game-state';
import { mapStage4RuntimeToSaveV4 } from '../../src/core/persistence/stage4-runtime-mapping-v4';
import { validateSaveDocumentV4 } from '../../src/core/persistence/save-v4';
import { createRewardState } from '../../src/core/reward';
import { commitSnapshot, loadCommittedSnapshot, SNAPSHOT_STORAGE_KEYS } from '../../src/systems/persistence/crash-safe-snapshot-store';
import { loadProductionPersistedSave } from '../../src/systems/persistence/persistence-coordinator';
import { executeStage4MutationV4 } from '../../src/systems/persistence/production-stage4-mutation-v4';
import { createProductionStage4Session } from '../../src/systems/persistence/production-stage4-runtime';
import { commitCandidateWithWriterLeaseV4 } from '../../src/systems/persistence/guarded-persistence-v4';
import { acquireWriterLease } from '../../src/systems/persistence/writer-lease';
import { createPresentationRoot } from '../../src/presentation-root';
import type { PresentationSessionPort } from '../../src/systems/presentation/session-port';
import { MemoryStorage } from '../helpers/memory-storage';
import { gameTutorialContexts } from '../../src/ui/game-presentation';
import { boardBrowserSave } from '../helpers/s5-06-browser-save';

const identity = { sessionId: 'controlled-s5-07', leaseToken: 'controlled-token' };
const clock = { nowMs: () => 100 };
const technical = { nextRunId: () => 'next-run', nextGenerationSeed: () => 13, nextDetectionSeed: () => 31 };

function setup(rewardCount: number, selectedLevelId = 'level-004') {
  const base = PRODUCTION_LEVEL_CATALOG.levels[0]!;
  const levels: LevelDefinitionInput[] = [base, { ...base, levelId: 'level-002' },
    { ...base, levelId: 'level-003', board: { ...base.board,
      obstacleCoordinates: [{ x: 0, y: 0 }] } }, { ...base, levelId: 'level-004',
      board: { dimensions: { width: 3, height: 3 }, mineCount: 0, obstacleCoordinates: [] },
      rewards: { rewardCount, oneTimeClaimId: null,
        payloads: [{ weight: 100, payload: { kind: 'coins', amount: 1 } }] },
    }, { ...base, levelId: 'level-005' }];
  const created = createLevelCatalog(levels);
  if (created.status !== 'created') throw new Error('catalog fixture');
  const catalog = created.catalog;
  const selectedLevel = catalog.levels.find((level) => level.levelId === selectedLevelId);
  if (selectedLevel === undefined) throw new Error('selected level fixture');
  const made = createCompleteAttempt({ level: selectedLevel, runId: 'controlled-run',
    generationProvenance: { seed: 23, rngVersion: 'mulberry32-v1', generationVersion: 'mine-placement-v1' } });
  if (made.status !== 'created') throw new Error('attempt fixture');
  const initial = createInitialStage4GameState();
  const currentAttempt = made.attempt;
  const runtime = createStage4GameState({ ...initial, account: { ...initial.account,
    completedLevelIds: selectedLevelId === 'level-005'
      ? ['level-001', 'level-002', 'level-003', 'level-004'] : ['level-001', 'level-002', 'level-003'] }, currentAttempt });
  const mapped = mapStage4RuntimeToSaveV4(runtime, 0);
  if (mapped.status !== 'mapped') throw new Error('mapped fixture');
  const storage = new MemoryStorage();
  if (commitSnapshot(storage, JSON.stringify(mapped.document), 0).status !== 'committed') throw new Error('snapshot fixture');
  let authority = loadProductionPersistedSave(storage);
  const port: PresentationSessionPort = {
    read: () => authority,
    reload: () => { authority = loadProductionPersistedSave(storage); return authority; },
    execute(intent) {
      if (authority.status !== 'loaded' && authority.status !== 'fresh') return { status: 'rejected', reason: authority.status };
      const lease = acquireWriterLease(storage, identity, clock);
      if (lease.status !== 'acquired' && lease.status !== 'renewed') return { status: 'rejected', reason: lease.status };
      const result = executeStage4MutationV4(storage, intent, { commit(document, expectedRevision) {
        const saved = commitCandidateWithWriterLeaseV4(storage, identity, clock, expectedRevision, document);
        return saved.status === 'committed' ? { status: 'committed' as const } :
          { status: 'rejected' as const, reason: saved.status };
      } }, catalog);
      if (result.status === 'committed') authority = { status: 'loaded',
        persistence: { kind: 'committed', revision: result.revision, source: 'head', sourceSaveVersion: 4 },
        runtime: result.runtime };
      return result;
    },
  };
  return { root: createPresentationRoot(port, technical, null, catalog), storage, port, made };
}

/** Synthetic but strictly valid saved-state compatibility, not current Reward generation. */
function preloadedOneTimeV4() {
  const base = PRODUCTION_LEVEL_CATALOG.levels[0]!;
  const catalogResult = createLevelCatalog([base, { ...base, levelId: 'level-002' },
    { ...base, levelId: 'level-003' }, { ...base, levelId: 'level-004',
      board: { dimensions: { width: 3, height: 3 }, mineCount: 0, obstacleCoordinates: [] },
      rewards: { rewardCount: 1, oneTimeClaimId: null,
        payloads: [{ weight: 100, payload: { kind: 'coins', amount: 1 } }] } }]);
  if (catalogResult.status !== 'created') throw new Error('validated compatibility catalog');
  const catalog = catalogResult.catalog;
  const level = catalog.levels[3]!;
  const created = createCompleteAttempt({ level, runId: 'controlled-run',
    generationProvenance: { seed: 23, rngVersion: 'mulberry32-v1', generationVersion: 'mine-placement-v1' } });
  if (created.status !== 'created' || created.attempt.rewards.length !== 1) throw new Error('attempt fixture');
  const ordinary = created.attempt.rewards[0]!;
  const reward = createRewardState({ coordinate: ordinary.coordinate, payload: ordinary.payload,
    claimed: false, oneTimeClaimId: 'controlled-one-time-id' });
  const runtime = createStage4GameState({ ...createInitialStage4GameState(),
    account: { ...createInitialStage4GameState().account,
      completedLevelIds: ['level-001', 'level-002', 'level-003'] },
    currentAttempt: { ...created.attempt, rewards: [reward] } });
  const mapped = mapStage4RuntimeToSaveV4(runtime, 0);
  if (mapped.status !== 'mapped') throw new Error('v4 mapping');
  const validated = validateSaveDocumentV4(JSON.parse(JSON.stringify(mapped.document)) as unknown);
  if (validated.status !== 'validated') throw new Error('strict external v4 validation');
  const storage = new MemoryStorage();
  if (commitSnapshot(storage, JSON.stringify(validated.document), 0).status !== 'committed')
    throw new Error('preloaded committed v4 snapshot');
  const session = createProductionStage4Session(storage, identity, clock);
  const root = createPresentationRoot(session, technical, null, catalog);
  return { catalog, storage, session, root, runtime, document: validated.document, reward };
}

describe('S5-07 controlled catalog through guarded v4 execution and public projection', () => {
  it('loads the exact strictly validated browser compatibility fixtures before page execution', () => {
    for (const variant of ['one-time-l4', 'temporary-detection'] as const) {
      const fixture = boardBrowserSave(variant);
      const storage = new MemoryStorage();
      for (const [key, value] of fixture.entries) storage.data.set(key, value);
      const read = loadProductionPersistedSave(storage);
      expect(read.status).toBe('loaded');
      if (read.status !== 'loaded') continue;
      expect(read.persistence.sourceSaveVersion).toBe(4);
      expect(read.runtime.currentAttempt?.levelId).toBe(variant === 'one-time-l4' ? 'level-004' : 'level-001');
      if (variant === 'one-time-l4') {
        expect(read.runtime.currentAttempt?.rewards).toMatchObject([{ claimed: false,
          oneTimeClaimId: 'browser-l4-once', payload: { kind: 'coins', amount: 1 } }]);
        expect(read.runtime.account.oneTimeClaimIds).toEqual([]);
      } else {
        expect(read.runtime.currentAttempt?.temporaryBenbenCard).toEqual({ item: 'detection', consumed: false });
        expect(read.runtime.account.benbenByLevel).toMatchObject([{ status: 'used' }]);
      }
    }
  });
  it('reports two separately proven Rewards from one Airplane commit, with no F5 receipt replay', () => {
    const f = setup(2);
    expect(f.root.navigation.levels()?.map((entry) => entry.levelId))
      .toEqual(['level-001', 'level-002', 'level-003', 'level-004', 'level-005']);
    const result = f.root.submit({ kind: 'airplane', coordinate: { x: 1, y: 1 } });
    expect(result.status).toBe('committed');
    if (result.status !== 'committed' || result.snapshot.status === 'recovery') return;
    expect(result.rewardReceipt).toMatchObject({ status: 'proven', entries: [{ oneTime: false }, { oneTime: false }] });
    if (result.rewardReceipt?.status === 'proven') {
      const coordinates = result.rewardReceipt.entries.map((entry) => entry.coordinate.y * 3 + entry.coordinate.x);
      expect(coordinates).toEqual([...coordinates].sort((a, b) => a - b));
    }
    expect(result.snapshot.view.account.inventory.airplane).toBe(0);
    expect(result.snapshot.view.account.coins).toBe(2);
    expect(result.snapshot.view.attempt?.claimedRewards).toHaveLength(2);
    expect(loadCommittedSnapshot(f.storage)).toMatchObject({ status: 'loaded', revision: 1 });
    expect(f.root.reload()).toEqual(result.snapshot);
    expect(JSON.stringify(f.root.read())).not.toContain('oneTimeClaimId');
  });

  it('claims strictly validated preloaded v4 one-time Reward through the real production session once', () => {
    const f = preloadedOneTimeV4();
    const first = f.session.read();
    expect(first).toMatchObject({ status: 'loaded', persistence: { revision: 0, sourceSaveVersion: 4 },
      runtime: { account: { oneTimeClaimIds: [] } } });
    if (first.status !== 'loaded' || first.runtime.currentAttempt === null) throw new Error('preloaded runtime');
    expect(first.runtime).toEqual(f.runtime);
    const index = f.reward.coordinate.y * first.runtime.currentAttempt.run.board.dimensions.width + f.reward.coordinate.x;
    expect(first.runtime.currentAttempt.run.board.cells[index]).toMatchObject({ kind: 'safe', exploration: 'unexplored' });
    expect(f.reward.claimed).toBe(false);
    const result = f.root.submit({ kind: 'move', coordinate: f.reward.coordinate });
    expect(result.status).toBe('committed');
    if (result.status !== 'committed' || result.snapshot.status === 'recovery') return;
    expect(result.rewardReceipt).toMatchObject({ status: 'proven', entries: [{
      coordinate: f.reward.coordinate, payload: { kind: 'coins', amount: 1 }, oneTime: true }] });
    expect(JSON.stringify(result.snapshot)).not.toContain('controlled-one-time-id');
    expect(result.snapshot.view.account.coins).toBe(1);
    expect(result.snapshot.view.account.inventory).toEqual(f.runtime.account.inventory);
    expect(loadCommittedSnapshot(f.storage)).toMatchObject({ status: 'loaded', revision: 1 });
    const selected = loadCommittedSnapshot(f.storage);
    if (selected.status !== 'loaded') throw new Error('committed v4');
    expect(validateSaveDocumentV4(JSON.parse(selected.serializedPayload) as unknown))
      .toMatchObject({ status: 'validated', document: { saveVersion: 4, revision: 1 } });
    const writesBeforeReopen = f.storage.operations.filter((operation) => operation.startsWith('write:')).length;
    const reopened = createProductionStage4Session(f.storage, identity, clock).read();
    expect(reopened).toMatchObject({ status: 'loaded', persistence: { revision: 1, sourceSaveVersion: 4 },
      runtime: { account: { oneTimeClaimIds: ['controlled-one-time-id'], coins: 1 },
        currentAttempt: { rewards: [{ claimed: true, oneTimeClaimId: 'controlled-one-time-id' }] } } });
    if (reopened.status !== 'loaded') throw new Error('reopened v4');
    const published = f.session.read();
    if (published.status !== 'loaded') throw new Error('published v4');
    expect(reopened.runtime).toEqual(published.runtime);
    expect(f.root.reload().status).toBe('loaded');
    expect(f.root.read()).toEqual(result.snapshot);
    const freshRoot = createPresentationRoot(createProductionStage4Session(f.storage, identity, clock), technical,
      null, f.catalog);
    expect(freshRoot.read()).toEqual(result.snapshot);
    expect('rewardReceipt' in freshRoot.read()).toBe(false);
    expect(f.storage.operations.filter((operation) => operation.startsWith('write:'))).toHaveLength(writesBeforeReopen);
  });

  it('rejects malformed or contradictory preloaded one-time facts without weakening v4 validation', () => {
    const f = preloadedOneTimeV4();
    const conflict = structuredClone(f.document);
    (conflict.account.oneTimeClaimIds as string[]).push('controlled-one-time-id');
    expect(validateSaveDocumentV4(conflict).status).toBe('invalid');
    const malformed = structuredClone(f.document);
    (malformed.currentAttempt!.rewards[0] as { oneTimeClaimId: unknown }).oneTimeClaimId = 42;
    expect(validateSaveDocumentV4(malformed).status).toBe('invalid');
    const invalidGenerationInput: unknown = [{ ...f.catalog.levels[3]!, rewards: {
      ...f.catalog.levels[3]!.rewards, oneTimeClaimId: 'forbidden-generation',
    } }];
    expect(createLevelCatalog(invalidGenerationInput as LevelDefinitionInput[]).status).toBe('invalid');
  });

  it('never fabricates a receipt on domain rejection, stale revision or uncertain head result', () => {
    const rejected = preloadedOneTimeV4();
    const invalid = rejected.root.submit({ kind: 'move', coordinate: { x: -1, y: 0 } });
    expect(invalid.status).toBe('rejected');
    expect('rewardReceipt' in invalid).toBe(false);
    expect(loadCommittedSnapshot(rejected.storage)).toMatchObject({ status: 'loaded', revision: 0 });

    const stale = preloadedOneTimeV4();
    const competitor = createProductionStage4Session(stale.storage, identity, clock);
    const other = { x: (stale.reward.coordinate.x + 1) % 3, y: stale.reward.coordinate.y };
    expect(competitor.execute({ kind: 'flag', expectedRevision: 0, expectedRunId: 'controlled-run',
      coordinate: other, flagged: true }).status).toBe('committed');
    const staleResult = stale.root.submit({ kind: 'move', coordinate: stale.reward.coordinate });
    expect(staleResult).toMatchObject({ status: 'rejected', reason: 'revision-conflict' });
    expect('rewardReceipt' in staleResult).toBe(false);
    expect(createProductionStage4Session(stale.storage, identity, clock).read()).toMatchObject({ status: 'loaded',
      runtime: { account: { oneTimeClaimIds: [] }, currentAttempt: { rewards: [{ claimed: false }] } } });

    const uncertain = preloadedOneTimeV4();
    uncertain.storage.failNext('write', SNAPSHOT_STORAGE_KEYS.head);
    const uncertainResult = uncertain.root.submit({ kind: 'move', coordinate: uncertain.reward.coordinate });
    expect(uncertainResult).toMatchObject({ status: 'rejected', reason: 'commit-commit-outcome-uncertain' });
    expect('rewardReceipt' in uncertainResult).toBe(false);
    expect(uncertain.root.read().status).toBe('loaded');
    expect(createProductionStage4Session(uncertain.storage, identity, clock).read()).toMatchObject({ status: 'loaded',
      persistence: { revision: 0 }, runtime: { account: { oneTimeClaimIds: [] } } });
  });

  it('uses one validated L2-L5 catalog for execution and contextual public teaching', () => {
    for (const id of ['level-002', 'level-003', 'level-005']) {
      const f = setup(1, id);
      const first = f.root.read();
      if (first.status === 'recovery') throw new Error('public fixture');
      expect(first.view.attempt?.levelId).toBe(id);
      expect(f.root.navigation.levels()?.some((entry) => entry.levelId === id)).toBe(true);
      const contexts = gameTutorialContexts(first.view, null);
      if (id === 'level-003') {
        expect(first.view.attempt?.board.cells).toContain('obstacle');
        expect(contexts.prompt).toContain('l3-flag-misclick-protection');
        expect(contexts.prompt).toContain('first-obstacle');
      } else {
        expect(contexts.prompt).not.toContain('first-obstacle');
      }
      if (id === 'level-002') {
        expect(contexts.help).toContain('l2-number-hides-on-leave');
        expect(contexts.prompt).not.toContain('l2-number-hides-on-leave');
      }
      if (id === 'level-005') {
        const read = f.port.read();
        if (read.status !== 'loaded' || read.runtime.currentAttempt === null) throw new Error('L5 fixture');
        const board = read.runtime.currentAttempt.run.board;
        const mines = board.cells.map((cell, index) => cell.kind === 'mine' ? index : -1)
          .filter((index) => index >= 0);
        expect(mines.length).toBeGreaterThan(1);
        const coordinate = (index: number) => ({ x: index % board.dimensions.width,
          y: Math.floor(index / board.dimensions.width) });
        expect(f.root.submit({ kind: 'move', coordinate: coordinate(mines[0]!) }).status).toBe('committed');
        expect(f.root.submit({ kind: 'move', coordinate: coordinate(mines[1]!) }).status).toBe('committed');
        const pending = f.root.read();
        if (pending.status === 'recovery') throw new Error('L5 pending');
        expect(gameTutorialContexts(pending.view, null).prompt).toContain('l5-failure-retry-first-step-safety');
        expect(f.root.submit({ kind: 'failure' }).status).toBe('committed');
      }
    }
  });
});
