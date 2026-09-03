import {
  createCoordinate,
  getCellAt,
  isCoordinateInBoard,
  isMineCell,
  type BoardState,
  type Coordinate,
} from './board';

const NEIGHBOR_OFFSETS = Object.freeze([
  Object.freeze({ x: -1, y: -1 }),
  Object.freeze({ x: 0, y: -1 }),
  Object.freeze({ x: 1, y: -1 }),
  Object.freeze({ x: -1, y: 0 }),
  Object.freeze({ x: 1, y: 0 }),
  Object.freeze({ x: -1, y: 1 }),
  Object.freeze({ x: 0, y: 1 }),
  Object.freeze({ x: 1, y: 1 }),
]);

export function getNeighborCoordinates(board: BoardState, center: Coordinate): readonly Coordinate[] {
  if (!isCoordinateInBoard(board, center)) return Object.freeze([]);

  const neighbors: Coordinate[] = [];
  for (const offset of NEIGHBOR_OFFSETS) {
    const candidate = { x: center.x + offset.x, y: center.y + offset.y };
    if (isCoordinateInBoard(board, candidate)) {
      neighbors.push(createCoordinate(candidate.x, candidate.y));
    }
  }

  return Object.freeze(neighbors);
}

export function countAdjacentMines(board: BoardState, center: Coordinate): number {
  let mineCount = 0;
  for (const coordinate of getNeighborCoordinates(board, center)) {
    const cell = getCellAt(board, coordinate);
    if (cell && isMineCell(cell)) mineCount += 1;
  }
  return mineCount;
}
