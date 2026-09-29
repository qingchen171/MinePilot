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
import { createGameState } from '../../src/core/game-state';
import { createAccountState } from '../../src/core/account';
import { createStage4GameState } from '../../src/core/stage4-game-state';
import { mapStage4RuntimeToSaveV3 } from '../../src/core/persistence/stage4-runtime-mapping';
import { createInitialBoard } from '../../src/core/initial-board';
import { createWaitingRunState } from '../../src/core/run';

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

  it('migrates a rich v1 Attempt read-only and makes its first legal mutation a v3 N+1 commit', () => {
    const storage = new MemoryStorage();
    const board = createInitialBoard({ dimensions: { width: 2, height: 1 }, obstacleCoordinates: [], mineCoordinates: [{ x: 1, y: 0 }] });
    if (board.status !== 'created') throw new Error('v1 board fixture');
    const serialized = serializeSaveDocumentV1({
      revision: 6,
      activeRun: {
        runId: 'legacy-v1-run',
        levelId: 'level-001',
        run: createWaitingRunState(board.board),
        generationProvenance: { seed: 17, rngVersion: 'mulberry32-v1', generationVersion: 'mine-placement-v1' },
      },
    });
    if (serialized.status !== 'serialized') throw new Error('v1 fixture');
    expect(commitSnapshot(storage, JSON.stringify(serialized.document), 6).status).toBe('committed');
    const beforeOperations = storage.operations.length;
    const session = createProductionStage4Session(storage, identity, clock);
    expect(session.read()).toMatchObject({ status: 'loaded', persistence: { revision: 6, sourceSaveVersion: 1 }, runtime: {
      currentAttempt: { runId: 'legacy-v1-run', run: { characterPosition: { kind: 'waiting' } }, generationProvenance: { seed: 17 } },
    } });
    expect(storage.operations.slice(beforeOperations).every((operation) => operation.startsWith('read:'))).toBe(true);
    expect(session.execute({ kind: 'flag', expectedRevision: 6, expectedRunId: 'legacy-v1-run', coordinate: { x: 0, y: 0 }, flagged: true }).status).toBe('committed');
    const reopened = createProductionStage4Session(storage, identity, clock).read();
    expect(reopened).toMatchObject({ status: 'loaded', persistence: { revision: 7, sourceSaveVersion: 3 } });
    if (reopened.status !== 'loaded' || reopened.runtime.currentAttempt === null) return;
    expect(reopened.runtime.currentAttempt.run.board.cells[0]).toMatchObject({ kind: 'safe', flagged: true });
  });

  it('preserves rich v2 gameplay and Item facts through a production mutation and exact v3 reopen', () => {
    const source = fixture();
    expect(source.start().status).toBe('committed');
    const initial = source.read();
    if (initial.status !== 'loaded' || initial.runtime.currentAttempt === null) throw new Error('v2 source fixture');
    const board = initial.runtime.currentAttempt.run.board;
    const mine = board.cells.findIndex((cell) => cell.kind === 'mine');
    const point = (index: number) => ({ x: index % board.dimensions.width, y: Math.floor(index / board.dimensions.width) });
    expect(source.execute({ kind: 'move', expectedRevision: 0, expectedRunId: 'run-a', coordinate: point(mine) }).status).toBe('committed');
    expect(source.execute({ kind: 'detection', expectedRevision: 1, expectedRunId: 'run-a', initializeSeed: 99 }).status).toBe('committed');
    const rich = source.read();
    if (rich.status !== 'loaded' || rich.runtime.currentAttempt === null) throw new Error('rich v2 fixture');
    const attempt = rich.runtime.currentAttempt;
    const serialized = serializeSaveDocumentV2({
      revision: 3,
      activeRun: {
        runId: attempt.runId,
        levelId: attempt.levelId,
        gameState: createGameState({ account: createAccountState(rich.runtime.account.inventory), run: attempt.run, runItems: attempt.runItems }),
        ...(attempt.generationProvenance === null ? {} : { generationProvenance: attempt.generationProvenance }),
      },
    });
    if (serialized.status !== 'serialized') throw new Error('v2 fixture');
    expect(commitSnapshot(source.storage, JSON.stringify(serialized.document), 3).status).toBe('committed');
    const session = createProductionStage4Session(source.storage, identity, clock);
    const migrated = session.read();
    expect(migrated).toMatchObject({ status: 'loaded', persistence: { revision: 3, sourceSaveVersion: 2 }, runtime: {
      account: { inventory: rich.runtime.account.inventory }, currentAttempt: {
        run: { characterPosition: attempt.run.characterPosition, phase: attempt.run.phase }, runItems: attempt.runItems,
        generationProvenance: attempt.generationProvenance,
      },
    } });
    if (migrated.status !== 'loaded' || migrated.runtime.currentAttempt === null) return;
    expect(migrated.runtime.currentAttempt.run.board).toEqual(attempt.run.board);
    const safeIndex = migrated.runtime.currentAttempt.run.board.cells.findIndex((cell) => cell.kind === 'safe' && cell.exploration === 'unexplored');
    expect(session.execute({ kind: 'flag', expectedRevision: 3, expectedRunId: 'run-a', coordinate: point(safeIndex), flagged: true }).status).toBe('committed');
    const reopened = createProductionStage4Session(source.storage, identity, clock).read();
    expect(reopened).toMatchObject({ status: 'loaded', persistence: { revision: 4, sourceSaveVersion: 3 }, runtime: {
      account: { inventory: rich.runtime.account.inventory }, currentAttempt: {
        run: { characterPosition: attempt.run.characterPosition, phase: attempt.run.phase }, runItems: attempt.runItems,
        generationProvenance: attempt.generationProvenance,
      },
    } });
    if (reopened.status !== 'loaded' || reopened.runtime.currentAttempt === null) return;
    expect(reopened.runtime.currentAttempt.run.board).toEqual({
      ...attempt.run.board,
      cells: attempt.run.board.cells.map((cell, index) => index === safeIndex ? { ...cell, flagged: true } : cell),
    });
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

  it('keeps cached production-session authority unchanged until an uncertain commit is explicitly reloaded', () => {
    const storage = new MemoryStorage();
    const session = createProductionStage4Session(storage, identity, clock);
    expect(session.execute({ kind: 'start', expectedRevision: null, expectedRunId: null, levelId: 'level-001', creation }).status).toBe('committed');
    const before = session.read();
    const originalWrite = storage.write.bind(storage);
    storage.write = (key, value) => {
      if (key === SNAPSHOT_STORAGE_KEYS.head) {
        originalWrite(key, value);
        return { status: 'failure', operation: 'write', reason: 'exception', key, cause: new Error('ack lost') };
      }
      return originalWrite(key, value);
    };

    expect(session.execute({ kind: 'abandon', expectedRevision: 0, expectedRunId: 'run-a' }))
      .toMatchObject({ status: 'rejected', reason: 'commit-commit-outcome-uncertain' });
    expect(session.read()).toBe(before);
    expect(session.read()).toMatchObject({ status: 'loaded', persistence: { revision: 0 }, runtime: { currentAttempt: { runId: 'run-a' } } });
    expect(session.reload()).toMatchObject({ status: 'loaded', persistence: { revision: 1 }, runtime: { currentAttempt: null } });
  });

  it('lets a new production session take an expired lease while the stale session must reload', () => {
    const storage = new MemoryStorage();
    let now = 100;
    const mutableClock = { nowMs: () => now };
    const first = createProductionStage4Session(storage, { sessionId: 'first', leaseToken: 'first-token' }, mutableClock);
    const second = createProductionStage4Session(storage, { sessionId: 'second', leaseToken: 'second-token' }, mutableClock);
    expect(first.execute({ kind: 'start', expectedRevision: null, expectedRunId: null, levelId: 'level-001', creation }).status).toBe('committed');
    now = 31_000;
    expect(second.reload()).toMatchObject({ status: 'loaded', persistence: { revision: 0 } });
    expect(second.execute({ kind: 'abandon', expectedRevision: 0, expectedRunId: 'run-a' }).status).toBe('committed');
    expect(first.execute({ kind: 'abandon', expectedRevision: 0, expectedRunId: 'run-a' }).status).toBe('rejected');
    expect(first.read()).toMatchObject({ status: 'loaded', persistence: { revision: 0 }, runtime: { currentAttempt: { runId: 'run-a' } } });
    expect(first.reload()).toMatchObject({ status: 'loaded', persistence: { revision: 1 }, runtime: { currentAttempt: null } });
  });

  it('restores a historical missing-catalog Attempt, rejects replacement, and permits legal dismissal', () => {
    const f = fixture();
    expect(f.start().status).toBe('committed');
    const started = f.read();
    if (started.status !== 'loaded' || started.runtime.currentAttempt === null) throw new Error('historical fixture');
    const board = started.runtime.currentAttempt.run.board;
    const safe = board.cells.findIndex((cell) => cell.kind === 'safe');
    const mine = board.cells.findIndex((cell) => cell.kind === 'mine');
    const point = (index: number) => ({ x: index % board.dimensions.width, y: Math.floor(index / board.dimensions.width) });
    expect(f.execute({ kind: 'move', expectedRevision: 0, expectedRunId: 'run-a', coordinate: point(safe) }).status).toBe('committed');
    expect(f.execute({ kind: 'move', expectedRevision: 1, expectedRunId: 'run-a', coordinate: point(mine) }).status).toBe('committed');
    expect(f.execute({ kind: 'failure', expectedRevision: 2, expectedRunId: 'run-a' }).status).toBe('committed');
    const failed = f.read();
    if (failed.status !== 'loaded' || failed.runtime.currentAttempt === null) throw new Error('failed fixture');
    const legacy = serializeSaveDocumentV2({
      revision: 4,
      activeRun: {
        runId: 'historical-run',
        levelId: 'missing-historical-level',
        gameState: createGameState({
          account: createAccountState(failed.runtime.account.inventory),
          run: failed.runtime.currentAttempt.run,
          runItems: failed.runtime.currentAttempt.runItems,
        }),
        ...(failed.runtime.currentAttempt.generationProvenance === null ? {} : { generationProvenance: failed.runtime.currentAttempt.generationProvenance }),
      },
    });
    if (legacy.status !== 'serialized') throw new Error('legacy fixture');
    expect(commitSnapshot(f.storage, JSON.stringify(legacy.document), 4).status).toBe('committed');

    const session = createProductionStage4Session(f.storage, identity, clock);
    expect(session.read()).toMatchObject({ status: 'loaded', persistence: { revision: 4, sourceSaveVersion: 2 }, runtime: { currentAttempt: { runId: 'historical-run', levelId: 'missing-historical-level' } } });
    const before = session.read();
    expect(session.execute({ kind: 'retry', expectedRevision: 4, expectedRunId: 'historical-run', creation: { ...creation, runId: 'replacement' } }))
      .toEqual({ status: 'rejected', reason: 'level-not-found' });
    expect(session.read()).toBe(before);
    expect(session.execute({ kind: 'dismiss', expectedRevision: 4, expectedRunId: 'historical-run' }).status).toBe('committed');
    expect(createProductionStage4Session(f.storage, identity, clock).read())
      .toMatchObject({ status: 'loaded', persistence: { revision: 5, sourceSaveVersion: 3 }, runtime: { currentAttempt: null } });
  });

  it('keeps one-time Reward and Account claim authority synchronized across production mutation and reopen', () => {
    const f = fixture();
    expect(f.start().status).toBe('committed');
    const started = f.read();
    if (started.status !== 'loaded' || started.runtime.currentAttempt === null) throw new Error('reward fixture');
    const attempt = started.runtime.currentAttempt;
    const reward = attempt.rewards[0];
    if (reward === undefined) throw new Error('reward fixture');
    const richRuntime = createStage4GameState({
      account: started.runtime.account,
      currentAttempt: {
        ...attempt,
        rewards: attempt.rewards.map((entry, index) => index === 0 ? { ...entry, oneTimeClaimId: 'historical-one-time' } : entry),
      },
    });
    const mapped = mapStage4RuntimeToSaveV3(richRuntime, 1);
    if (mapped.status !== 'mapped') throw new Error('v3 mapping fixture');
    expect(commitSnapshot(f.storage, JSON.stringify(mapped.document), 1).status).toBe('committed');

    const session = createProductionStage4Session(f.storage, identity, clock);
    expect(session.execute({ kind: 'move', expectedRevision: 1, expectedRunId: 'run-a', coordinate: reward.coordinate }).status).toBe('committed');
    const reopened = createProductionStage4Session(f.storage, identity, clock).read();
    expect(reopened).toMatchObject({ status: 'loaded', persistence: { revision: 2, sourceSaveVersion: 3 }, runtime: { account: { oneTimeClaimIds: ['historical-one-time'] } } });
    if (reopened.status !== 'loaded' || reopened.runtime.currentAttempt === null) return;
    expect(reopened.runtime.account.oneTimeClaimIds.filter((id) => id === 'historical-one-time')).toHaveLength(1);
    expect(reopened.runtime.currentAttempt.rewards.find((entry) => entry.oneTimeClaimId === 'historical-one-time'))
      .toMatchObject({ claimed: true });
  });
});
