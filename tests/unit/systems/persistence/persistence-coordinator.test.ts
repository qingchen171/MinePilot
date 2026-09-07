import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createBoard,
  createBoardDimensions,
  createCellState,
  createCoordinate,
} from '../../../../src/core/board';
import { type SaveDocumentPersistenceInputV1 } from '../../../../src/core/persistence/save-v1';
import {
  createOnBoardPosition,
  createRevealedMineOccupancyPosition,
  createRunState,
} from '../../../../src/core/run';
import {
  SNAPSHOT_STORAGE_KEYS,
  loadCommittedSnapshot,
} from '../../../../src/systems/persistence/crash-safe-snapshot-store';
import {
  commitCandidateSaveV1,
  loadPersistedSave,
} from '../../../../src/systems/persistence/persistence-coordinator';
import { MemoryStorage } from '../../../helpers/memory-storage';

function candidate(revision = 1): SaveDocumentPersistenceInputV1 {
  const board = createBoard(createBoardDimensions({ width: 2, height: 1 }), [
    createCellState({
      terrain: 'playable',
      containsMine: false,
      explored: true,
      mineRevealed: false,
      flagged: false,
    }),
    createCellState({
      terrain: 'playable',
      containsMine: true,
      explored: false,
      mineRevealed: false,
      flagged: false,
    }),
  ]);
  return {
    revision,
    activeRun: {
      runId: 'run-1',
      levelId: 'level-1',
      run: createRunState(board, createOnBoardPosition(createCoordinate(0, 0))),
      generationProvenance: {
        seed: 123,
        rngVersion: 'mulberry32-v1',
        generationVersion: 'initial-board-v1',
      },
    },
  };
}

