import { describe, expect, it } from 'vitest';
import { serializeSaveDocumentV1 } from '../../src/core/persistence/save-v1';
import { serializeSaveDocumentV2 } from '../../src/core/persistence/save-v2';
import { emptySaveCandidateV2 } from '../helpers/save-v2';
import { mapStage4RuntimeToSaveV3 } from '../../src/core/persistence/stage4-runtime-mapping';
import { createInitialStage4GameState } from '../../src/core/stage4-game-state';
import { validateSaveDocumentV3 } from '../../src/core/persistence/save-v3';
import { loadSaveDocument } from '../../src/core/persistence/save-dispatcher';
import { validateSaveDocumentV4 } from '../../src/core/persistence/save-v4';
import { mapStage4RuntimeToSaveV4 } from '../../src/core/persistence/stage4-runtime-mapping-v4';
import { createStage4GameState } from '../../src/core/stage4-game-state';
import { createStage4AccountState } from '../../src/core/stage4-account';
import { createInitialRunItemState } from '../../src/core/run-item-state';
import { createBoard, createCellState } from '../../src/core/board';
import { createInitialBoard } from '../../src/core/initial-board';
import { createRunState, createWaitingPosition } from '../../src/core/run';
import { commitSnapshot, loadCommittedSnapshot, SNAPSHOT_STORAGE_KEYS } from '../../src/systems/persistence/crash-safe-snapshot-store';
import { createProductionStage4Session } from '../../src/systems/persistence/production-stage4-runtime';
import { MemoryStorage } from '../helpers/memory-storage';
import { createPresentationRoot } from '../../src/presentation-root';
import { commitCandidateWithWriterLeaseV3 } from '../../src/systems/persistence/guarded-persistence-v3';

const owner = { sessionId: 's504-owner', leaseToken: 's504-token' };
const other = { sessionId: 's504-other', leaseToken: 's504-other-token' };
const clock = { nowMs: () => 100 };
const creation = { runId: 's504-run', baseSeed: 123, rngVersion: 'mulberry32-v1', generationVersion: 'mine-placement-v1' };
const writeCount = (storage: MemoryStorage) => storage.operations.filter((operation) =>
  Object.values(SNAPSHOT_STORAGE_KEYS).some((key) => operation === `write:${key}`)).length;

