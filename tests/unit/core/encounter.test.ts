import { describe, expect, it } from 'vitest';
import {
  createBoard,
  createCellState,
  createCoordinate,
  getCellAt,
  type BoardState,
  type CellState,
} from '../../../src/core/board';
import { settleMineEncounterAsFailure } from '../../../src/core/encounter';
import { moveCharacter, type MoveCharacterResult } from '../../../src/core/movement';
import {
  createOnBoardPosition,
  createRunState,
  createWaitingPosition,
  createWaitingRunState,
  type RunState,
} from '../../../src/core/run';

const safe = (explored = false) =>
  createCellState({
    terrain: 'playable',
    containsMine: false,
    explored,
    mineRevealed: false,
    flagged: false,
  });

const mine = (flagged = false) =>
  createCellState({
    terrain: 'playable',
    containsMine: true,
    explored: false,
    mineRevealed: false,
    flagged,
  });

const boardOf = (...cells: CellState[]): BoardState =>
  createBoard({ width: cells.length, height: 1 }, cells);

function pendingState(result: MoveCharacterResult): RunState {
  if (result.outcome !== 'requires-resolution') {
    throw new Error('Expected a pending mine encounter.');
  }
  return result.state;
}

describe('pending hidden mine encounter', () => {
  it('creates a first-step pending encounter when waiting enters a hidden mine', () => {
    const pending = pendingState(
      moveCharacter(createWaitingRunState(boardOf(mine())), createCoordinate(0, 0)),
    );

    expect(pending.phase).toEqual({
      kind: 'pending-mine-encounter',
      encounter: { target: { x: 0, y: 0 }, occurredOnFirstStep: true },
    });
    expect(pending.hasTakenStep).toBe(true);
  });

  it('creates a non-first-step encounter from an existing on-board position', () => {
    const board = boardOf(safe(true), mine());
    const run = createRunState(board, createOnBoardPosition(createCoordinate(0, 0)));
    const pending = pendingState(moveCharacter(run, createCoordinate(1, 0)));

    expect(pending.phase).toEqual({
      kind: 'pending-mine-encounter',
      encounter: { target: { x: 1, y: 0 }, occurredOnFirstStep: false },
    });
  });

  it('records that a later waiting encounter is not the first step', () => {
    const run = createRunState(boardOf(mine()), createWaitingPosition(), { hasTakenStep: true });
    const pending = pendingState(moveCharacter(run, createCoordinate(0, 0)));

    expect(pending.phase).toMatchObject({
      encounter: { occurredOnFirstStep: false },
    });
  });

  it('keeps the pre-encounter position and exact board facts unchanged', () => {
    const explored = safe(true);
    const hiddenMine = mine();
    const board = boardOf(explored, hiddenMine);
    const run = createRunState(board, createOnBoardPosition(createCoordinate(0, 0)));
    const pending = pendingState(moveCharacter(run, createCoordinate(1, 0)));

    expect(pending).not.toBe(run);
    expect(pending.board).toBe(board);
    expect(pending.characterPosition).toEqual(run.characterPosition);
    expect(getCellAt(pending.board, createCoordinate(0, 0))).toBe(explored);
    expect(getCellAt(pending.board, createCoordinate(1, 0))).toBe(hiddenMine);
    expect(hiddenMine).toEqual({ kind: 'mine', revelation: 'hidden', flagged: false });
    expect(run.phase).toEqual({ kind: 'active' });
    expect(run.hasTakenStep).toBe(true);
  });

  it('rejects ordinary movement while an encounter is pending', () => {
    const board = boardOf(mine(), safe());
    const pending = pendingState(
      moveCharacter(createWaitingRunState(board), createCoordinate(0, 0)),
    );
    const result = moveCharacter(pending, createCoordinate(1, 0));

    expect(result).toEqual({ outcome: 'rejected', reason: 'pending-mine-encounter' });
    expect('state' in result).toBe(false);
    expect(pending.characterPosition).toEqual({ kind: 'waiting' });
    expect(getCellAt(pending.board, createCoordinate(1, 0))).toEqual({
      kind: 'safe',
      exploration: 'unexplored',
      flagged: false,
    });
  });

  it('rejects constructing an encounter that does not target a hidden mine', () => {
    expect(() =>
      createRunState(boardOf(safe()), createWaitingPosition(), {
        hasTakenStep: true,
        phase: {
          kind: 'pending-mine-encounter',
          encounter: { target: createCoordinate(0, 0), occurredOnFirstStep: true },
        },
      }),
    ).toThrow('A mine encounter must reference an unflagged hidden mine.');
  });

  it('rejects constructing an encounter against a flagged hidden mine', () => {
    expect(() =>
      createRunState(boardOf(mine(true)), createWaitingPosition(), {
        hasTakenStep: true,
        phase: {
          kind: 'pending-mine-encounter',
          encounter: { target: createCoordinate(0, 0), occurredOnFirstStep: true },
        },
      }),
    ).toThrow('A mine encounter must reference an unflagged hidden mine.');
  });

  it('rejects marking an on-board encounter as the first step', () => {
    const board = boardOf(safe(true), mine());

    expect(() =>
      createRunState(board, createOnBoardPosition(createCoordinate(0, 0)), {
        hasTakenStep: true,
        phase: {
          kind: 'pending-mine-encounter',
          encounter: { target: createCoordinate(1, 0), occurredOnFirstStep: true },
        },
      }),
    ).toThrow('A first-step mine encounter must originate from waiting.');
  });
});

