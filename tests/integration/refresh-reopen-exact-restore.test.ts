import { describe, expect, it } from 'vitest';
import {
  createBoard,
  createBoardDimensions,
  createCellState,
  createCoordinate,
  type BoardState,
} from '../../src/core/board';
import { createGameState } from '../../src/core/game-state';
import { moveCharacter } from '../../src/core/movement';
import { type SaveDocumentPersistenceInputV2 } from '../../src/core/persistence/save-v2';
import { createInitialRunItemState } from '../../src/core/run-item-state';
import { setRunFlagged } from '../../src/core/run-flag';
import {
  createOnBoardPosition,
  createRunState,
  createWaitingPosition,
  createWaitingRunState,
  type RunState,
} from '../../src/core/run';
import {
  commitSnapshot,
  SNAPSHOT_STORAGE_KEYS,
} from '../../src/systems/persistence/crash-safe-snapshot-store';
import { commitCandidateWithWriterLease } from '../../src/systems/persistence/guarded-persistence';
import {
  commitCandidateSaveV2,
  loadPersistedSave,
} from '../../src/systems/persistence/persistence-coordinator';
import {
  acquireWriterLease,
  type Clock,
  type WriterIdentity,
} from '../../src/systems/persistence/writer-lease';
import { MemoryStorage } from '../helpers/memory-storage';
import { createTestAccount } from '../helpers/save-v2';

class FakeClock implements Clock {
  constructor(public value = 1_000) {}
  nowMs(): number { return this.value; }
}

const writerA: WriterIdentity = { sessionId: 'browser-instance-a', leaseToken: 'lease-a' };
const writerB: WriterIdentity = { sessionId: 'browser-instance-b', leaseToken: 'lease-b' };
const provenance = {
  seed: 123456789,
  rngVersion: 'mulberry32-v1',
  generationVersion: 'initial-board-v1',
} as const;

function playableCell(
  containsMine: boolean,
  options: { explored?: boolean; revealed?: boolean; flagged?: boolean } = {},
) {
  return createCellState({
    terrain: 'playable',
    containsMine,
    explored: options.explored ?? false,
    mineRevealed: options.revealed ?? false,
    flagged: options.flagged ?? false,
  });
}

function exactRestoreBoard(): BoardState {
  return createBoard(createBoardDimensions({ width: 4, height: 2 }), [
    playableCell(false),
    playableCell(false),
    playableCell(true),
    createCellState({
      terrain: 'obstacle', containsMine: false, explored: false,
      mineRevealed: false, flagged: false,
    }),
    playableCell(true, { revealed: true }),
    playableCell(false),
    playableCell(false),
    playableCell(false),
  ]);
}

function candidate(run: RunState, revision: number, runId = 'run-exact-restore'):
SaveDocumentPersistenceInputV2 {
  return {
    revision,
    activeRun: {
      runId,
      levelId: 'level-17',
      gameState: createGameState({
        account: createTestAccount(),
        run,
        runItems: createInitialRunItemState(provenance.seed),
      }),
      generationProvenance: provenance,
    },
  };
}

function loadedActiveRun(storage: MemoryStorage) {
  const result = loadPersistedSave(storage);
  expect(result.status === 'loaded' || result.status === 'recovered-from-backup').toBe(true);
  if (!('save' in result) || result.save.activeRun === null) {
    throw new Error('Expected a reconstructed active Run.');
  }
  return { result, activeRun: result.save.activeRun };
}

function committedFixture(run: RunState, revision = 0): MemoryStorage {
  const storage = new MemoryStorage();
  expect(commitCandidateSaveV2(storage, candidate(run, revision)).status).toBe('committed');
  return storage;
}

