import { describe, expect, it } from 'vitest';
import {
  createBoard,
  createCellState,
  createCoordinate,
  getCellAt,
  isCoordinateInBoard,
  isMineCell,
  isSafeCell,
  type CellFacts,
} from '../../../src/core/board';

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

const mine = (mineRevealed = false, flagged = false) =>
  createCellState({
    terrain: 'playable',
    containsMine: true,
    explored: false,
    mineRevealed,
    flagged,
  });

describe('cell state facts', () => {
  it('keeps obstacles outside both safe and mine identities', () => {
    const cell = obstacle();

    expect(cell).toEqual({ kind: 'obstacle' });
    expect(isSafeCell(cell)).toBe(false);
    expect(isMineCell(cell)).toBe(false);
  });

  it('expresses unexplored and explored safe cells without display state', () => {
    expect(safe()).toEqual({ kind: 'safe', exploration: 'unexplored', flagged: false });
    expect(safe(true)).toEqual({ kind: 'safe', exploration: 'explored', flagged: false });
  });

  it('keeps a revealed mine as a mine', () => {
    const cell = mine(true);

    expect(cell).toEqual({ kind: 'mine', revelation: 'revealed', flagged: false });
    expect(isMineCell(cell)).toBe(true);
    expect(isSafeCell(cell)).toBe(false);
  });

  it('allows a normal flag on either hidden identity without changing that identity', () => {
    expect(safe(false, true)).toEqual({ kind: 'safe', exploration: 'unexplored', flagged: true });
    expect(mine(false, true)).toEqual({ kind: 'mine', revelation: 'hidden', flagged: true });
  });

  it.each<[string, CellFacts, string]>([
    [
      'obstacle containing a mine',
      { terrain: 'obstacle', containsMine: true, explored: false, mineRevealed: false, flagged: false },
      'An obstacle cannot contain a mine.',
    ],
    [
      'explored obstacle',
      { terrain: 'obstacle', containsMine: false, explored: true, mineRevealed: false, flagged: false },
      'An obstacle cannot be explored.',
    ],
    [
      'revealed obstacle',
      { terrain: 'obstacle', containsMine: false, explored: false, mineRevealed: true, flagged: false },
      'An obstacle cannot be a revealed mine.',
    ],
    [
      'flagged obstacle',
      { terrain: 'obstacle', containsMine: false, explored: false, mineRevealed: false, flagged: true },
      'An obstacle cannot carry a normal flag.',
    ],
    [
      'safe revealed as a mine',
      { terrain: 'playable', containsMine: false, explored: false, mineRevealed: true, flagged: false },
      'A safe cell cannot be a revealed mine.',
    ],
    [
      'explored safe cell retaining a flag',
      { terrain: 'playable', containsMine: false, explored: true, mineRevealed: false, flagged: true },
      'An explored safe cell cannot carry a normal flag.',
    ],
    [
      'mine treated as explored safe',
      { terrain: 'playable', containsMine: true, explored: true, mineRevealed: false, flagged: false },
      'A mine cannot be an explored safe cell.',
    ],
    [
      'revealed mine retaining a flag',
      { terrain: 'playable', containsMine: true, explored: false, mineRevealed: true, flagged: true },
      'A revealed mine cannot carry a normal flag.',
    ],
  ])('rejects %s', (_description, facts, message) => {
    expect(() => createCellState(facts)).toThrow(message);
  });
});

describe('coordinates and board boundaries', () => {
  it('accepts non-negative integer coordinates independently of a board', () => {
    expect(createCoordinate(0, 2)).toEqual({ x: 0, y: 2 });
  });

  it.each([
    [-1, 0],
    [0, -1],
    [0.5, 0],
    [0, Number.NaN],
    [Number.POSITIVE_INFINITY, 0],
  ])('rejects an invalid coordinate (%s, %s)', (x, y) => {
    expect(() => createCoordinate(x, y)).toThrow(RangeError);
  });

  it.each([
    [{ width: 0, height: 1 }, [safe()]],
    [{ width: 1, height: -1 }, [safe()]],
    [{ width: 1.5, height: 1 }, [safe()]],
  ])('rejects invalid board dimensions %o', (dimensions, cells) => {
    expect(() => createBoard(dimensions, cells)).toThrow(RangeError);
  });

  it('requires exactly width multiplied by height cells', () => {
    expect(() => createBoard({ width: 2, height: 2 }, [safe(), safe(), safe()])).toThrow(
      'Board requires 4 cells, but received 3.',
    );
  });

  it('uses explicit row-major access and returns undefined outside the board', () => {
    const cells = [safe(), obstacle(), mine(), safe(true)];
    const board = createBoard({ width: 2, height: 2 }, cells);

    expect(getCellAt(board, createCoordinate(0, 0))).toBe(cells[0]);
    expect(getCellAt(board, createCoordinate(1, 0))).toBe(cells[1]);
    expect(getCellAt(board, createCoordinate(0, 1))).toBe(cells[2]);
    expect(getCellAt(board, createCoordinate(1, 1))).toBe(cells[3]);
    expect(isCoordinateInBoard(board, createCoordinate(2, 0))).toBe(false);
    expect(isCoordinateInBoard(board, createCoordinate(0, 2))).toBe(false);
    expect(getCellAt(board, createCoordinate(2, 0))).toBeUndefined();
  });

  it('does not let later caller array changes replace authoritative board cells', () => {
    const cells = [safe()];
    const board = createBoard({ width: 1, height: 1 }, cells);
    cells[0] = mine();

    expect(getCellAt(board, createCoordinate(0, 0))).toEqual({
      kind: 'safe',
      exploration: 'unexplored',
      flagged: false,
    });
  });
});