describe('S5-04 production Save v4 settings/tutorial authority', () => {
  it('starts fresh with defaults without a save and commits account-only settings at revision zero', () => {
    const storage = new MemoryStorage();
    const session = createProductionStage4Session(storage, owner, clock);
    expect(session.read()).toMatchObject({ status: 'fresh', runtime: { currentAttempt: null,
      settings: { musicEnabled: true, soundEffectsEnabled: true },
      tutorialProgress: { acknowledgedMilestoneIds: [] } } });
    expect(loadCommittedSnapshot(storage).status).toBe('no-save');
    const changed = session.execute({ kind: 'set-setting', key: 'musicEnabled', enabled: false,
      expectedRevision: null, expectedRunId: null });
    expect(changed).toMatchObject({ status: 'committed', revision: 0,
      runtime: { settings: { musicEnabled: false, soundEffectsEnabled: true }, currentAttempt: null } });
    const saved = loadCommittedSnapshot(storage);
    expect(saved.status).toBe('loaded');
    if (saved.status !== 'loaded') return;
    expect(JSON.parse(saved.serializedPayload)).toMatchObject({ saveVersion: 4, revision: 0,
      settings: { musicEnabled: false, soundEffectsEnabled: true },
      tutorialProgress: { acknowledgedMilestoneIds: [] } });
    expect(createProductionStage4Session(storage, owner, clock).read()).toMatchObject({ status: 'loaded',
      persistence: { revision: 0, sourceSaveVersion: 4 },
      runtime: { settings: { musicEnabled: false, soundEffectsEnabled: true } } });
  });

  it('canonicalizes tutorial set, preserves Account and Attempt across start/flag/setting/acknowledge', () => {
    const storage = new MemoryStorage();
    const session = createProductionStage4Session(storage, owner, clock);
    expect(session.execute({ kind: 'acknowledge-tutorial', milestoneId: 'first-shop', expectedRevision: null, expectedRunId: null }))
      .toMatchObject({ status: 'committed', revision: 0 });
    expect(session.execute({ kind: 'start', levelId: 'level-001', creation,
      expectedRevision: 0, expectedRunId: null })).toMatchObject({ status: 'committed', revision: 1 });
    const before = session.read();
    if (before.status !== 'loaded' || before.runtime.currentAttempt === null) throw new Error('attempt');
    const attempt = before.runtime.currentAttempt;
    const account = before.runtime.account;
    expect(session.execute({ kind: 'acknowledge-tutorial', milestoneId: 'first-lucky',
      expectedRevision: 1, expectedRunId: attempt.runId })).toMatchObject({ status: 'committed', revision: 2 });
    expect(session.execute({ kind: 'set-setting', key: 'soundEffectsEnabled', enabled: false,
      expectedRevision: 2, expectedRunId: attempt.runId })).toMatchObject({ status: 'committed', revision: 3 });
    const reopened = createProductionStage4Session(storage, owner, clock).read();
    expect(reopened).toMatchObject({ status: 'loaded', persistence: { revision: 3, sourceSaveVersion: 4 }, runtime: {
      settings: { musicEnabled: true, soundEffectsEnabled: false },
      tutorialProgress: { acknowledgedMilestoneIds: ['first-lucky', 'first-shop'] },
      account, currentAttempt: attempt,
    } });
  });

  it('carries both facts through lifecycle and Board-level gameplay candidates without changing them', () => {
    const storage = new MemoryStorage();
    const session = createProductionStage4Session(storage, owner, clock);
    expect(session.execute({ kind: 'set-setting', key: 'musicEnabled', enabled: false,
      expectedRevision: null, expectedRunId: null }).status).toBe('committed');
    expect(session.execute({ kind: 'acknowledge-tutorial', milestoneId: 'first-items',
      expectedRevision: 0, expectedRunId: null }).status).toBe('committed');
    expect(session.execute({ kind: 'start', levelId: 'level-001', creation,
      expectedRevision: 1, expectedRunId: null }).status).toBe('committed');
    expect(session.execute({ kind: 'flag', coordinate: { x: 0, y: 0 }, flagged: true,
      expectedRevision: 2, expectedRunId: 's504-run' }).status).toBe('committed');
    expect(session.execute({ kind: 'flag', coordinate: { x: 0, y: 0 }, flagged: false,
      expectedRevision: 3, expectedRunId: 's504-run' }).status).toBe('committed');
    expect(session.execute({ kind: 'abandon', expectedRevision: 4, expectedRunId: 's504-run' }).status).toBe('committed');
    expect(createProductionStage4Session(storage, owner, clock).read()).toMatchObject({ status: 'loaded',
      persistence: { revision: 5, sourceSaveVersion: 4 }, runtime: {
        currentAttempt: null, settings: { musicEnabled: false, soundEffectsEnabled: true },
        tutorialProgress: { acknowledgedMilestoneIds: ['first-items'] },
      } });
  });

  it('rejects stale guards before no-op, then no-op without snapshot write/revision/candidate', () => {
    const storage = new MemoryStorage();
    const session = createProductionStage4Session(storage, owner, clock);
    expect(session.execute({ kind: 'set-setting', key: 'musicEnabled', enabled: false,
      expectedRevision: null, expectedRunId: null }).status).toBe('committed');
    const writes = writeCount(storage);
    const authority = session.read();
    expect(session.execute({ kind: 'set-setting', key: 'musicEnabled', enabled: false,
      expectedRevision: null, expectedRunId: null })).toEqual({ status: 'rejected', reason: 'revision-conflict' });
    expect(session.execute({ kind: 'set-setting', key: 'musicEnabled', enabled: false,
      expectedRevision: 0, expectedRunId: 'wrong' })).toEqual({ status: 'rejected', reason: 'run-id-conflict' });
    expect(session.execute({ kind: 'set-setting', key: 'musicEnabled', enabled: false,
      expectedRevision: 0, expectedRunId: null })).toEqual({ status: 'rejected', reason: 'settings-unchanged' });
    expect(session.execute({ kind: 'acknowledge-tutorial', milestoneId: 'first-items',
      expectedRevision: 0, expectedRunId: null })).toMatchObject({ status: 'committed', revision: 1 });
    const afterAck = writeCount(storage);
    expect(session.execute({ kind: 'acknowledge-tutorial', milestoneId: 'first-items',
      expectedRevision: 1, expectedRunId: null })).toEqual({ status: 'rejected', reason: 'tutorial-already-acknowledged' });
    expect(writeCount(storage)).toBe(afterAck);
    expect(afterAck).toBeGreaterThan(writes);
    expect(authority).toMatchObject({ persistence: { revision: 0 } });
    expect(session.read()).toMatchObject({ persistence: { revision: 1 } });
  });

  it('does not publish or write a candidate when the snapshot commit fails', () => {
    const storage = new MemoryStorage();
    const session = createProductionStage4Session(storage, owner, clock);
    const before = session.read();
    storage.failNext('write', SNAPSHOT_STORAGE_KEYS.slotA);
    const result = session.execute({ kind: 'set-setting', key: 'musicEnabled', enabled: false,
      expectedRevision: null, expectedRunId: null });
    expect(result).toMatchObject({ status: 'rejected' });
    expect(result).not.toHaveProperty('runtime');
    expect(session.read()).toBe(before);
    expect(loadCommittedSnapshot(storage).status).toBe('no-save');
  });

  it('rejects stale revision and lost lease without publishing the old session', () => {
    const storage = new MemoryStorage();
    const first = createProductionStage4Session(storage, owner, clock);
    const stale = createProductionStage4Session(storage, owner, clock);
    expect(first.execute({ kind: 'set-setting', key: 'musicEnabled', enabled: false,
      expectedRevision: null, expectedRunId: null }).status).toBe('committed');
    expect(stale.execute({ kind: 'acknowledge-tutorial', milestoneId: 'first-shop',
      expectedRevision: null, expectedRunId: null })).toEqual({ status: 'rejected', reason: 'revision-conflict' });
    expect(stale.read().status).toBe('fresh');
    const second = createProductionStage4Session(storage, other, clock);
    expect(second.execute({ kind: 'acknowledge-tutorial', milestoneId: 'first-shop',
      expectedRevision: 0, expectedRunId: null })).toMatchObject({ status: 'rejected', reason: 'owned-by-another-session' });
    expect(second.read()).toMatchObject({ status: 'loaded', persistence: { revision: 0 },
      runtime: { tutorialProgress: { acknowledgedMilestoneIds: [] } } });
  });

  it('treats a failed head write as uncertain and never publishes or auto-replays', () => {
    const storage = new MemoryStorage();
    const session = createProductionStage4Session(storage, owner, clock);
    const root = createPresentationRoot(session, {
      nextRunId: () => 'unused', nextGenerationSeed: () => 1, nextDetectionSeed: () => 2,
    });
    storage.failNext('write', SNAPSHOT_STORAGE_KEYS.head);
    const before = session.read();
    const result = root.submit({ kind: 'set-setting', key: 'musicEnabled', enabled: false });
    expect(result).toMatchObject({ status: 'rejected', reason: 'commit-commit-outcome-uncertain',
      policy: { category: 'uncertain', retainEnvelope: false, retryUseful: false, reloadRequired: true } });
    expect(session.read()).toBe(before);
    expect(root.submit({ kind: 'acknowledge-tutorial', milestoneId: 'first-shop' }))
      .toMatchObject({ status: 'unavailable', reason: 'reload-required' });
    // An uncommitted bare slot is deliberately not promoted to authority.
    expect(loadCommittedSnapshot(storage).status).toBe('corrupt');
  });

  it('loads v1/v2/v3 read-only with defaults and writes v4 only on real mutation', () => {
    for (const version of [1, 2, 3] as const) {
      const storage = new MemoryStorage();
      let document: object;
      if (version === 1) {
        const old = serializeSaveDocumentV1({ revision: 2, activeRun: null });
        if (old.status !== 'serialized') throw new Error('v1 fixture');
        document = old.document;
      } else if (version === 2) {
        const old = serializeSaveDocumentV2(emptySaveCandidateV2(2));
        if (old.status !== 'serialized') throw new Error('v2 fixture');
        document = old.document;
      } else {
        const old = mapStage4RuntimeToSaveV3(createInitialStage4GameState(), 2);
        if (old.status !== 'mapped') throw new Error('v3 fixture');
        document = old.document;
      }
      expect(commitSnapshot(storage, JSON.stringify(document), 2).status).toBe('committed');
      const before = writeCount(storage);
      const session = createProductionStage4Session(storage, owner, clock);
      expect(session.read()).toMatchObject({ status: 'loaded', persistence: { revision: 2, sourceSaveVersion: version },
        runtime: { settings: { musicEnabled: true, soundEffectsEnabled: true },
          tutorialProgress: { acknowledgedMilestoneIds: [] } } });
      expect(writeCount(storage)).toBe(before);
      expect(session.execute({ kind: 'set-setting', key: 'soundEffectsEnabled', enabled: true,
        expectedRevision: 2, expectedRunId: null })).toEqual({ status: 'rejected', reason: 'settings-unchanged' });
      expect(writeCount(storage)).toBe(before);
      expect(session.execute({ kind: 'acknowledge-tutorial', milestoneId: 'first-obstacle',
        expectedRevision: 2, expectedRunId: null })).toMatchObject({ status: 'committed', revision: 3 });
      expect(createProductionStage4Session(storage, owner, clock).read()).toMatchObject({ status: 'loaded',
        persistence: { revision: 3, sourceSaveVersion: 4 }, runtime: {
          tutorialProgress: { acknowledgedMilestoneIds: ['first-obstacle'] } } });
    }
  });

  it('rejects direct external v4 legacy permission and old v3 reader refuses v4 without overwrite', () => {
    const storage = new MemoryStorage();
    const session = createProductionStage4Session(storage, owner, clock);
    expect(session.execute({ kind: 'start', levelId: 'level-001', creation,
      expectedRevision: null, expectedRunId: null }).status).toBe('committed');
    const selected = loadCommittedSnapshot(storage);
    if (selected.status !== 'loaded') throw new Error('v4 fixture');
    expect(validateSaveDocumentV3(JSON.parse(selected.serializedPayload)).status).toBe('invalid');
    const oldCandidate = mapStage4RuntimeToSaveV3(createInitialStage4GameState(), 1);
    if (oldCandidate.status !== 'mapped') throw new Error('old writer fixture');
    expect(commitCandidateWithWriterLeaseV3(storage, owner, clock, 0, oldCandidate.document))
      .toMatchObject({ status: 'persistence-load-failure', reason: 'unsupported-future-version' });
    expect(loadCommittedSnapshot(storage)).toEqual(selected);
    const forged = JSON.parse(selected.serializedPayload);
    forged.currentAttempt.terminalDisposition = 'legacy-excluded';
    const forgedStorage = new MemoryStorage();
    expect(commitSnapshot(forgedStorage, JSON.stringify(forged), 0).status).toBe('committed');
    expect(createProductionStage4Session(forgedStorage, other, clock).read()).toMatchObject({ status: 'invalid-save' });
    expect(loadCommittedSnapshot(forgedStorage).status).toBe('loaded');
  });

  it('keeps authentic historical terminal legacy-excluded read-only until legal dismissal', () => {
    const storage = new MemoryStorage();
    const board = createInitialBoard({ dimensions: { width: 2, height: 1 }, obstacleCoordinates: [],
      mineCoordinates: [{ x: 1, y: 0 }] });
    if (board.status !== 'created') throw new Error('board');
    const run = createRunState(board.board, createWaitingPosition(), { hasTakenStep: true,
      phase: { kind: 'failed', encounter: { target: { x: 1, y: 0 }, occurredOnFirstStep: true } } });
    const old = serializeSaveDocumentV1({ revision: 7, activeRun: { runId: 'old-run', levelId: 'level-001', run } });
    if (old.status !== 'serialized') throw new Error('v1 terminal fixture');
    expect(commitSnapshot(storage, JSON.stringify(old.document), 7).status).toBe('committed');
    const migrated = loadSaveDocument(old.document);
    expect(migrated).toMatchObject({ status: 'loaded', sourceSaveVersion: 1,
      document: { currentAttempt: { terminalDisposition: 'legacy-excluded' } } });
    if (migrated.status === 'loaded') expect(validateSaveDocumentV4(migrated.document).status).toBe('invalid');
    const session = createProductionStage4Session(storage, owner, clock);
    expect(session.read()).toMatchObject({ status: 'loaded', persistence: { revision: 7, sourceSaveVersion: 1 },
      runtime: { currentAttempt: { terminalDisposition: 'legacy-excluded' },
        settings: { musicEnabled: true }, tutorialProgress: { acknowledgedMilestoneIds: [] } } });
    const writes = writeCount(storage);
    expect(session.execute({ kind: 'set-setting', key: 'musicEnabled', enabled: true,
      expectedRevision: 7, expectedRunId: 'old-run' })).toEqual({ status: 'rejected', reason: 'not-writable' });
    expect(session.execute({ kind: 'acknowledge-tutorial', milestoneId: 'first-shop',
      expectedRevision: 7, expectedRunId: 'old-run' })).toEqual({ status: 'rejected', reason: 'not-writable' });
    expect(writeCount(storage)).toBe(writes);
    expect(session.execute({ kind: 'dismiss', expectedRevision: 7, expectedRunId: 'old-run' }))
      .toMatchObject({ status: 'committed', revision: 8, runtime: { currentAttempt: null } });
    expect(session.execute({ kind: 'set-setting', key: 'musicEnabled', enabled: false,
      expectedRevision: 8, expectedRunId: null })).toMatchObject({ status: 'committed', revision: 9 });
    expect(createProductionStage4Session(storage, owner, clock).read()).toMatchObject({ status: 'loaded',
      persistence: { revision: 9, sourceSaveVersion: 4 }, runtime: { settings: { musicEnabled: false } } });
  });

  it.each(['active', 'pending-mine-encounter', 'failed', 'won'] as const)(
    'preserves phase %s and every Attempt/Account fact while writing preferences', (kind) => {
      const storage = new MemoryStorage();
      const cells = [
        createCellState({ terrain: 'playable', containsMine: false, explored: kind === 'won', mineRevealed: false, flagged: false }),
        createCellState({ terrain: 'playable', containsMine: true, explored: false, mineRevealed: false, flagged: false }),
      ];
      const board = createBoard({ width: 2, height: 1 }, cells);
      const phase = kind === 'active' || kind === 'won' ? { kind } as const : {
        kind, encounter: { target: { x: 1, y: 0 }, occurredOnFirstStep: true },
      } as const;
      const run = createRunState(board, createWaitingPosition(), { phase,
        hasTakenStep: kind === 'pending-mine-encounter' || kind === 'failed' });
      const initial = createInitialStage4GameState();
      const account = kind === 'won' ? createStage4AccountState({ ...initial.account,
        completedLevelIds: ['level-001'] }) : initial.account;
      const runtime = createStage4GameState({ ...initial, account, currentAttempt: {
        runId: 'phase-run', levelId: 'level-001', generationProvenance: null, run,
        runItems: createInitialRunItemState(null), rewards: [], temporaryBenbenCard: null,
        terminalDisposition: kind === 'won' || kind === 'failed' ? 'settled' : 'not-applicable',
      } });
      const mapped = mapStage4RuntimeToSaveV4(runtime, 6);
      if (mapped.status !== 'mapped') throw new Error('phase fixture');
      expect(commitSnapshot(storage, JSON.stringify(mapped.document), 6).status).toBe('committed');
      const session = createProductionStage4Session(storage, owner, clock);
      expect(session.execute({ kind: 'set-setting', key: 'musicEnabled', enabled: false,
        expectedRevision: 6, expectedRunId: 'phase-run' })).toMatchObject({ status: 'committed', revision: 7 });
      expect(session.execute({ kind: 'acknowledge-tutorial', milestoneId: 'first-shop',
        expectedRevision: 7, expectedRunId: 'phase-run' })).toMatchObject({ status: 'committed', revision: 8 });
      const reopened = createProductionStage4Session(storage, owner, clock).read();
      expect(reopened).toMatchObject({ status: 'loaded', persistence: { revision: 8, sourceSaveVersion: 4 },
        runtime: { account, currentAttempt: runtime.currentAttempt,
          settings: { musicEnabled: false, soundEffectsEnabled: true },
          tutorialProgress: { acknowledgedMilestoneIds: ['first-shop'] } } });
    },
  );

  it('reprojects neutral no-op copy through the presentation root', () => {
    const storage = new MemoryStorage();
    const session = createProductionStage4Session(storage, owner, clock);
    const root = createPresentationRoot(session, {
      nextRunId: () => 'unused', nextGenerationSeed: () => 1, nextDetectionSeed: () => 2,
    });
    expect(root.submit({ kind: 'set-setting', key: 'musicEnabled', enabled: true })).toMatchObject({
      status: 'rejected', reason: 'settings-unchanged', copyKey: 'settings.already-set',
      snapshot: { status: 'fresh', view: { settings: { musicEnabled: true } } },
    });
  });
});