describe('Stage 2 refresh and reopen exact-restore integration', () => {
  it('restores the same mid-run attempt in a new browser instance without regeneration or load writes', () => {
    const storage = new MemoryStorage();
    const clock = new FakeClock();
    expect(acquireWriterLease(storage, writerA, clock, 100).status).toBe('acquired');

    const waiting = createWaitingRunState(exactRestoreBoard());
    const firstMove = moveCharacter(waiting, createCoordinate(0, 0));
    if (firstMove.outcome !== 'moved') throw new Error('Expected the first Safe move.');
    const secondMove = moveCharacter(firstMove.state, createCoordinate(1, 1));
    if (secondMove.outcome !== 'moved') throw new Error('Expected the second Safe move.');
    const wrongFlag = setRunFlagged(secondMove.state, createCoordinate(1, 0), true);
    if (wrongFlag.outcome !== 'changed') throw new Error('Expected the wrong Safe Flag.');
    const instanceARun = wrongFlag.state;
    const instanceACandidate = candidate(instanceARun, 0);

    expect(commitCandidateWithWriterLease(
      storage, writerA, clock, null, instanceACandidate,
    )).toMatchObject({ status: 'committed', revision: 0 });
    const committedDocument = JSON.stringify(instanceACandidate);
    const operationsBeforeReopen = storage.operations.length;

    const reopened = loadedActiveRun(storage);
    expect(reopened.result).toMatchObject({ status: 'loaded', revision: 0, source: 'head' });
    expect(reopened.activeRun).toMatchObject({
      runId: 'run-exact-restore',
      levelId: 'level-17',
      generationProvenance: provenance,
    });
    expect(reopened.activeRun.gameState.run).toEqual(instanceARun);
    expect(reopened.activeRun.gameState.run.board).toEqual(instanceARun.board);
    expect(reopened.activeRun.gameState.run.characterPosition).toEqual(instanceARun.characterPosition);
    expect(reopened.activeRun.gameState.run.hasTakenStep).toBe(true);
    expect(reopened.activeRun.gameState.run.phase).toEqual({ kind: 'active' });
    expect(reopened.activeRun.gameState.run).not.toBe(instanceARun);
    expect(reopened.activeRun.gameState.run.board).not.toBe(instanceARun.board);
    expect(reopened.activeRun.gameState.run.board.cells).not.toBe(instanceARun.board.cells);
    expect(Object.isFrozen(reopened.activeRun.gameState.run)).toBe(true);
    expect(Object.isFrozen(reopened.activeRun.gameState.run.board)).toBe(true);

    const reopenOperations = storage.operations.slice(operationsBeforeReopen);
    expect(reopenOperations.every((operation) => operation.startsWith('read:'))).toBe(true);
    expect(JSON.stringify([...storage.data.entries()])).not.toContain(writerB.sessionId);
    expect(committedDocument).not.toContain(writerA.sessionId);
    expect(committedDocument).not.toContain(writerA.leaseToken);

    expect(acquireWriterLease(storage, writerB, clock, 100)).toMatchObject({
      status: 'owned-by-another-session', ownerSessionId: writerA.sessionId,
    });
    expect(commitCandidateWithWriterLease(
      storage, writerB, clock, 0, candidate(reopened.activeRun.gameState.run, 1),
    )).toEqual({ status: 'writer-not-owner', reason: 'different-owner' });

    clock.value += 100;
    expect(acquireWriterLease(storage, writerB, clock, 100).status).toBe('acquired');
    expect(commitCandidateWithWriterLease(
      storage, writerB, clock, 0, candidate(reopened.activeRun.gameState.run, 1),
    )).toMatchObject({ status: 'committed', revision: 1 });
    expect(loadPersistedSave(storage)).toMatchObject({ status: 'loaded', revision: 1 });
  });

  it('restores a first-step pending encounter without moving the waiting character or revealing the Mine', () => {
    const board = createBoard(createBoardDimensions({ width: 2, height: 1 }), [
      playableCell(false),
      playableCell(true),
    ]);
    const pending = createRunState(board, createWaitingPosition(), {
      hasTakenStep: true,
      phase: {
        kind: 'pending-mine-encounter',
        encounter: { target: createCoordinate(1, 0), occurredOnFirstStep: true },
      },
    });
    const restored = loadedActiveRun(committedFixture(pending));

    expect(restored.activeRun.gameState.run).toEqual(pending);
    expect(restored.activeRun.gameState.run.characterPosition).toEqual({ kind: 'waiting' });
    expect(restored.activeRun.gameState.run.phase).toEqual({
      kind: 'pending-mine-encounter',
      encounter: { target: { x: 1, y: 0 }, occurredOnFirstStep: true },
    });
    expect(restored.activeRun.gameState.run.board.cells[1]).toEqual({
      kind: 'mine', revelation: 'hidden', flagged: false,
    });
  });

  it.each(['failed', 'won'] as const)('restores the %s terminal lifecycle fact exactly', (kind) => {
    const board = kind === 'won'
      ? createBoard(createBoardDimensions({ width: 2, height: 1 }), [
          playableCell(false, { explored: true }),
          playableCell(true, { revealed: true }),
        ])
      : createBoard(createBoardDimensions({ width: 2, height: 1 }), [
          playableCell(false, { explored: true }),
          playableCell(true),
        ]);
    const run = createRunState(board, createOnBoardPosition(createCoordinate(0, 0)), {
      hasTakenStep: true,
      phase: kind === 'won'
        ? { kind: 'won' }
        : {
            kind: 'failed',
            encounter: { target: createCoordinate(1, 0), occurredOnFirstStep: false },
          },
    });

    expect(loadedActiveRun(committedFixture(run)).activeRun.gameState.run).toEqual(run);
  });

  it('preserves exact Save facts and backup-recovery provenance', () => {
    const move = moveCharacter(createWaitingRunState(exactRestoreBoard()), createCoordinate(0, 0));
    if (move.outcome !== 'moved') throw new Error('Expected a legal Safe move.');
    const run = move.state;
    const storage = committedFixture(run, 7);
    storage.data.set(SNAPSHOT_STORAGE_KEYS.head, '{broken-head');

    const restored = loadedActiveRun(storage);
    expect(restored.result).toMatchObject({
      status: 'recovered-from-backup', source: 'head-backup', revision: 7,
    });
    expect(restored.activeRun.gameState.run).toEqual(run);
    expect(restored.activeRun.generationProvenance).toEqual(provenance);
  });

  it.each([
    ['malformed JSON', '{not-json', 'malformed-json'],
    [
      'invalid old v1',
      JSON.stringify({ saveVersion: 1, revision: 0, activeRun: null, unexpected: true }),
      'invalid-old-version-document',
    ],
    [
      'unsupported future version',
      JSON.stringify({ saveVersion: 3, revision: 0, activeRun: null }),
      'unsupported-future-version',
    ],
  ] as const)('keeps %s distinct from no-save and performs no recovery write', (_name, payload, status) => {
    const storage = new MemoryStorage();
    expect(commitSnapshot(storage, payload, 0).status).toBe('committed');
    const before = [...storage.data.entries()];
    const operationsBeforeLoad = storage.operations.length;

    expect(loadPersistedSave(storage)).toMatchObject({ status });
    expect([...storage.data.entries()]).toEqual(before);
    expect(storage.operations.slice(operationsBeforeLoad).every((operation) =>
      operation.startsWith('read:'),
    )).toBe(true);
  });

  it('distinguishes no-save from unprovable corruption without creating a new attempt', () => {
    const empty = new MemoryStorage();
    expect(loadPersistedSave(empty)).toEqual({ status: 'no-save' });
    expect(empty.data.size).toBe(0);

    const corrupt = new MemoryStorage();
    corrupt.data.set(SNAPSHOT_STORAGE_KEYS.slotA, '{broken-envelope');
    corrupt.data.set(
      SNAPSHOT_STORAGE_KEYS.head,
      JSON.stringify({ formatVersion: 1, slot: 'A', revision: 0 }),
    );
    const before = [...corrupt.data.entries()];
    expect(loadPersistedSave(corrupt)).toEqual({
      status: 'corrupt', reason: 'no-provable-committed-snapshot',
    });
    expect([...corrupt.data.entries()]).toEqual(before);
  });
});