function expectNotPublishable(result: ReturnType<typeof commitCandidateSaveV1>): void {
  expect(result.status).not.toBe('committed');
  expect(Object.hasOwn(result, 'candidate')).toBe(false);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('persistence commit coordinator', () => {
  it('returns the exact candidate only after the storage commit point succeeds', () => {
    const storage = new MemoryStorage();
    const input = candidate();

    const result = commitCandidateSaveV1(storage, input);

    expect(result).toMatchObject({
      status: 'committed',
      candidate: input,
      revision: 1,
      slot: 'A',
      backupUpdate: 'updated',
    });
    if (result.status !== 'committed') throw new Error('Expected committed candidate.');
    expect(result.candidate).toBe(input);
  });

  it('does not touch storage or expose a candidate when Save v1 serialization rejects it', () => {
    const storage = new MemoryStorage();
    const result = commitCandidateSaveV1(storage, candidate(-1));

    expect(result).toMatchObject({
      status: 'serialization-failure',
      stage: 'save-document',
      issues: [{ code: 'invalid-revision' }],
    });
    expect(storage.operations).toEqual([]);
    expectNotPublishable(result);
  });

  it('does not commit or expose a new-runtime candidate that Save v1 cannot represent', () => {
    const storage = new MemoryStorage();
    const input = candidate();
    if (input.activeRun === null) throw new Error('Expected an active Run fixture.');
    const occupancyBoard = createBoard({ width: 1, height: 1 }, [
      createCellState({
        terrain: 'playable',
        containsMine: true,
        explored: false,
        mineRevealed: true,
        flagged: false,
      }),
    ]);
    const newRuntimeCandidate: SaveDocumentPersistenceInputV1 = {
      ...input,
      activeRun: {
        ...input.activeRun,
        run: createRunState(
          occupancyBoard,
          createRevealedMineOccupancyPosition(createCoordinate(0, 0)),
        ),
      },
    };

    const result = commitCandidateSaveV1(storage, newRuntimeCandidate);

    expect(result).toEqual({
      status: 'serialization-failure',
      stage: 'save-document',
      issues: [{
        code: 'invalid-character-position',
        path: 'activeRun.characterPosition',
      }],
    });
    expect(storage.operations).toEqual([]);
    expectNotPublishable(result);
  });

  it('captures JSON serialization failure before storage is called', () => {
    const storage = new MemoryStorage();
    const failure = new TypeError('injected JSON failure');
    vi.spyOn(JSON, 'stringify').mockImplementationOnce(() => {
      throw failure;
    });

    const result = commitCandidateSaveV1(storage, candidate());

    expect(result).toEqual({
      status: 'serialization-failure',
      stage: 'json',
      cause: failure,
    });
    expect(storage.operations).toEqual([]);
    expectNotPublishable(result);
  });

  it('does not expose the candidate when inactive slot write fails', () => {
    const storage = new MemoryStorage();
    storage.failNext('write', SNAPSHOT_STORAGE_KEYS.slotA);

    const result = commitCandidateSaveV1(storage, candidate());

    expect(result).toMatchObject({
      status: 'persistence-failure',
      failure: { status: 'storage-failure', stage: 'slot-write' },
    });
    expectNotPublishable(result);
  });

  it('does not expose the candidate when slot read-back verification fails', () => {
    const storage = new MemoryStorage();
    storage.transformNextWrite(SNAPSHOT_STORAGE_KEYS.slotA, (raw) =>
      raw.replace('"revision":1', '"revision":2'),
    );

    const result = commitCandidateSaveV1(storage, candidate());

    expect(result).toEqual({
      status: 'persistence-failure',
      failure: { status: 'verification-failure', slot: 'A' },
    });
    expectNotPublishable(result);
  });

  it('does not expose the candidate when the authority head write fails', () => {
    const storage = new MemoryStorage();
    storage.failNext('write', SNAPSHOT_STORAGE_KEYS.head);

    const result = commitCandidateSaveV1(storage, candidate());

    expect(result).toMatchObject({
      status: 'persistence-failure',
      failure: { status: 'storage-failure', stage: 'new-head-write' },
    });
    expect(loadCommittedSnapshot(storage).status).not.toBe('loaded');
    expectNotPublishable(result);
  });

  it('preserves a post-commit backup warning while returning a publishable candidate', () => {
    const storage = new MemoryStorage();
    expect(commitCandidateSaveV1(storage, candidate(1)).status).toBe('committed');
    storage.failOnOccurrence('write', SNAPSHOT_STORAGE_KEYS.headBackup, 2);

    const next = candidate(2);
    const result = commitCandidateSaveV1(storage, next);

    expect(result).toMatchObject({
      status: 'committed',
      candidate: next,
      revision: 2,
      slot: 'B',
      backupUpdate: 'failed',
      backupFailure: { operation: 'write', key: SNAPSHOT_STORAGE_KEYS.headBackup },
    });
  });

  it('does not mutate old runtime or candidate runtime while committing', () => {
    const storage = new MemoryStorage();
    const old = candidate(1);
    const next = candidate(2);
    const oldBefore = structuredClone(old);
    const nextBefore = structuredClone(next);

    expect(commitCandidateSaveV1(storage, next).status).toBe('committed');

    expect(old).toEqual(oldBefore);
    expect(next).toEqual(nextBefore);
  });

  it('distinguishes no save from storage corruption and storage failure', () => {
    expect(loadPersistedSave(new MemoryStorage())).toEqual({ status: 'no-save' });

    const corrupt = new MemoryStorage();
    corrupt.data.set(SNAPSHOT_STORAGE_KEYS.slotA, 'orphan');
    expect(loadPersistedSave(corrupt)).toEqual({
      status: 'corrupt',
      reason: 'no-provable-committed-snapshot',
    });

    const unavailable = new MemoryStorage();
    unavailable.failNext('read', SNAPSHOT_STORAGE_KEYS.head);
    expect(loadPersistedSave(unavailable)).toMatchObject({
      status: 'storage-failure',
      failure: { operation: 'read', key: SNAPSHOT_STORAGE_KEYS.head },
    });
  });
});