describe('basic failure settlement', () => {
  it('rejects failure settlement for an active run', () => {
    const run = createWaitingRunState(boardOf(mine()));
    const result = settleMineEncounterAsFailure(run);

    expect(result).toEqual({ outcome: 'rejected', reason: 'no-pending-mine-encounter' });
    expect('state' in result).toBe(false);
    expect(run.phase).toEqual({ kind: 'active' });
  });

  it('settles the current pending encounter as failed', () => {
    const pending = pendingState(
      moveCharacter(createWaitingRunState(boardOf(mine())), createCoordinate(0, 0)),
    );
    const result = settleMineEncounterAsFailure(pending);

    expect(result.outcome).toBe('failed');
    if (result.outcome !== 'failed') throw new Error('Expected a failed run.');
    expect(result.state.phase).toEqual({
      kind: 'failed',
      encounter: { target: { x: 0, y: 0 }, occurredOnFirstStep: true },
    });
  });

  it('preserves board, hidden mine, explored cells, and character position after failure', () => {
    const explored = safe(true);
    const hiddenMine = mine();
    const board = boardOf(explored, hiddenMine);
    const active = createRunState(board, createOnBoardPosition(createCoordinate(0, 0)));
    const pending = pendingState(moveCharacter(active, createCoordinate(1, 0)));
    const result = settleMineEncounterAsFailure(pending);

    if (result.outcome !== 'failed') throw new Error('Expected a failed run.');
    expect(result.state.board).toBe(board);
    expect(result.state.characterPosition).toEqual(active.characterPosition);
    expect(getCellAt(result.state.board, createCoordinate(0, 0))).toBe(explored);
    expect(getCellAt(result.state.board, createCoordinate(1, 0))).toBe(hiddenMine);
    expect(hiddenMine).toEqual({ kind: 'mine', revelation: 'hidden', flagged: false });
  });

  it('does not mutate the pending state when producing failure', () => {
    const pending = pendingState(
      moveCharacter(createWaitingRunState(boardOf(mine())), createCoordinate(0, 0)),
    );
    const originalPhase = pending.phase;
    const result = settleMineEncounterAsFailure(pending);

    expect(result.outcome).toBe('failed');
    expect(pending.phase).toBe(originalPhase);
    expect(pending.phase.kind).toBe('pending-mine-encounter');
  });

  it('blocks ordinary movement after failure without restart or reroll', () => {
    const board = boardOf(mine(), safe());
    const pending = pendingState(
      moveCharacter(createWaitingRunState(board), createCoordinate(0, 0)),
    );
    const settlement = settleMineEncounterAsFailure(pending);

    if (settlement.outcome !== 'failed') throw new Error('Expected a failed run.');
    const result = moveCharacter(settlement.state, createCoordinate(1, 0));
    expect(result).toEqual({ outcome: 'rejected', reason: 'run-failed' });
    expect(settlement.state.board).toBe(board);
  });
});
