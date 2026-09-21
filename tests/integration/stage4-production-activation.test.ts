import { describe, expect, it } from 'vitest';
import { serializeSaveDocumentV2 } from '../../src/core/persistence/save-v2';
import { serializeSaveDocumentV1 } from '../../src/core/persistence/save-v1';
import { CURRENT_SAVE_VERSION, loadSaveDocument } from '../../src/core/persistence/save-dispatcher';
import { commitSnapshot, loadCommittedSnapshot, SNAPSHOT_STORAGE_KEYS } from '../../src/systems/persistence/crash-safe-snapshot-store';
import { createProductionStage4Session, executeProductionStage4Mutation, loadProductionStage4Runtime } from '../../src/systems/persistence/production-stage4-runtime';
import { acquireWriterLease, WRITER_LEASE_STORAGE_KEY } from '../../src/systems/persistence/writer-lease';
import { commitCandidateWithWriterLease } from '../../src/systems/persistence/guarded-persistence';
import { MemoryStorage } from '../helpers/memory-storage';
import { emptySaveCandidateV2 } from '../helpers/save-v2';

const identity = { sessionId: 'stage4-owner', leaseToken: 'stage4-token' };
const clock = { nowMs: () => 100 };
const creation = { runId: 'run-a', baseSeed: 123456789, rngVersion: 'mulberry32-v1', generationVersion: 'mine-placement-v1' };

function fixture() {
  const storage = new MemoryStorage();
  expect(acquireWriterLease(storage, identity, clock).status).toBe('acquired');
  const read = () => loadProductionStage4Runtime(storage);
  const execute = (intent: Parameters<typeof executeProductionStage4Mutation>[3]) =>
    executeProductionStage4Mutation(storage, identity, clock, intent);
  const start = () => execute({ kind: 'start', expectedRevision: null, expectedRunId: null, levelId: 'level-001', creation });
  return { storage, read, execute, start };
}

