import { describe, expect, it } from 'vitest';
import { createBoardDimensions, createCoordinate, type Coordinate } from '../../src/core/board';
import { createInitialBoard } from '../../src/core/initial-board';
import { selectMineCoordinates } from '../../src/core/mine-placement';
import { moveCharacter } from '../../src/core/movement';
import type { ActiveRunPersistenceInputV1 } from '../../src/core/persistence/save-v1';
import { createSeededRandomSource } from '../../src/core/random';
import { setRunFlagged } from '../../src/core/run-flag';
import { createRunState, createWaitingPosition, createWaitingRunState, type RunPhase } from '../../src/core/run';
import { SNAPSHOT_STORAGE_KEYS } from '../../src/systems/persistence/crash-safe-snapshot-store';
import { commitCandidateWithWriterLease } from '../../src/systems/persistence/guarded-persistence';
import {
  restartCurrentAttempt,
  retryFailedAttempt,
  type LevelGenerationConfiguration,
} from '../../src/systems/persistence/new-attempt';
import { loadPersistedSave } from '../../src/systems/persistence/persistence-coordinator';
import { acquireWriterLease, type Clock, type WriterIdentity } from '../../src/systems/persistence/writer-lease';
import { MemoryStorage } from '../helpers/memory-storage';

class FakeClock implements Clock {
  nowMs(): number { return 0; }
}

const writer: WriterIdentity = { sessionId: 'writer', leaseToken: 'token' };
const configuration: LevelGenerationConfiguration = {
  dimensions: createBoardDimensions({ width: 3, height: 2 }),
  obstacleCoordinates: [createCoordinate(2, 1)],
  mineCount: 1,
};

function coordinateKey({ x, y }: Coordinate): string { return `${x},${y}`; }

function candidates(config = configuration): readonly Coordinate[] {
  const obstacles = new Set(config.obstacleCoordinates.map(coordinateKey));
  return Array.from(
    { length: config.dimensions.width * config.dimensions.height },
    (_, index) => createCoordinate(index % config.dimensions.width, Math.floor(index / config.dimensions.width)),
  ).filter((coordinate) => !obstacles.has(coordinateKey(coordinate)));
}

function minesForSeed(seed: number, config = configuration): readonly Coordinate[] {
  const result = selectMineCoordinates(candidates(config), config.mineCount, createSeededRandomSource(seed));
  if (result.status !== 'selected') throw new Error('Expected valid Mine placement.');
  return result.coordinates;
}

function mineKeys(attempt: ActiveRunPersistenceInputV1): string[] {
  const width = attempt.run.board.dimensions.width;
  return attempt.run.board.cells.flatMap((cell, index) =>
    cell.kind === 'mine' ? [`${index % width},${Math.floor(index / width)}`] : [],
  );
}

function attempt(seed: number, phase: RunPhase = { kind: 'active' }): ActiveRunPersistenceInputV1 {
  const created = createInitialBoard({
    dimensions: configuration.dimensions,
    obstacleCoordinates: configuration.obstacleCoordinates,
    mineCoordinates: minesForSeed(seed),
  });
  if (created.status !== 'created') throw new Error('Expected initial Board.');
  let run = createWaitingRunState(created.board);
  if (phase.kind === 'active') {
    const safe = candidates().filter((coordinate) => !mineKeys({
      runId: 'temporary', levelId: 'level', run, generationProvenance: {
        seed, rngVersion: 'mulberry32-v1', generationVersion: 'initial-board-v1',
      },
    }).includes(coordinateKey(coordinate)));
    const moved = moveCharacter(run, safe[0]);
    if (moved.outcome !== 'moved') throw new Error('Expected historical Safe movement.');
    const flagged = setRunFlagged(moved.state, safe[1], true);
    if (flagged.outcome !== 'changed') throw new Error('Expected historical wrong Flag.');
    run = flagged.state;
  } else {
    const target = minesForSeed(seed)[0];
    run = createRunState(created.board, createWaitingPosition(), {
      hasTakenStep: true,
      phase: phase.kind === 'won'
        ? phase
        : { kind: phase.kind, encounter: { target, occurredOnFirstStep: true } },
    });
  }
  return {
    runId: 'old-run',
    levelId: 'level-7',
    run,
    generationProvenance: {
      seed,
      rngVersion: 'mulberry32-v1',
      generationVersion: 'initial-board-v1',
    },
  };
}

function setup(currentAttempt: ActiveRunPersistenceInputV1) {
  const storage = new MemoryStorage();
  const clock = new FakeClock();
  expect(acquireWriterLease(storage, writer, clock).status).toBe('acquired');
  expect(commitCandidateWithWriterLease(storage, writer, clock, null, {
    revision: 0, activeRun: currentAttempt,
  }).status).toBe('committed');
  return { storage, clock };
}

