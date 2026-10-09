import { describe, expect, it, vi } from 'vitest';
import { createLevelCatalog, PRODUCTION_LEVEL_CATALOG } from '../../src/core/level-catalog';
import { createCompleteAttempt } from '../../src/core/stage4-attempt-factory';
import { createStage4AccountState, createInitialStage4AccountState } from '../../src/core/stage4-account';
import { createInitialStage4GameState, createStage4GameState } from '../../src/core/stage4-game-state';
import { createRunState, createWaitingPosition } from '../../src/core/run';
import { mapStage4RuntimeToSaveV4 } from '../../src/core/persistence/stage4-runtime-mapping-v4';
import { commitSnapshot, loadCommittedSnapshot, SNAPSHOT_STORAGE_KEYS } from '../../src/systems/persistence/crash-safe-snapshot-store';
import { loadProductionPersistedSave } from '../../src/systems/persistence/persistence-coordinator';
import { executeStage4MutationV4 } from '../../src/systems/persistence/production-stage4-mutation-v4';
import { commitCandidateWithWriterLeaseV4 } from '../../src/systems/persistence/guarded-persistence-v4';
import { acquireWriterLease } from '../../src/systems/persistence/writer-lease';
import { createProductionStage4Session } from '../../src/systems/persistence/production-stage4-runtime';
import { createPresentationRoot } from '../../src/presentation-root';
import type { PresentationSessionPort } from '../../src/systems/presentation/session-port';
import { MemoryStorage } from '../helpers/memory-storage';

const created = createLevelCatalog([PRODUCTION_LEVEL_CATALOG.levels[0]!,
  { ...PRODUCTION_LEVEL_CATALOG.levels[0]!, levelId: 'level-002' }]);
if (created.status !== 'created') throw new Error('catalog');
const catalog = created.catalog;
const identity = { sessionId: 'nav-owner', leaseToken: 'nav-token' };
const clock = { nowMs: () => 100 };

function fixture(terminal = false) {
  const storage = new MemoryStorage();
  const made = createCompleteAttempt({ level: catalog.levels[0]!, runId: 'old-run', generationProvenance: {
    seed: 11, rngVersion: 'mulberry32-v1', generationVersion: 'mine-placement-v1',
  } });
  if (made.status !== 'created') throw new Error('attempt');
  const currentAttempt = terminal ? (() => {
    const mineIndex = made.attempt.run.board.cells.findIndex((cell) => cell.kind === 'mine');
    const target = { x: mineIndex % made.attempt.run.board.dimensions.width,
      y: Math.floor(mineIndex / made.attempt.run.board.dimensions.width) };
    return { ...made.attempt, run: createRunState(made.attempt.run.board, createWaitingPosition(), {
      hasTakenStep: true, phase: { kind: 'failed' as const, encounter: { target, occurredOnFirstStep: true } },
    }), terminalDisposition: 'settled' as const };
  })() : made.attempt;
  const runtime = createStage4GameState({ ...createInitialStage4GameState(),
    account: createStage4AccountState({ ...createInitialStage4AccountState(), completedLevelIds: ['level-001'] }),
    currentAttempt });
  const mapped = mapStage4RuntimeToSaveV4(runtime, 0);
  if (mapped.status !== 'mapped') throw new Error('mapping');
  if (commitSnapshot(storage, JSON.stringify(mapped.document), 0).status !== 'committed') throw new Error('seed');
  let authority = loadProductionPersistedSave(storage);
  const port: PresentationSessionPort = {
    read: () => authority,
    reload: () => { authority = loadProductionPersistedSave(storage); return authority; },
    execute(intent) {
      if (authority.status !== 'fresh' && authority.status !== 'loaded') return { status: 'rejected', reason: authority.status };
      const lease = acquireWriterLease(storage, identity, clock);
      if (lease.status !== 'acquired' && lease.status !== 'renewed') return { status: 'rejected', reason: lease.status };
      const result = executeStage4MutationV4(storage, intent, { commit(document, expectedRevision) {
        const committed = commitCandidateWithWriterLeaseV4(storage, identity, clock, expectedRevision, document);
        return committed.status === 'committed' ? { status: 'committed' as const } :
          { status: 'rejected' as const, reason: committed.status };
      } }, catalog);
      if (result.status === 'committed') authority = {
        status: 'loaded', persistence: { kind: 'committed', revision: result.revision,
          source: 'head', sourceSaveVersion: 4 }, runtime: result.runtime };
      return result;
    },
  };
  const technical = { nextRunId: vi.fn(() => 'new-run'), nextGenerationSeed: vi.fn(() => 123), nextDetectionSeed: vi.fn(() => 1) };
  const root = createPresentationRoot(port, technical, null, catalog);
  return { root, storage, technical, port };
}