describe('S4-08.4 activated production authority', () => {
  it('publishes the one browser Runtime only after a guarded v3 commit', () => {
    const storage = new MemoryStorage();
    const session = createProductionStage4Session(storage, identity, clock);
    const before = session.read();
    expect(before.status).toBe('fresh');
    const committed = session.execute({ kind: 'start', expectedRevision: null, expectedRunId: null, levelId: 'level-001', creation });
    expect(committed.status).toBe('committed');
    expect(session.read()).toMatchObject({ status: 'loaded', persistence: { revision: 0, sourceSaveVersion: 3 }, runtime: { currentAttempt: { runId: 'run-a' } } });
    expect(session.read()).not.toBe(before);
    const selected = loadCommittedSnapshot(storage);
    expect(selected.status).toBe('loaded');
    if (selected.status === 'loaded') expect(JSON.parse(selected.serializedPayload)).toMatchObject({ saveVersion: 3, revision: 0 });
  });

  it('does not publish after lease denial through the browser root', () => {
    const storage = new MemoryStorage();
    const session = createProductionStage4Session(storage, identity, clock);
    expect(acquireWriterLease(storage, { sessionId: 'other', leaseToken: 'other' }, clock).status).toBe('acquired');
    const denied = session.execute({ kind: 'start', expectedRevision: null, expectedRunId: null, levelId: 'level-001', creation });
    expect(denied.status).toBe('rejected');
    expect(session.read().status).toBe('fresh');
    expect(loadCommittedSnapshot(storage).status).toBe('no-save');
  });

  it('starts with one account-only Runtime without a write or fake revision', () => {
    const f = fixture();
    const before = f.storage.operations.length;
    const loaded = f.read();
    expect(loaded.status).toBe('fresh');
    if (loaded.status !== 'fresh') return;
    expect(loaded.runtime.currentAttempt).toBeNull();
    expect(loaded.runtime.account.inventory).toEqual({ lucky: 1, detection: 2, airplane: 1, revive: 1 });
    expect(loaded.persistence.kind).toBe('no-save');
    expect(f.storage.operations.slice(before).every((operation) => operation.startsWith('read:'))).toBe(true);
  });

  it('commits the first production mutation as v3 revision 0 and reopens the same attempt', () => {
    const f = fixture();
    const result = f.start();
    expect(result.status).toBe('committed');
    if (result.status !== 'committed') return;
    expect(result.revision).toBe(0);
    const selected = loadCommittedSnapshot(f.storage);
    expect(selected.status).toBe('loaded');
    if (selected.status !== 'loaded') return;
    const payload = JSON.parse(selected.serializedPayload) as unknown;
    expect((payload as { saveVersion: number }).saveVersion).toBe(CURRENT_SAVE_VERSION);
    expect(loadSaveDocument(payload).status).toBe('loaded');
    const reopened = f.read();
    expect(reopened.status).toBe('loaded');
    if (reopened.status !== 'loaded') return;
    expect(reopened.runtime.currentAttempt?.runId).toBe('run-a');
    expect(reopened.persistence.revision).toBe(0);
    expect(reopened.runtime).not.toBe(result.runtime);
  });

  it('reads v2 without writeback, then first real mutation commits v3 at N+1', () => {
    const f = fixture();
    const serialized = serializeSaveDocumentV2(emptySaveCandidateV2(4));
    expect(serialized.status).toBe('serialized');
    if (serialized.status !== 'serialized') return;
    expect(commitSnapshot(f.storage, JSON.stringify(serialized.document), 4).status).toBe('committed');
    const before = f.storage.operations.length;
    const migrated = f.read();
    expect(migrated.status).toBe('loaded');
    expect(f.storage.operations.slice(before).every((operation) => operation.startsWith('read:'))).toBe(true);
    const result = f.execute({ kind: 'start', expectedRevision: 4, expectedRunId: null, levelId: 'level-001', creation });
    expect(result.status).toBe('committed');
    expect(loadCommittedSnapshot(f.storage)).toMatchObject({ status: 'loaded', revision: 5 });
    const restored = f.read();
    expect(restored.status).toBe('loaded');
    if (restored.status !== 'loaded') return;
    expect(restored.runtime.currentAttempt?.runId).toBe('run-a');
  });

  it('reads v1 through the frozen migration chain without writing or granting fresh assets', () => {
    const f = fixture();
    const serialized = serializeSaveDocumentV1({ revision: 7, activeRun: null });
    expect(serialized.status).toBe('serialized');
    if (serialized.status !== 'serialized') return;
    expect(commitSnapshot(f.storage, JSON.stringify(serialized.document), 7).status).toBe('committed');
    const before = f.storage.operations.length;
    const result = f.read();
    expect(result).toMatchObject({ status: 'loaded', persistence: { revision: 7, sourceSaveVersion: 1 }, runtime: { currentAttempt: null, account: { inventory: { lucky: 0, detection: 0, airplane: 0, revive: 0 } } } });
    expect(f.storage.operations.slice(before).every((operation) => operation.startsWith('read:'))).toBe(true);
  });

  it('runs real Flag, Safe movement, Mine encounter and Failure through v3 commits', () => {
    const f = fixture();
    expect(f.start().status).toBe('committed');
    const initial = f.read();
    if (initial.status !== 'loaded' || initial.runtime.currentAttempt === null) throw new Error('start fixture');
    const board = initial.runtime.currentAttempt.run.board;
    const safeIndex = board.cells.findIndex((cell) => cell.kind === 'safe');
    const mineIndex = board.cells.findIndex((cell) => cell.kind === 'mine');
    const point = (index: number) => ({ x: index % board.dimensions.width, y: Math.floor(index / board.dimensions.width) });
    const flag = f.execute({ kind: 'flag', expectedRevision: 0, expectedRunId: 'run-a', coordinate: point(mineIndex), flagged: true });
    expect(flag.status).toBe('committed');
    expect(f.execute({ kind: 'move', expectedRevision: 1, expectedRunId: 'run-a', coordinate: point(mineIndex) })).toMatchObject({ status: 'rejected' });
    expect(f.execute({ kind: 'flag', expectedRevision: 1, expectedRunId: 'run-a', coordinate: point(mineIndex), flagged: false }).status).toBe('committed');
    const safe = f.execute({ kind: 'move', expectedRevision: 2, expectedRunId: 'run-a', coordinate: point(safeIndex) });
    expect(safe.status).toBe('committed');
    const pending = f.execute({ kind: 'move', expectedRevision: 3, expectedRunId: 'run-a', coordinate: point(mineIndex) });
    expect(pending.status).toBe('committed');
    expect(f.read()).toMatchObject({ status: 'loaded', runtime: { currentAttempt: { run: { phase: { kind: 'pending-mine-encounter' } } } } });
    expect(f.execute({ kind: 'failure', expectedRevision: 4, expectedRunId: 'run-a' }).status).toBe('committed');
    const reopened = f.read();
    expect(reopened).toMatchObject({ status: 'loaded', persistence: { revision: 5, sourceSaveVersion: 3 }, runtime: { currentAttempt: { run: { phase: { kind: 'failed' } }, terminalDisposition: 'settled' } } });
  });

  it('runs first-step automatic Lucky then pending Revive without a v2 writer', () => {
    const f = fixture();
    expect(f.start().status).toBe('committed');
    const initial = f.read();
    if (initial.status !== 'loaded' || initial.runtime.currentAttempt === null) throw new Error('start fixture');
    const board = initial.runtime.currentAttempt.run.board;
    const mines = board.cells.flatMap((cell, index) => cell.kind === 'mine' ? [index] : []);
    const safeIndex = board.cells.findIndex((cell) => cell.kind === 'safe');
    const point = (index: number) => ({ x: index % board.dimensions.width, y: Math.floor(index / board.dimensions.width) });
    expect(f.execute({ kind: 'move', expectedRevision: 0, expectedRunId: 'run-a', coordinate: point(mines[0]!) }).status).toBe('committed');
    const lucky = f.read();
    expect(lucky).toMatchObject({ status: 'loaded', runtime: { account: { inventory: { lucky: 0, revive: 1 } }, currentAttempt: { run: { phase: { kind: 'active' }, characterPosition: { kind: 'revealed-mine-occupancy' } } } } });
    expect(f.execute({ kind: 'move', expectedRevision: 1, expectedRunId: 'run-a', coordinate: point(safeIndex) }).status).toBe('committed');
    expect(f.execute({ kind: 'move', expectedRevision: 2, expectedRunId: 'run-a', coordinate: point(mines[1]!) }).status).toBe('committed');
    expect(f.execute({ kind: 'revive', expectedRevision: 3, expectedRunId: 'run-a' }).status).toBe('committed');
    expect(f.read()).toMatchObject({ status: 'loaded', persistence: { revision: 4 }, runtime: { account: { inventory: { lucky: 0, revive: 0 } }, currentAttempt: { run: { phase: { kind: 'active' }, characterPosition: { kind: 'revealed-mine-occupancy' } }, runItems: { successfulReviveUses: 1 } } } });
  });

  it('persists Detection then Airplane through the same v3 authority chain', () => {
    const f = fixture();
    expect(f.start().status).toBe('committed');
    const initial = f.read();
    if (initial.status !== 'loaded' || initial.runtime.currentAttempt === null) throw new Error('start fixture');
    const board = initial.runtime.currentAttempt.run.board;
    const width = board.dimensions.width;
    const height = board.dimensions.height;
    let safePoint: { x: number; y: number } | undefined;
    for (let y = 0; y < height && safePoint === undefined; y++) {
      for (let x = 0; x < width && safePoint === undefined; x++) {
        if (board.cells[y * width + x]?.kind !== 'safe') continue;
        if ([-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => (dx !== 0 || dy !== 0) &&
          x + dx >= 0 && x + dx < width && y + dy >= 0 && y + dy < height &&
          board.cells[(y + dy) * width + x + dx]?.kind === 'mine'))) safePoint = { x, y };
      }
    }
    if (safePoint === undefined) throw new Error('adjacent Safe fixture');
    expect(f.execute({ kind: 'move', expectedRevision: 0, expectedRunId: 'run-a', coordinate: safePoint }).status).toBe('committed');
    expect(f.execute({ kind: 'detection', expectedRevision: 1, expectedRunId: 'run-a', initializeSeed: 42 }).status).toBe('committed');
    expect(f.execute({ kind: 'airplane', expectedRevision: 2, expectedRunId: 'run-a', coordinate: safePoint }).status).toBe('committed');
    const reopened = f.read();
    expect(reopened).toMatchObject({ status: 'loaded', persistence: { revision: 3, sourceSaveVersion: 3 }, runtime: {
      account: { inventory: { detection: 1, airplane: 0 } }, currentAttempt: { runItems: { successfulDetectionUses: 1, successfulAirplaneUses: 1, detectionRandomSeed: 43 } },
    } });
    if (reopened.status !== 'loaded' || reopened.runtime.currentAttempt === null) return;
    expect(reopened.runtime.currentAttempt.run.characterPosition).toEqual({ kind: 'on-board', coordinate: safePoint });
    expect(reopened.runtime.currentAttempt.run.board.cells.some((cell) => cell.kind === 'mine' && cell.revelation === 'revealed')).toBe(true);
  });

  it('commits Restart, settled Failure, Retry and Abandon without reviving the old attempt', () => {
    const f = fixture();
    expect(f.start().status).toBe('committed');
    expect(f.execute({ kind: 'restart', expectedRevision: 0, expectedRunId: 'run-a', creation: { ...creation, runId: 'run-b', baseSeed: 9 } }).status).toBe('committed');
    const restarted = f.read();
    if (restarted.status !== 'loaded' || restarted.runtime.currentAttempt === null) throw new Error('restart fixture');
    expect(restarted.runtime.currentAttempt.runId).toBe('run-b');
    const board = restarted.runtime.currentAttempt.run.board;
    const safe = board.cells.findIndex((cell) => cell.kind === 'safe');
    const mine = board.cells.findIndex((cell) => cell.kind === 'mine');
    const point = (index: number) => ({ x: index % board.dimensions.width, y: Math.floor(index / board.dimensions.width) });
    expect(f.execute({ kind: 'move', expectedRevision: 1, expectedRunId: 'run-b', coordinate: point(safe) }).status).toBe('committed');
    expect(f.execute({ kind: 'move', expectedRevision: 2, expectedRunId: 'run-b', coordinate: point(mine) }).status).toBe('committed');
    expect(f.execute({ kind: 'failure', expectedRevision: 3, expectedRunId: 'run-b' }).status).toBe('committed');
    expect(f.execute({ kind: 'retry', expectedRevision: 4, expectedRunId: 'run-b', creation: { ...creation, runId: 'run-c', baseSeed: 10 } }).status).toBe('committed');
    expect(f.execute({ kind: 'abandon', expectedRevision: 5, expectedRunId: 'run-b' })).toMatchObject({ status: 'rejected', reason: 'run-id-conflict' });
    expect(f.execute({ kind: 'abandon', expectedRevision: 5, expectedRunId: 'run-c' }).status).toBe('committed');
    expect(f.read()).toMatchObject({ status: 'loaded', persistence: { revision: 6 }, runtime: { currentAttempt: null } });
  });

  it('settles final-Safe Victory with Rewards before Replay and rejects unavailable Next', () => {
    const f = fixture();
    expect(f.start().status).toBe('committed');
    const initial = f.read();
    if (initial.status !== 'loaded' || initial.runtime.currentAttempt === null) throw new Error('start fixture');
    const board = initial.runtime.currentAttempt.run.board;
    const safeIndices = board.cells.flatMap((cell, index) => cell.kind === 'safe' ? [index] : []);
    let revision = 0;
    for (const index of safeIndices) {
      const result = f.execute({ kind: 'move', expectedRevision: revision, expectedRunId: 'run-a',
        coordinate: { x: index % board.dimensions.width, y: Math.floor(index / board.dimensions.width) } });
      expect(result.status).toBe('committed');
      revision++;
    }
    const won = f.read();
    expect(won).toMatchObject({ status: 'loaded', persistence: { revision }, runtime: {
      account: { completedLevelIds: ['level-001'] }, currentAttempt: { run: { phase: { kind: 'won' } }, terminalDisposition: 'settled' },
    } });
    if (won.status !== 'loaded' || won.runtime.currentAttempt === null) return;
    expect(won.runtime.currentAttempt.rewards.every((reward) => reward.claimed)).toBe(true);
    expect(f.execute({ kind: 'next', expectedRevision: revision, expectedRunId: 'run-a', creation: { ...creation, runId: 'run-next' } })).toMatchObject({ status: 'rejected', reason: 'next-unavailable' });
    expect(f.execute({ kind: 'replay', expectedRevision: revision, expectedRunId: 'run-a', creation: { ...creation, runId: 'run-replay' } }).status).toBe('committed');
    expect(f.read()).toMatchObject({ status: 'loaded', persistence: { revision: revision + 1 }, runtime: {
      account: { completedLevelIds: ['level-001'] }, currentAttempt: { runId: 'run-replay', run: { phase: { kind: 'active' } } },
    } });
  });

  it('rejects stale revision and stale run identity without another committed write', () => {
    const f = fixture();
    expect(f.start().status).toBe('committed');
    const staleRevision = f.execute({ kind: 'abandon', expectedRevision: null, expectedRunId: 'run-a' });
    const staleRun = f.execute({ kind: 'abandon', expectedRevision: 0, expectedRunId: 'old-run' });
    expect(staleRevision).toMatchObject({ status: 'rejected', reason: 'revision-conflict' });
    expect(staleRun).toMatchObject({ status: 'rejected', reason: 'run-id-conflict' });
    expect(f.read()).toMatchObject({ status: 'loaded', persistence: { revision: 0 }, runtime: { currentAttempt: { runId: 'run-a' } } });
  });

  it('does not publish a candidate or advance authority on storage commit failure', () => {
    const f = fixture();
    expect(f.start().status).toBe('committed');
    f.storage.failNext('write', SNAPSHOT_STORAGE_KEYS.head);
    const result = f.execute({ kind: 'abandon', expectedRevision: 0, expectedRunId: 'run-a' });
    expect(result.status).toBe('rejected');
    expect(result).not.toHaveProperty('runtime');
    expect(f.read()).toMatchObject({ status: 'loaded', persistence: { revision: 0 }, runtime: { currentAttempt: { runId: 'run-a' } } });
  });

  it('rejects ownership change at the second verification before committing', () => {
    const f = fixture();
    expect(f.start().status).toBe('committed');
    const originalRead = f.storage.read.bind(f.storage);
    let guardedReads = 0;
    f.storage.read = (key) => {
      if (key === WRITER_LEASE_STORAGE_KEY) {
        guardedReads++;
        if (guardedReads === 2) {
          f.storage.data.set(key, JSON.stringify({ formatVersion: 1, sessionId: 'racer', leaseToken: 'racer-token', expiresAtMs: 30100 }));
        }
      }
      return originalRead(key);
    };
    const result = f.execute({ kind: 'abandon', expectedRevision: 0, expectedRunId: 'run-a' });
    expect(guardedReads).toBe(2);
    expect(result).toMatchObject({ status: 'rejected', reason: 'commit-writer-not-owner' });
    expect(f.read()).toMatchObject({ status: 'loaded', persistence: { revision: 0 }, runtime: { currentAttempt: { runId: 'run-a' } } });
  });

  it('does not let an obsolete v2 writer overwrite a committed v3 attempt', () => {
    const f = fixture();
    expect(f.start().status).toBe('committed');
    const oldWriter = commitCandidateWithWriterLease(f.storage, identity, clock, 0, emptySaveCandidateV2(1));
    expect(oldWriter.status).toBe('persistence-load-failure');
    expect(f.read()).toMatchObject({ status: 'loaded', persistence: { revision: 0, sourceSaveVersion: 3 } });
  });

  it('recovers an older committed v2 backup without promoting a bare v3 slot', () => {
    const f = fixture();
    const serialized = serializeSaveDocumentV2(emptySaveCandidateV2(2));
    if (serialized.status !== 'serialized') throw new Error('v2 fixture');
    expect(commitSnapshot(f.storage, JSON.stringify(serialized.document), 2).status).toBe('committed');
    f.storage.failOnOccurrence('write', SNAPSHOT_STORAGE_KEYS.headBackup, 2);
    expect(f.execute({ kind: 'start', expectedRevision: 2, expectedRunId: null, levelId: 'level-001', creation }).status).toBe('committed');
    expect(f.read()).toMatchObject({ status: 'loaded', persistence: { revision: 3, sourceSaveVersion: 3 } });
    f.storage.data.set(SNAPSHOT_STORAGE_KEYS.head, '{bad-head');
    expect(f.read()).toMatchObject({ status: 'loaded', persistence: { revision: 2, source: 'head-backup', sourceSaveVersion: 2 }, runtime: { currentAttempt: null } });
  });

  it('does not publish when head-write outcome is ambiguous and requires a fresh read', () => {
    const f = fixture();
    expect(f.start().status).toBe('committed');
    const originalWrite = f.storage.write.bind(f.storage);
    f.storage.write = (key, value) => {
      if (key === SNAPSHOT_STORAGE_KEYS.head) {
        originalWrite(key, value);
        return { status: 'failure', operation: 'write', reason: 'exception', key, cause: new Error('ack lost') };
      }
      return originalWrite(key, value);
    };
    const result = f.execute({ kind: 'abandon', expectedRevision: 0, expectedRunId: 'run-a' });
    expect(result).toMatchObject({ status: 'rejected', reason: 'commit-commit-outcome-uncertain' });
    expect(result).not.toHaveProperty('runtime');
    // The head was actually committed; only a fresh authority read may determine the outcome.
    expect(f.read()).toMatchObject({ status: 'loaded', persistence: { revision: 1 }, runtime: { currentAttempt: null } });
    expect(f.execute({ kind: 'abandon', expectedRevision: 0, expectedRunId: 'run-a' })).toMatchObject({ status: 'rejected', reason: 'revision-conflict' });
  });
});
