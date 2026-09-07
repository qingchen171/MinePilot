import { describe, expect, it } from 'vitest';
import { createBoardDimensions, createCoordinate, type Coordinate } from '../../src/core/board';
import { createInitialBoard } from '../../src/core/initial-board';
import { selectMineCoordinates } from '../../src/core/mine-placement';
import type { ActiveRunPersistenceInputV1 } from '../../src/core/persistence/save-v1';
import { createSeededRandomSource } from '../../src/core/random';
import { createWaitingRunState } from '../../src/core/run';
import {
  commitSnapshot,
  SNAPSHOT_STORAGE_KEYS,
} from '../../src/systems/persistence/crash-safe-snapshot-store';
import { commitCandidateWithWriterLease } from '../../src/systems/persistence/guarded-persistence';
import {
  restartCurrentAttempt,
  type LevelGenerationConfiguration,
} from '../../src/systems/persistence/new-attempt';
import { loadPersistedSave } from '../../src/systems/persistence/persistence-coordinator';
import { acquireWriterLease, type Clock, type WriterIdentity } from '../../src/systems/persistence/writer-lease';
import { MemoryStorage } from '../helpers/memory-storage';
import { activeRunV2FromV1 } from '../helpers/save-v2';

class FakeClock implements Clock {
  nowMs(): number { return 0; }
}

const writer: WriterIdentity = { sessionId: 'freeze-writer', leaseToken: 'freeze-token' };
const config: LevelGenerationConfiguration = {
  dimensions: createBoardDimensions({ width: 3, height: 1 }),
  obstacleCoordinates: [],
  mineCount: 1,
};

function candidates(configuration: LevelGenerationConfiguration): readonly Coordinate[] {
  const obstacles = new Set(configuration.obstacleCoordinates.map(({ x, y }) => `${x},${y}`));
  return Array.from(
    { length: configuration.dimensions.width * configuration.dimensions.height },
    (_, index) => createCoordinate(
      index % configuration.dimensions.width,
      Math.floor(index / configuration.dimensions.width),
    ),
  ).filter(({ x, y }) => !obstacles.has(`${x},${y}`));
}

function mines(seed: number, configuration = config): readonly Coordinate[] {
  const result = selectMineCoordinates(
    candidates(configuration),
    configuration.mineCount,
    createSeededRandomSource(seed),
  );
  if (result.status !== 'selected') throw new Error('Expected valid placement fixture.');
  return result.coordinates;
}

function attempt(seed: number, configuration = config): ActiveRunPersistenceInputV1 {
  const board = createInitialBoard({
    dimensions: configuration.dimensions,
    obstacleCoordinates: configuration.obstacleCoordinates,
    mineCoordinates: mines(seed, configuration),
  });
  if (board.status !== 'created') throw new Error('Expected valid Board fixture.');
  return {
    runId: 'old-run',
    levelId: 'level-freeze',
    run: createWaitingRunState(board.board),
    generationProvenance: {
      seed,
      rngVersion: 'mulberry32-v1',
      generationVersion: 'initial-board-v1',
    },
  };
}

function ready(old: ActiveRunPersistenceInputV1) {
  const storage = new MemoryStorage();
  const clock = new FakeClock();
  expect(acquireWriterLease(storage, writer, clock).status).toBe('acquired');
  expect(commitCandidateWithWriterLease(storage, writer, clock, null, {
    revision: 0,
    activeRun: activeRunV2FromV1(old),
  }).status).toBe('committed');
  return { storage, clock };
}

function restartRequest(
  old: ActiveRunPersistenceInputV1,
  configuration = config,
  maxGenerationAttempts?: number,
) {
  return {
    currentAttempt: activeRunV2FromV1(old),
    currentRevision: 0,
    generationConfiguration: configuration,
    runIdSource: { nextRunId: () => 'new-run' },
    ...(maxGenerationAttempts === undefined ? {} : { maxGenerationAttempts }),
  };
}

