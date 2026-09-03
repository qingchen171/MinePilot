import { describe, expect, it } from 'vitest';
import {
  createBoard,
  createCellState,
  createCoordinate,
  isCoordinateInBoard,
  type BoardState,
  type CellState,
} from '../../../src/core/board';
import { countAdjacentMines, getNeighborCoordinates } from '../../../src/core/neighborhood';

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

function board(width: number, height: number, cells?: readonly CellState[]): BoardState {
  return createBoard({ width, height }, cells ?? Array.from({ length: width * height }, () => safe()));
}

describe('eight-neighbor coordinates', () => {
  it('returns all eight neighbors around a center cell without returning the center', () => {
    const targetBoard = board(3, 3);
    const center = createCoordinate(1, 1);

    expect(getNeighborCoordinates(targetBoard, center)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 1 },
      { x: 2, y: 1 },
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
    ]);
    expect(getNeighborCoordinates(targetBoard, center)).not.toContainEqual(center);
  });

  it.each([
    [0, 0],
    [2, 0],
    [0, 2],
    [2, 2],
  ])('returns three neighbors for corner (%s, %s)', (x, y) => {
    expect(getNeighborCoordinates(board(3, 3), createCoordinate(x, y))).toHaveLength(3);
  });

  it.each([
    [1, 0],
    [0, 1],
    [2, 1],
    [1, 2],
  ])('returns five neighbors for non-corner edge (%s, %s)', (x, y) => {
    expect(getNeighborCoordinates(board(3, 3), createCoordinate(x, y))).toHaveLength(5);
  });

  it('returns no neighbors on a 1 by 1 board', () => {
    expect(getNeighborCoordinates(board(1, 1), createCoordinate(0, 0))).toEqual([]);
  });

  it('returns only coordinates that are already inside the board', () => {
    const targetBoard = board(4, 3);

    for (let y = 0; y < targetBoard.dimensions.height; y += 1) {
      for (let x = 0; x < targetBoard.dimensions.width; x += 1) {
        const neighbors = getNeighborCoordinates(targetBoard, createCoordinate(x, y));
        expect(neighbors.every((coordinate) => isCoordinateInBoard(targetBoard, coordinate))).toBe(true);
      }
    }
  });

  it('uses position only, so an obstacle center has the same neighborhood as a safe center', () => {
    const safeCells = Array.from({ length: 9 }, () => safe());
    const obstacleCells = [...safeCells];
    obstacleCells[4] = obstacle();

    expect(getNeighborCoordinates(board(3, 3, obstacleCells), createCoordinate(1, 1))).toEqual(
      getNeighborCoordinates(board(3, 3, safeCells), createCoordinate(1, 1)),
    );
  });

  it('returns an empty neighborhood for a center outside the board', () => {
    expect(getNeighborCoordinates(board(2, 2), createCoordinate(2, 1))).toEqual([]);
  });
});

describe('adjacent real mine count', () => {
  it('returns zero when no neighbor is a mine', () => {
    expect(countAdjacentMines(board(3, 3), createCoordinate(1, 1))).toBe(0);
  });

  it('counts a mixture of hidden, revealed, and flagged mines by real identity', () => {
    const cells = [
      mine(false, true),
      mine(true),
      obstacle(),
      safe(false, true),
      safe(),
      safe(true),
      safe(),
      mine(),
      safe(),
    ];

    expect(countAdjacentMines(board(3, 3, cells), createCoordinate(1, 1))).toBe(3);
  });

  it('counts all eight surrounding mines', () => {
    const cells = Array.from({ length: 9 }, () => mine());
    cells[4] = safe();

    expect(countAdjacentMines(board(3, 3, cells), createCoordinate(1, 1))).toBe(8);
  });

  it('counts a revealed mine', () => {
    expect(countAdjacentMines(board(2, 1, [safe(), mine(true)]), createCoordinate(0, 0))).toBe(1);
  });

  it('counts a flagged mine', () => {
    expect(countAdjacentMines(board(2, 1, [safe(), mine(false, true)]), createCoordinate(0, 0))).toBe(1);
  });

  it('does not count a wrongly flagged safe cell', () => {
    expect(countAdjacentMines(board(2, 1, [safe(), safe(false, true)]), createCoordinate(0, 0))).toBe(0);
  });

  it('does not count an obstacle or let it block another adjacent mine', () => {
    expect(countAdjacentMines(board(3, 1, [obstacle(), safe(), mine()]), createCoordinate(1, 0))).toBe(1);
  });

  it('ignores explored versus unexplored safe status', () => {
    expect(countAdjacentMines(board(3, 1, [safe(true), safe(), safe(false)]), createCoordinate(1, 0))).toBe(0);
  });

  it('returns zero for a center outside the board', () => {
    expect(countAdjacentMines(board(2, 2), createCoordinate(2, 1))).toBe(0);
  });
});
