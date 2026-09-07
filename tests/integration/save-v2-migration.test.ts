import { describe, expect, it } from 'vitest';
import { createAccountState } from '../../src/core/account';
import { createBoard, createBoardDimensions, createCoordinate } from '../../src/core/board';
import { createGameState } from '../../src/core/game-state';
import { createInitialBoard } from '../../src/core/initial-board';
import type { ActiveRunPersistenceInputV1 } from '../../src/core/persistence/save-v1';
import type { SaveDocumentPersistenceInputV2 } from '../../src/core/persistence/save-v2';
import { createRunItemState } from '../../src/core/run-item-state';
import {
  createRevealedMineOccupancyPosition,
  createRunState,
  createWaitingRunState,
} from '../../src/core/run';
import {
  restartCurrentAttempt,
  type LevelGenerationConfiguration,
} from '../../src/systems/persistence/new-attempt';
import {
  commitCandidateSaveV1,
  commitCandidateSaveV2,
  loadPersistedSave,
} from '../../src/systems/persistence/persistence-coordinator';
import {
  acquireWriterLease,
  type Clock,
  type WriterIdentity,
} from '../../src/systems/persistence/writer-lease';
import { MemoryStorage } from '../helpers/memory-storage';

class FakeClock implements Clock {
  nowMs(): number { return 0; }
}

const writer: WriterIdentity = { sessionId: 'migration-session', leaseToken: 'migration-token' };
const provenance = {
  seed: 11,
  rngVersion: 'mulberry32-v1',
  generationVersion: 'initial-board-v1',
} as const;
const configuration: LevelGenerationConfiguration = {
  dimensions: createBoardDimensions({ width: 3, height: 1 }),
  obstacleCoordinates: [],
  mineCount: 1,
};

function v1Attempt(withProvenance = true): ActiveRunPersistenceInputV1 {
  const board = createInitialBoard({
    dimensions: configuration.dimensions,
    obstacleCoordinates: [],
    mineCoordinates: [createCoordinate(1, 0)],
  });
  if (board.status !== 'created') throw new Error('Expected v1 Board fixture.');
  return {
    runId: 'legacy-run',
    levelId: 'legacy-level',
    run: createWaitingRunState(board.board),
    ...(withProvenance ? { generationProvenance: provenance } : {}),
  };
}

describe('Save v1 to v2 read-only migration and exact reopen', () => {
  it('loads v1 by read-only in-memory migration without revision, slot, head, or payload writes', () => {
    const storage = new MemoryStorage();
    expect(commitCandidateSaveV1(storage, { revision: 7, activeRun: v1Attempt() }).status)
      .toBe('committed');
    const before = [...storage.data.entries()];
    const operationIndex = storage.operations.length;

    const loaded = loadPersistedSave(storage);

    expect(loaded).toMatchObject({
      status: 'loaded',
      revision: 7,
      save: { saveVersion: 2, sourceSaveVersion: 1 },
    });
    expect([...storage.data.entries()]).toEqual(before);
    expect(storage.operations.slice(operationIndex).every((operation) =>
      operation.startsWith('read:'),
    )).toBe(true);
    if (!('save' in loaded) || loaded.save.activeRun === null) {
      throw new Error('Expected migrated runtime.');
    }
    expect(loaded.save.document.revision).toBe(7);
    expect(loaded.save.activeRun.gameState.runItems.detectionRandomSeed).toBe(provenance.seed);
  });

  it('preserves missing Detection provenance as null instead of fabricating seed zero', () => {
    const storage = new MemoryStorage();
    expect(commitCandidateSaveV1(storage, { revision: 0, activeRun: v1Attempt(false) }).status)
      .toBe('committed');

    const loaded = loadPersistedSave(storage);

    if (!('save' in loaded) || loaded.save.activeRun === null) {
      throw new Error('Expected migrated runtime.');
    }
    expect(loaded.save.sourceSaveVersion).toBe(1);
    expect(loaded.save.activeRun.gameState.runItems.detectionRandomSeed).toBeNull();
    expect(loaded.save.document.activeRun?.runItems.detectionRandomSeed).toBeNull();
  });

  it('writes v2 only on the first real Restart mutation, then reopens exact v2 authority', () => {
    const storage = new MemoryStorage();
    const clock = new FakeClock();
    expect(commitCandidateSaveV1(storage, { revision: 0, activeRun: v1Attempt() }).status)
      .toBe('committed');
    expect(acquireWriterLease(storage, writer, clock).status).toBe('acquired');
    const migrated = loadPersistedSave(storage);
    if (!('save' in migrated) || migrated.save.activeRun === null) {
      throw new Error('Expected migrated v1 attempt.');
    }

    const restarted = restartCurrentAttempt(storage, writer, clock, {
      currentAttempt: migrated.save.activeRun,
      currentRevision: 0,
      generationConfiguration: configuration,
      runIdSource: { nextRunId: () => 'v2-run' },
    });

    expect(restarted).toMatchObject({ status: 'committed', revision: 1 });
    const reopened = loadPersistedSave(storage);
    expect(reopened).toMatchObject({
      status: 'loaded',
      revision: 1,
      save: { saveVersion: 2, sourceSaveVersion: 2 },
    });
    if (!('save' in reopened) || reopened.save.activeRun === null) {
      throw new Error('Expected reopened v2 attempt.');
    }
    expect(reopened.save.activeRun.runId).toBe('v2-run');
    expect(reopened.save.activeRun.gameState.run.characterPosition).toEqual({ kind: 'waiting' });
    expect(reopened.save.activeRun.gameState.runItems.detectionRandomSeed)
      .toBe(reopened.save.activeRun.generationProvenance?.seed);
  });

  it('restores a v2 revealed-mine occupancy without weakening ordinary position invariants', () => {
    const board = createInitialBoard({
      dimensions: createBoardDimensions({ width: 2, height: 1 }),
      obstacleCoordinates: [],
      mineCoordinates: [createCoordinate(1, 0)],
    });
    if (board.status !== 'created') throw new Error('Expected Board fixture.');
    const revealedCells = [...board.board.cells];
    revealedCells[1] = {
      kind: 'mine', revelation: 'revealed', flagged: false,
    };
    const revealedBoard = createBoard(board.board.dimensions, revealedCells);
    const run = createRunState(
      revealedBoard,
      createRevealedMineOccupancyPosition(createCoordinate(1, 0)),
      { hasTakenStep: true },
    );
    const candidate: SaveDocumentPersistenceInputV2 = {
      revision: 0,
      activeRun: {
        runId: 'occupancy-run',
        levelId: 'occupancy-level',
        gameState: createGameState({
          account: createAccountState({ lucky: 0, detection: 0, airplane: 0, revive: 0 }),
          run,
          runItems: createRunItemState({
            successfulDetectionUses: 0,
            successfulAirplaneUses: 0,
            successfulReviveUses: 0,
            detectionRandomSeed: null,
          }),
        }),
      },
    };
    const storage = new MemoryStorage();
    expect(commitCandidateSaveV2(storage, candidate).status).toBe('committed');

    const reopened = loadPersistedSave(storage);

    if (!('save' in reopened) || reopened.save.activeRun === null) {
      throw new Error('Expected occupancy restore.');
    }
    expect(reopened.save.activeRun.gameState.run.characterPosition).toEqual({
      kind: 'revealed-mine-occupancy', coordinate: { x: 1, y: 0 },
    });
  });
});
