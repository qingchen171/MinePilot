import { describe, expect, it } from 'vitest';
import {
  createBoard,
  createCellState,
  createCoordinate,
  type BoardState,
  type CellState,
} from '../../../src/core/board';
import { getCurrentCellMineCount } from '../../../src/core/current-cell-mine-count';
import { settleMineEncounterAsFailure } from '../../../src/core/encounter';
import { moveCharacter, type MoveCharacterResult } from '../../../src/core/movement';
import {
  createOnBoardPosition,
  createRunState,
  createWaitingRunState,
  type RunState,
} from '../../../src/core/run';

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

function board(width: number, height: number, cells: readonly CellState[]): BoardState {
  return createBoard({ width, height }, cells);
}

function onBoardRun(targetBoard: BoardState, x: number, y: number): RunState {
  return createRunState(targetBoard, createOnBoardPosition(createCoordinate(x, y)));
}

function movedState(result: MoveCharacterResult): RunState {
  if (result.outcome !== 'moved') throw new Error('Expected successful movement.');
  return result.state;
}

function pendingState(result: MoveCharacterResult): RunState {
  if (result.outcome !== 'requires-resolution') throw new Error('Expected a pending encounter.');
  return result.state;
}

describe('current cell mine count query', () => {
  it('returns unavailable while the character is waiting', () => {
    expect(getCurrentCellMineCount(createWaitingRunState(board(1, 1, [safe()])))).toEqual({
      status: 'unavailable',
    });
  });

  it('counts all eight neighbors around an on-board center safe cell', () => {
    const cells = [mine(), mine(), mine(), mine(), safe(true), mine(), mine(), mine(), mine()];

    expect(getCurrentCellMineCount(onBoardRun(board(3, 3, cells), 1, 1))).toEqual({
      status: 'available',
      mineCount: 8,
    });
  });

  it('counts only the three existing neighbors at a corner', () => {
    const cells = [safe(true), mine(), safe(), mine(), mine(), safe(), safe(), safe(), safe()];

    expect(getCurrentCellMineCount(onBoardRun(board(3, 3, cells), 0, 0))).toEqual({
      status: 'available',
      mineCount: 3,
    });
  });

  it('counts only the five existing neighbors at a non-corner edge', () => {
    const cells = [mine(), safe(true), mine(), mine(), mine(), mine(), safe(), safe(), safe()];

    expect(getCurrentCellMineCount(onBoardRun(board(3, 3, cells), 1, 0))).toEqual({
      status: 'available',
      mineCount: 5,
    });
  });

  it('distinguishes an available zero from an unavailable result', () => {
    const result = getCurrentCellMineCount(onBoardRun(board(1, 1, [safe(true)]), 0, 0));

    expect(result).toEqual({ status: 'available', mineCount: 0 });
    expect(result.status).not.toBe('unavailable');
  });

  it('counts hidden, revealed, and flagged mines by real identity', () => {
    const cells = [
      mine(),
      mine(true),
      mine(false, true),
      safe(),
      safe(true),
      safe(),
      safe(),
      safe(),
      safe(),
    ];

    expect(getCurrentCellMineCount(onBoardRun(board(3, 3, cells), 1, 1))).toEqual({
      status: 'available',
      mineCount: 3,
    });
  });

  it('does not count a wrongly flagged safe cell or an obstacle', () => {
    const cells = [safe(false, true), safe(true), obstacle()];

    expect(getCurrentCellMineCount(onBoardRun(board(3, 1, cells), 1, 0))).toEqual({
      status: 'available',
      mineCount: 0,
    });
  });

  it('never counts the current center cell itself', () => {
    expect(getCurrentCellMineCount(onBoardRun(board(1, 1, [safe(true)]), 0, 0))).toEqual({
      status: 'available',
      mineCount: 0,
    });
  });

  it('queries the new position after moving between explored safe cells', () => {
    const targetBoard = board(4, 1, [safe(true), mine(), safe(true), mine()]);
    const run = onBoardRun(targetBoard, 0, 0);
    const moved = movedState(moveCharacter(run, createCoordinate(2, 0)));

    expect(getCurrentCellMineCount(run)).toEqual({ status: 'available', mineCount: 1 });
    expect(getCurrentCellMineCount(moved)).toEqual({ status: 'available', mineCount: 2 });
  });

  it('keeps querying the original safe position during a pending mine encounter', () => {
    const targetBoard = board(3, 1, [safe(true), mine(), safe()]);
    const pending = pendingState(
      moveCharacter(onBoardRun(targetBoard, 0, 0), createCoordinate(1, 0)),
    );

    expect(getCurrentCellMineCount(pending)).toEqual({ status: 'available', mineCount: 1 });
  });

  it('keeps querying the original safe position after failure', () => {
    const targetBoard = board(2, 1, [safe(true), mine()]);
    const pending = pendingState(
      moveCharacter(onBoardRun(targetBoard, 0, 0), createCoordinate(1, 0)),
    );
    const failure = settleMineEncounterAsFailure(pending);
    if (failure.outcome !== 'failed') throw new Error('Expected a failed run.');

    expect(getCurrentCellMineCount(failure.state)).toEqual({
      status: 'available',
      mineCount: 1,
    });
  });

  it('queries an explored safe position after the run is won', () => {
    const won = movedState(
      moveCharacter(createWaitingRunState(board(2, 1, [safe(), mine()])), createCoordinate(0, 0)),
    );

    expect(won.phase).toEqual({ kind: 'won' });
    expect(getCurrentCellMineCount(won)).toEqual({ status: 'available', mineCount: 1 });
  });

  it('does not mutate the Run, Board, position, or cells', () => {
    const cells = [safe(true), mine()];
    const targetBoard = board(2, 1, cells);
    const run = onBoardRun(targetBoard, 0, 0);
    const position = run.characterPosition;

    getCurrentCellMineCount(run);

    expect(run.board).toBe(targetBoard);
    expect(run.characterPosition).toBe(position);
    expect(run.board.cells[0]).toBe(cells[0]);
    expect(run.board.cells[1]).toBe(cells[1]);
  });
});