function request(currentAttempt: ActiveRunPersistenceInputV1, runId = 'new-run') {
  return {
    currentAttempt,
    currentRevision: 0,
    generationConfiguration: configuration,
    runIdSource: { nextRunId: () => runId },
  };
}

function expectCleanNewAttempt(result: ReturnType<typeof restartCurrentAttempt>, old: ActiveRunPersistenceInputV1) {
  expect(result.status).toBe('committed');
  if (result.status !== 'committed' || result.candidate.activeRun === null) {
    throw new Error('Expected a committed new attempt.');
  }
  const next = result.candidate.activeRun;
  expect(next.runId).toBe('new-run');
  expect(next.runId).not.toBe(old.runId);
  expect(next.levelId).toBe(old.levelId);
  expect(result.revision).toBe(1);
  expect(next.run).toMatchObject({
    characterPosition: { kind: 'waiting' }, hasTakenStep: false, phase: { kind: 'active' },
  });
  expect(next.run.board.cells.every((cell) =>
    cell.kind === 'obstacle' ||
    (cell.kind === 'safe' && cell.exploration === 'unexplored' && !cell.flagged) ||
    (cell.kind === 'mine' && cell.revelation === 'hidden' && !cell.flagged),
  )).toBe(true);
  expect(mineKeys(next)).not.toEqual(mineKeys(old));
  expect(next.run.board.cells.map((cell) => cell.kind === 'obstacle'))
    .toEqual(old.run.board.cells.map((cell) => cell.kind === 'obstacle'));
  expect(next.generationProvenance?.seed).toBe(result.selectedSeed);
  return next;
}