describe('Stage 2 persistence Freeze Gate', () => {
  it('uses a recovered backup revision as authority for Restart N to N+1 and reopens the new attempt', () => {
    const old = attempt(12);
    const { storage, clock } = ready(old);
    storage.data.set(SNAPSHOT_STORAGE_KEYS.head, '{broken-head');
    expect(loadPersistedSave(storage)).toMatchObject({
      status: 'recovered-from-backup', source: 'head-backup', revision: 0,
    });

    const restarted = restartCurrentAttempt(storage, writer, clock, restartRequest(old));
    expect(restarted).toMatchObject({ status: 'committed', revision: 1 });
    const reopened = loadPersistedSave(storage);
    expect(reopened).toMatchObject({ status: 'loaded', revision: 1 });
    if (!('save' in reopened) || reopened.save.activeRun === null) {
      throw new Error('Expected the new persisted attempt.');
    }
    expect(reopened.save.activeRun.runId).toBe('new-run');
    expect(reopened.save.activeRun.levelId).toBe(old.levelId);
  });

  it('does not bypass a committed head with malformed payload by selecting a valid backup', () => {
    const old = attempt(13);
    const { storage, clock } = ready(old);
    const previousHead = storage.data.get(SNAPSHOT_STORAGE_KEYS.head);
    if (previousHead === undefined) throw new Error('Expected committed head fixture.');
    expect(commitSnapshot(storage, '{malformed-json', 1).status).toBe('committed');
    storage.data.set(SNAPSHOT_STORAGE_KEYS.headBackup, previousHead);
    const before = [...storage.data.entries()];

    expect(loadPersistedSave(storage)).toMatchObject({
      status: 'malformed-json', source: 'head', revision: 1,
    });
    const result = restartCurrentAttempt(storage, writer, clock, restartRequest(old));
    expect(result).toMatchObject({
      status: 'commit-rejected',
      failure: { status: 'persistence-load-failure', failure: { status: 'malformed-json' } },
    });
    expect(Object.hasOwn(result, 'candidate')).toBe(false);
    expect([...storage.data.entries()]).toEqual(before);
  });

  it('terminates safely for zero Mines and for a bounded collision search', () => {
    const zeroConfig: LevelGenerationConfiguration = {
      dimensions: createBoardDimensions({ width: 1, height: 1 }),
      obstacleCoordinates: [],
      mineCount: 0,
    };
    const zero = attempt(0, zeroConfig);
    const zeroReady = ready(zero);
    expect(restartCurrentAttempt(
      zeroReady.storage,
      writer,
      zeroReady.clock,
      restartRequest(zero, zeroConfig),
    )).toEqual({ status: 'rejected', reason: 'no-alternative-mine-layout' });

    const collisionSeed = Array.from({ length: 1_000 }, (_, seed) => seed).find((seed) =>
      JSON.stringify(mines(seed)) === JSON.stringify(mines(seed + 1)),
    );
    if (collisionSeed === undefined) throw new Error('Expected deterministic collision fixture.');
    const collision = attempt(collisionSeed);
    const collisionReady = ready(collision);
    expect(restartCurrentAttempt(
      collisionReady.storage,
      writer,
      collisionReady.clock,
      restartRequest(collision, config, 1),
    )).toEqual({ status: 'rejected', reason: 'generation-search-exhausted' });
    expect(loadPersistedSave(collisionReady.storage)).toMatchObject({ status: 'loaded', revision: 0 });
  });

  it('wraps uint32 seed progression without invalid Board output or an infinite loop', () => {
    const maxSeed = 0xffff_ffff;
    const old = attempt(maxSeed);
    const { storage, clock } = ready(old);
    const restarted = restartCurrentAttempt(storage, writer, clock, restartRequest(old));
    expect(restarted.status).toBe('committed');
    if (restarted.status !== 'committed' || restarted.candidate.activeRun === null) {
      throw new Error('Expected wrapped-seed Restart.');
    }
    expect(restarted.selectedSeed).toBe(
      (maxSeed + restarted.generationAttempts) % 0x1_0000_0000,
    );
    expect(restarted.selectedSeed).toBeGreaterThanOrEqual(0);
    expect(restarted.selectedSeed).toBeLessThanOrEqual(maxSeed);
    expect(restarted.candidate.activeRun.gameState.run.board.cells).toHaveLength(3);
  });
});
