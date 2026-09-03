import { describe, expect, it } from 'vitest';
import {
  createBoard,
  createCellState,
  createCoordinate,
  getCellAt,
  type BoardState,
  type CellState,
} from '../../../src/core/board';
import { setFlagged, type FlagTransitionResult } from '../../../src/core/flag';

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

function changedBoard(result: FlagTransitionResult): BoardState {
  if (result.outcome !== 'changed') throw new Error('Expected a changed flag transition.');
  return result.board;
}

describe('normal flag transitions', () => {
  it('places a flag on an unexplored safe cell', () => {
    const result = setFlagged(boardOf(safe()), createCoordinate(0, 0), true);

    expect(result.outcome).toBe('changed');
    expect(result).toMatchObject({ outcome: 'changed', change: 'placed' });
    expect(getCellAt(changedBoard(result), createCoordinate(0, 0))).toEqual({
      kind: 'safe',
      exploration: 'unexplored',
      flagged: true,
    });
  });

  it('places a flag on a hidden mine', () => {
    const result = setFlagged(boardOf(mine()), createCoordinate(0, 0), true);

    expect(result).toMatchObject({ outcome: 'changed', change: 'placed' });
    expect(getCellAt(changedBoard(result), createCoordinate(0, 0))).toEqual({
      kind: 'mine',
      revelation: 'hidden',
      flagged: true,
    });
  });

  it('removes a wrong flag from a safe cell', () => {
    const result = setFlagged(boardOf(safe(false, true)), createCoordinate(0, 0), false);

    expect(result).toMatchObject({ outcome: 'changed', change: 'removed' });
    expect(getCellAt(changedBoard(result), createCoordinate(0, 0))).toEqual({
      kind: 'safe',
      exploration: 'unexplored',
      flagged: false,
    });
  });

  it('removes a correct flag from a hidden mine', () => {
    const result = setFlagged(boardOf(mine(false, true)), createCoordinate(0, 0), false);

    expect(result).toMatchObject({ outcome: 'changed', change: 'removed' });
    expect(getCellAt(changedBoard(result), createCoordinate(0, 0))).toEqual({
      kind: 'mine',
      revelation: 'hidden',
      flagged: false,
    });
  });

  it.each([
    ['obstacle', obstacle()],
    ['explored safe cell', safe(true)],
    ['revealed mine', mine(true)],
  ])('rejects placing a flag on a %s', (_description, cell) => {
    const board = boardOf(cell);

    expect(setFlagged(board, createCoordinate(0, 0), true)).toEqual({
      outcome: 'rejected',
      reason: 'not-flaggable',
    });
    expect(getCellAt(board, createCoordinate(0, 0))).toBe(cell);
  });

  it.each([true, false])('rejects an out-of-bounds request for desired flag state %s', (desired) => {
    const board = boardOf(safe());

    expect(setFlagged(board, createCoordinate(1, 0), desired)).toEqual({
      outcome: 'rejected',
      reason: 'out-of-bounds',
    });
    expect(getCellAt(board, createCoordinate(0, 0))).toEqual(safe());
  });

  it.each([
    ['safe cell', safe(false, true)],
    ['mine', mine(false, true)],
  ])('reports an unchanged result when a %s is already flagged', (_description, cell) => {
    expect(setFlagged(boardOf(cell), createCoordinate(0, 0), true)).toEqual({
      outcome: 'unchanged',
      reason: 'already-flagged',
    });
  });

  it.each([
    ['safe cell', safe()],
    ['mine', mine()],
  ])('reports an unchanged result when a %s is already unflagged', (_description, cell) => {
    expect(setFlagged(boardOf(cell), createCoordinate(0, 0), false)).toEqual({
      outcome: 'unchanged',
      reason: 'already-unflagged',
    });
  });

  it('does not mutate the original board or original target cell after success', () => {
    const originalCell = safe();
    const board = boardOf(originalCell);
    const nextBoard = changedBoard(setFlagged(board, createCoordinate(0, 0), true));

    expect(nextBoard).not.toBe(board);
    expect(getCellAt(board, createCoordinate(0, 0))).toBe(originalCell);
    expect(originalCell).toEqual({ kind: 'safe', exploration: 'unexplored', flagged: false });
    expect(getCellAt(nextBoard, createCoordinate(0, 0))).not.toBe(originalCell);
  });

  it('changes only the target cell and preserves every other cell reference', () => {
    const cells = [safe(), mine(), obstacle()];
    const board = boardOf(...cells);
    const nextBoard = changedBoard(setFlagged(board, createCoordinate(1, 0), true));

    expect(getCellAt(nextBoard, createCoordinate(0, 0))).toBe(cells[0]);
    expect(getCellAt(nextBoard, createCoordinate(1, 0))).not.toBe(cells[1]);
    expect(getCellAt(nextBoard, createCoordinate(2, 0))).toBe(cells[2]);
  });

  it('preserves safe and mine identity facts across placing and removal', () => {
    const board = boardOf(safe(), mine());
    const safePlaced = changedBoard(setFlagged(board, createCoordinate(0, 0), true));
    const minePlaced = changedBoard(setFlagged(safePlaced, createCoordinate(1, 0), true));
    const safeRemoved = changedBoard(setFlagged(minePlaced, createCoordinate(0, 0), false));
    const finalBoard = changedBoard(setFlagged(safeRemoved, createCoordinate(1, 0), false));

    expect(getCellAt(finalBoard, createCoordinate(0, 0))).toEqual({
      kind: 'safe',
      exploration: 'unexplored',
      flagged: false,
    });
    expect(getCellAt(finalBoard, createCoordinate(1, 0))).toEqual({
      kind: 'mine',
      revelation: 'hidden',
      flagged: false,
    });
  });

  it('returns no replacement board for rejected and unchanged commands', () => {
    const board = boardOf(obstacle(), safe());
    const rejected = setFlagged(board, createCoordinate(0, 0), true);
    const unchanged = setFlagged(board, createCoordinate(1, 0), false);

    expect('board' in rejected).toBe(false);
    expect('board' in unchanged).toBe(false);
    expect(getCellAt(board, createCoordinate(0, 0))).toEqual({ kind: 'obstacle' });
    expect(getCellAt(board, createCoordinate(1, 0))).toEqual({
      kind: 'safe',
      exploration: 'unexplored',
      flagged: false,
    });
  });
});
