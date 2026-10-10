import { describe, expect, it } from 'vitest';
import { createLevelCatalog, PRODUCTION_LEVEL_CATALOG } from '../../src/core/level-catalog';
import { createCompleteAttempt } from '../../src/core/stage4-attempt-factory';
import { createInitialStage4GameState, createStage4GameState } from '../../src/core/stage4-game-state';
import { mapStage4RuntimeToSaveV4 } from '../../src/core/persistence/stage4-runtime-mapping-v4';
import { commitSnapshot, loadCommittedSnapshot } from '../../src/systems/persistence/crash-safe-snapshot-store';
import { loadProductionPersistedSave } from '../../src/systems/persistence/persistence-coordinator';
import { executeStage4MutationV4 } from '../../src/systems/persistence/production-stage4-mutation-v4';
import { commitCandidateWithWriterLeaseV4 } from '../../src/systems/persistence/guarded-persistence-v4';
import { acquireWriterLease } from '../../src/systems/persistence/writer-lease';
import { createPresentationRoot } from '../../src/presentation-root';
import type { PresentationSessionPort } from '../../src/systems/presentation/session-port';
import { MemoryStorage } from '../helpers/memory-storage';

const identity = { sessionId: 'controlled-s5-07', leaseToken: 'controlled-token' };
const clock = { nowMs: () => 100 };
const technical = { nextRunId: () => 'next-run', nextGenerationSeed: () => 13, nextDetectionSeed: () => 31 };

function setup(rewardCount: number, oneTimeClaimId: string | null) {
  const base = PRODUCTION_LEVEL_CATALOG.levels[0]!;
  const created = createLevelCatalog([base, { ...base, levelId: 'level-002' },
    { ...base, levelId: 'level-003' }, { ...base, levelId: 'level-004',
      board: { dimensions: { width: 3, height: 3 }, mineCount: 0, obstacleCoordinates: [] },
      rewards: { rewardCount, oneTimeClaimId: null,
        payloads: [{ weight: 100, payload: { kind: 'coins', amount: 1 } }] },
    }, { ...base, levelId: 'level-005' }]);
  if (created.status !== 'created') throw new Error('catalog fixture');
  const catalog = created.catalog;
  const made = createCompleteAttempt({ level: catalog.levels[3]!, runId: 'controlled-run',
    generationProvenance: { seed: 23, rngVersion: 'mulberry32-v1', generationVersion: 'mine-placement-v1' } });
  if (made.status !== 'created') throw new Error('attempt fixture');
  const initial = createInitialStage4GameState();
  const currentAttempt = oneTimeClaimId === null ? made.attempt : { ...made.attempt,
    rewards: made.attempt.rewards.map((reward, index) => index === 0
      ? { ...reward, oneTimeClaimId } : reward),
  };
  const runtime = createStage4GameState({ ...initial, account: { ...initial.account,
    completedLevelIds: ['level-001', 'level-002', 'level-003'] }, currentAttempt });
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

describe('S5-07 controlled catalog through guarded v4 execution and public projection', () => {
  it('reports two separately proven Rewards from one Airplane commit, with no F5 receipt replay', () => {
    const f = setup(2, null);
    expect(f.root.navigation.levels()?.map((entry) => entry.levelId))
      .toEqual(['level-001', 'level-002', 'level-003', 'level-004', 'level-005']);
    const result = f.root.submit({ kind: 'airplane', coordinate: { x: 1, y: 1 } });
    expect(result.status).toBe('committed');
    if (result.status !== 'committed' || result.snapshot.status === 'recovery') return;
    expect(result.rewardReceipt).toMatchObject({ status: 'proven', entries: [{ oneTime: false }, { oneTime: false }] });
    expect(result.snapshot.view.account.inventory.airplane).toBe(0);
    expect(result.snapshot.view.account.coins).toBe(2);
    expect(result.snapshot.view.attempt?.claimedRewards).toHaveLength(2);
    expect(loadCommittedSnapshot(f.storage)).toMatchObject({ status: 'loaded', revision: 1 });
    expect(f.root.reload()).toEqual(result.snapshot);
    expect(JSON.stringify(f.root.read())).not.toContain('oneTimeClaimId');
  });

  it('keeps one-time Reward ID private while synchronizing Account claim across reopen', () => {
    const f = setup(1, 'controlled-one-time-id');
    const result = f.root.submit({ kind: 'airplane', coordinate: { x: 1, y: 1 } });
    expect(result.status).toBe('committed');
    if (result.status !== 'committed' || result.snapshot.status === 'recovery') return;
    expect(result.rewardReceipt).toMatchObject({ status: 'proven', entries: [{ oneTime: true }] });
    expect(JSON.stringify(result.snapshot)).not.toContain('controlled-one-time-id');
    expect(f.port.reload()).toMatchObject({ status: 'loaded', runtime: { account: {
      oneTimeClaimIds: ['controlled-one-time-id'],
    } } });
    expect(f.root.reload().status).toBe('loaded');
    expect(f.root.read()).toEqual(result.snapshot);
  });
});