describe('S5-05 controlled-catalog v4 production chain', () => {
  it.each([['active', 'abandon'], ['failed', 'dismiss']] as const)(
    'reconciles Game after another production writer legally %s-leaves the Attempt', (phase, kind) => {
      const { root, storage } = fixture(phase === 'failed');
      expect(root.navigation.navigate('game').status).toBe('navigated');
      const competitor = createProductionStage4Session(storage,
        { sessionId: 'competing-owner', leaseToken: 'competing-token' }, clock);
      expect(competitor.execute({ kind, expectedRevision: 0, expectedRunId: 'old-run' }))
        .toMatchObject({ status: 'committed', revision: 1 });
      const beforeReload = [...storage.data];
      const operationCount = storage.operations.length;
      expect(root.reload()).toMatchObject({ status: 'loaded', view: { attempt: null } });
      expect(root.navigation.route()).toBe('home');
      expect([...storage.data]).toEqual(beforeReload);
      expect(storage.operations.slice(operationCount).filter((operation) =>
        operation.startsWith('write:') || operation.startsWith('remove:'))).toEqual([]);
    },
  );

  it('uses one catalog for sanitized access and real guarded two-commit replacement then reopen', () => {
    const { root, storage } = fixture();
    expect(root.navigation.levels()).toEqual([
      { levelId: 'level-001', order: 0, access: 'completed', current: true },
      { levelId: 'level-002', order: 1, access: 'available', current: false },
    ]);
    expect(root.navigation.selectLevel('level-002').status).toBe('confirmation-required');
    expect(root.navigation.confirmReplacement().status).toBe('committed');
    expect(loadCommittedSnapshot(storage)).toMatchObject({ status: 'loaded', revision: 2 });
    expect(loadProductionPersistedSave(storage)).toMatchObject({ status: 'loaded',
      runtime: { currentAttempt: { levelId: 'level-002', runId: 'new-run' } } });
    expect(JSON.stringify(root.navigation.levels())).not.toMatch(/reward|seed|mineCount|payload/);
  });

  it('first commit failure retains old authority; failed second commit leaves real account-only gap', () => {
    const first = fixture();
    first.storage.failNext('write', SNAPSHOT_STORAGE_KEYS.slotB);
    first.root.navigation.selectLevel('level-002');
    expect(first.root.navigation.confirmReplacement()).toMatchObject({ status: 'rejected' });
    expect(loadProductionPersistedSave(first.storage)).toMatchObject({ status: 'loaded', persistence: { revision: 0 },
      runtime: { currentAttempt: { runId: 'old-run' } } });

    const second = fixture();
    second.storage.failNext('write', SNAPSHOT_STORAGE_KEYS.slotA);
    second.root.navigation.selectLevel('level-002');
    expect(second.root.navigation.confirmReplacement()).toMatchObject({ status: 'rejected' });
    expect(loadProductionPersistedSave(second.storage)).toMatchObject({ status: 'loaded', persistence: { revision: 1 },
      runtime: { currentAttempt: null } });
    expect(second.root.navigation.pendingSelection()).toBeNull();
    expect(second.technical.nextRunId).toHaveBeenCalledTimes(1);
    // A fresh presentation lifetime sees only committed account-only authority, not a queued target.
    second.port.reload();
    const reopened = createPresentationRoot(second.port, second.technical, null, catalog);
    expect(reopened.navigation.route()).toBe('home');
    expect(reopened.navigation.pendingSelection()).toBeNull();
    expect(reopened.read()).toMatchObject({ status: 'loaded', view: { attempt: null } });
  });
});