describe('Restart and Retry persistence semantics', () => {
  it('explicitly restarts a historical active attempt as a clean persisted new attempt', () => {
    const old = attempt(1);
    const { storage, clock } = setup(old);
    const result = restartCurrentAttempt(storage, writer, clock, request(old));
    expectCleanNewAttempt(result, old);
    expect(old.run.hasTakenStep).toBe(true);
    expect(old.run.board.cells.some((cell) => cell.kind === 'safe' && cell.flagged)).toBe(true);
  });

  it('restarts pending without treating the encounter as Failure or leaking it', () => {
    const old = attempt(2, { kind: 'pending-mine-encounter', encounter: {
      target: createCoordinate(0, 0), occurredOnFirstStep: true,
    } });
    const { storage, clock } = setup(old);
    expectCleanNewAttempt(restartCurrentAttempt(storage, writer, clock, request(old)), old);
    expect(old.run.phase.kind).toBe('pending-mine-encounter');
  });

  it('retries only a failed attempt and rejects active, pending, and won', () => {
    const failed = attempt(3, { kind: 'failed', encounter: {
      target: createCoordinate(0, 0), occurredOnFirstStep: true,
    } });
    const ready = setup(failed);
    expectCleanNewAttempt(retryFailedAttempt(ready.storage, writer, ready.clock, request(failed)), failed);

    for (const current of [
      attempt(4),
      attempt(5, { kind: 'pending-mine-encounter', encounter: {
        target: createCoordinate(0, 0), occurredOnFirstStep: true,
      } }),
    ]) {
      expect(retryFailedAttempt(new MemoryStorage(), writer, new FakeClock(), request(current)))
        .toEqual({ status: 'rejected', reason: 'retry-not-allowed' });
    }
    const wonBoard = createInitialBoard({
      dimensions: createBoardDimensions({ width: 1, height: 1 }),
      obstacleCoordinates: [createCoordinate(0, 0)], mineCoordinates: [],
    });
    if (wonBoard.status !== 'created') throw new Error('Expected won fixture Board.');
    const won = { ...attempt(6), run: createRunState(wonBoard.board, createWaitingPosition(), {
      phase: { kind: 'won' },
    }) };
    expect(retryFailedAttempt(new MemoryStorage(), writer, new FakeClock(), request(won)))
      .toEqual({ status: 'rejected', reason: 'retry-not-allowed' });
  });

  it('deterministically skips a colliding next seed and selects the first different layout', () => {
    const seed = Array.from({ length: 1_000 }, (_, value) => value).find((value) =>
      coordinateKey(minesForSeed(value)[0]) === coordinateKey(minesForSeed(value + 1)[0]) &&
      coordinateKey(minesForSeed(value)[0]) !== coordinateKey(minesForSeed(value + 2)[0]),
    );
    if (seed === undefined) throw new Error('Expected a deterministic collision fixture.');
    const old = attempt(seed);
    const ready = setup(old);
    const result = restartCurrentAttempt(ready.storage, writer, ready.clock, request(old));
    expect(result).toMatchObject({ status: 'committed', selectedSeed: seed + 2, generationAttempts: 2 });
    expectCleanNewAttempt(result, old);
  });

  it('rejects a mathematically unique Mine layout and a repeated runId without committing', () => {
    const uniqueConfig: LevelGenerationConfiguration = {
      dimensions: createBoardDimensions({ width: 1, height: 1 }),
      obstacleCoordinates: [], mineCount: 1,
    };
    const old = attempt(7);
    const ready = setup(old);
    expect(restartCurrentAttempt(ready.storage, writer, ready.clock, {
      ...request(old), generationConfiguration: uniqueConfig,
    })).toEqual({ status: 'rejected', reason: 'generation-configuration-mismatch' });

    expect(restartCurrentAttempt(ready.storage, writer, ready.clock, request(old, old.runId)))
      .toEqual({ status: 'rejected', reason: 'same-run-id' });
    expect(loadPersistedSave(ready.storage)).toMatchObject({ status: 'loaded', revision: 0 });
  });

  it('returns no-alternative for a matching all-Mine configuration', () => {
    const config: LevelGenerationConfiguration = {
      dimensions: createBoardDimensions({ width: 1, height: 1 }), obstacleCoordinates: [], mineCount: 1,
    };
    const created = createInitialBoard({ ...config, mineCoordinates: [createCoordinate(0, 0)] });
    if (created.status !== 'created') throw new Error('Expected unique-layout Board.');
    const old: ActiveRunPersistenceInputV1 = {
      runId: 'old-run', levelId: 'level-unique', run: createWaitingRunState(created.board),
      generationProvenance: { seed: 1, rngVersion: 'mulberry32-v1', generationVersion: 'initial-board-v1' },
    };
    const ready = setup(old);
    expect(restartCurrentAttempt(ready.storage, writer, ready.clock, {
      ...request(old), generationConfiguration: config,
    })).toEqual({ status: 'rejected', reason: 'no-alternative-mine-layout' });
  });

  it('keeps old in-memory and persisted authority when storage commit fails', () => {
    const old = attempt(8);
    const oldSnapshot = structuredClone(old);
    const ready = setup(old);
    ready.storage.failNext('write', SNAPSHOT_STORAGE_KEYS.slotB);
    const result = restartCurrentAttempt(ready.storage, writer, ready.clock, request(old));
    expect(result).toMatchObject({ status: 'commit-rejected' });
    expect(Object.hasOwn(result, 'candidate')).toBe(false);
    expect(old).toEqual(oldSnapshot);
    const loaded = loadPersistedSave(ready.storage);
    expect(loaded).toMatchObject({ status: 'loaded', revision: 0 });
    if (!('save' in loaded) || loaded.save.activeRun === null) throw new Error('Expected old authority.');
    expect(loaded.save.activeRun.runId).toBe(old.runId);
  });

  it('rejects stale revision and lost ownership without overwriting the committed attempt', () => {
    const old = attempt(9);
    const ready = setup(old);
    const first = restartCurrentAttempt(ready.storage, writer, ready.clock, request(old, 'new-run'));
    expect(first.status).toBe('committed');
    const stale = restartCurrentAttempt(ready.storage, writer, ready.clock, request(old, 'stale-run'));
    expect(stale).toMatchObject({
      status: 'commit-rejected', failure: { status: 'revision-conflict', actualRevision: 1 },
    });
    expect(restartCurrentAttempt(
      ready.storage,
      { sessionId: 'other', leaseToken: 'other' },
      ready.clock,
      { ...request(old, 'other-run'), currentRevision: 1 },
    )).toMatchObject({ status: 'commit-rejected', failure: { status: 'writer-not-owner' } });
    expect(loadPersistedSave(ready.storage)).toMatchObject({ status: 'loaded', revision: 1 });
  });

  it('reopen restores the successfully committed new attempt rather than the old one', () => {
    const old = attempt(10);
    const ready = setup(old);
    const result = restartCurrentAttempt(ready.storage, writer, ready.clock, request(old));
    const next = expectCleanNewAttempt(result, old);
    const reopened = loadPersistedSave(ready.storage);
    expect(reopened).toMatchObject({ status: 'loaded', revision: 1 });
    if (!('save' in reopened) || reopened.save.activeRun === null) throw new Error('Expected reopened attempt.');
    expect(reopened.save.activeRun.runId).toBe(next.runId);
    expect(reopened.save.activeRun.run.board).toEqual(next.run.board);
  });
});
