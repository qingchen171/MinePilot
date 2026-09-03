import { describe, expect, it } from 'vitest';
import {
  createBoard,
  createCellState,
  createCoordinate,
  type BoardState,
  type CellState,
} from '../../../src/core/board';
import { settleMineEncounterAsFailure } from '../../../src/core/encounter';
import { moveCharacter, type MoveCharacterResult } from '../../../src/core/movement';
import {
  createOnBoardPosition,
  createRunState,
  createWaitingRunState,
  settleRunAsWon,
  type RunState,
} from '../../../src/core/run';
import { areAllRequiredSafeCellsExplored } from '../../../src/core/victory';

const obstacle = () =>
  createCellState({
    terrain: 'obstacle',
    containsMine: false,
    explored: false,
    mineRevealed: false,
    flagged: false,
  });

const safe = (explored = false, flagged = false) =>
  createCellState({
    terrain: 'playable',
    containsMine: false,
    explored,
    mineRevealed: false,
    flagged,
  });

const mine = (revealed = false, flagged = false) =>
  createCellState({
    terrain: 'playable',
    containsMine: true,
    explored: false,
    mineRevealed: revealed,
    flagged,
  });

const boardOf = (...cells: CellState[]): BoardState =>
  createBoard({ width: cells.length, height: 1 }, cells);

function movedState(result: MoveCharacterResult): RunState {
  if (result.outcome !== 'moved') throw new Error('Expected a successful movement.');
  return result.state;
}

function pendingState(result: MoveCharacterResult): RunState {
  if (result.outcome !== 'requires-resolution') {
    throw new Error('Expected a pending mine encounter.');
  }
  return result.state;
}

describe('required safe cell victory predicate', () => {
  it('returns true when every safe cell is explored', () => {
    expect(areAllRequiredSafeCellsExplored(boardOf(safe(true), safe(true)))).toBe(true);
  });

  it('returns false when any required safe cell is unexplored', () => {
    expect(areAllRequiredSafeCellsExplored(boardOf(safe(true), safe()))).toBe(false);
  });

  it('does not count obstacles, hidden mines, or revealed mines as required safe cells', () => {
    expect(
      areAllRequiredSafeCellsExplored(boardOf(safe(true), obstacle(), mine(), mine(true))),
    ).toBe(true);
  });

  it('handles a board containing only obstacles without inventing another rule', () => {
    expect(areAllRequiredSafeCellsExplored(boardOf(obstacle()))).toBe(true);
  });

  it('does not let a correct mine flag substitute for exploring a safe cell', () => {
    expect(areAllRequiredSafeCellsExplored(boardOf(safe(), mine(false, true)))).toBe(false);
  });

  it('keeps a wrongly flagged unexplored safe cell required', () => {
    expect(areAllRequiredSafeCellsExplored(boardOf(safe(false, true), mine()))).toBe(false);
  });

  it('ignores a mine flag when all actual safe cells are explored', () => {
    expect(areAllRequiredSafeCellsExplored(boardOf(safe(true), mine(false, true)))).toBe(true);
  });

  it('depends only on Board facts rather than character position', () => {
    const board = boardOf(safe(true), mine());
    const waiting = createWaitingRunState(board);
    const onBoard = createRunState(board, createOnBoardPosition(createCoordinate(0, 0)));

    expect(areAllRequiredSafeCellsExplored(waiting.board)).toBe(true);
    expect(areAllRequiredSafeCellsExplored(onBoard.board)).toBe(true);
  });
});

describe('atomic Run victory boundary', () => {
  it('enters won when movement explores the final required safe cell', () => {
    const run = createWaitingRunState(boardOf(safe(), obstacle(), mine()));
    const next = movedState(moveCharacter(run, createCoordinate(0, 0)));

    expect(next.phase).toEqual({ kind: 'won' });
    expect(next.characterPosition).toEqual({ kind: 'on-board', coordinate: { x: 0, y: 0 } });
    expect(run.phase).toEqual({ kind: 'active' });
  });

  it('remains active when movement does not explore the final safe cell', () => {
    const next = movedState(
      moveCharacter(createWaitingRunState(boardOf(safe(), safe())), createCoordinate(0, 0)),
    );

    expect(next.phase).toEqual({ kind: 'active' });
  });

  it('does not trigger victory while moving between explored cells when another safe is unexplored', () => {
    const board = boardOf(safe(true), safe(true), safe());
    const run = createRunState(board, createOnBoardPosition(createCoordinate(0, 0)));
    const next = movedState(moveCharacter(run, createCoordinate(1, 0)));

    expect(next.phase).toEqual({ kind: 'active' });
    expect(next.board).toBe(board);
  });

  it('does not trigger victory from a hidden mine encounter', () => {
    const run = createWaitingRunState(boardOf(safe(true), mine()));
    const pending = pendingState(moveCharacter(run, createCoordinate(1, 0)));

    expect(pending.phase.kind).toBe('pending-mine-encounter');
  });

  it('rejects settling a pending encounter as won', () => {
    const pending = pendingState(
      moveCharacter(createWaitingRunState(boardOf(safe(true), mine())), createCoordinate(1, 0)),
    );

    expect(settleRunAsWon(pending)).toEqual({ outcome: 'rejected', reason: 'run-not-active' });
  });

  it('rejects settling a failed run as won', () => {
    const pending = pendingState(
      moveCharacter(createWaitingRunState(boardOf(safe(true), mine())), createCoordinate(1, 0)),
    );
    const failure = settleMineEncounterAsFailure(pending);
    if (failure.outcome !== 'failed') throw new Error('Expected a failed run.');

    expect(settleRunAsWon(failure.state)).toEqual({
      outcome: 'rejected',
      reason: 'run-not-active',
    });
  });

  it('rejects ordinary movement after victory', () => {
    const won = movedState(
      moveCharacter(createWaitingRunState(boardOf(safe(), safe(true))), createCoordinate(0, 0)),
    );
    const result = moveCharacter(won, createCoordinate(1, 0));

    expect(won.phase).toEqual({ kind: 'won' });
    expect(result).toEqual({ outcome: 'rejected', reason: 'run-won' });
    expect('state' in result).toBe(false);
  });

  it('rejects a won Run construction while required safe cells remain unexplored', () => {
    expect(() =>
      createRunState(boardOf(safe()), { kind: 'waiting' }, { phase: { kind: 'won' } }),
    ).toThrow('A won run requires every required safe cell to be explored.');
  });

  it('does not mutate the original Run or Board when victory is produced', () => {
    const target = safe();
    const board = boardOf(target);
    const run = createWaitingRunState(board);
    const next = movedState(moveCharacter(run, createCoordinate(0, 0)));

    expect(next).not.toBe(run);
    expect(next.board).not.toBe(board);
    expect(run.phase).toEqual({ kind: 'active' });
    expect(run.characterPosition).toEqual({ kind: 'waiting' });
    expect(target).toEqual({ kind: 'safe', exploration: 'unexplored', flagged: false });
  });
});
