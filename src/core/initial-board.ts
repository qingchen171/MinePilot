import {
  createBoard,
  createBoardDimensions,
  createCellState,
  isCoordinateInDimensions,
  type BoardDimensions,
  type BoardState,
  type CellState,
  type Coordinate,
} from './board';

export interface InitialBoardInput {
  readonly dimensions: BoardDimensions;
  readonly obstacleCoordinates: readonly Coordinate[];
  readonly mineCoordinates: readonly Coordinate[];
}

export type InitialBoardInvalidReason =
  | 'invalid-dimensions'
  | 'invalid-obstacle-coordinate'
  | 'duplicate-obstacle-coordinate'
  | 'invalid-mine-coordinate'
  | 'duplicate-mine-coordinate'
  | 'mine-obstacle-overlap';

export type CreateInitialBoardResult =
  | { readonly status: 'created'; readonly board: BoardState }
  | {
      readonly status: 'invalid';
      readonly reason: InitialBoardInvalidReason;
      readonly coordinateIndex?: number;
    };

function coordinateKey(coordinate: Coordinate): string {
  return `${coordinate.x},${coordinate.y}`;
}

export function createInitialBoard(input: InitialBoardInput): CreateInitialBoardResult {
  let dimensions: BoardDimensions;
  try {
    dimensions = createBoardDimensions(input.dimensions);
  } catch {
    return { status: 'invalid', reason: 'invalid-dimensions' };
  }

  const obstacleKeys = new Set<string>();
  for (const [coordinateIndex, coordinate] of input.obstacleCoordinates.entries()) {
    if (!isCoordinateInDimensions(dimensions, coordinate)) {
      return { status: 'invalid', reason: 'invalid-obstacle-coordinate', coordinateIndex };
    }
    const key = coordinateKey(coordinate);
    if (obstacleKeys.has(key)) {
      return { status: 'invalid', reason: 'duplicate-obstacle-coordinate', coordinateIndex };
    }
    obstacleKeys.add(key);
  }

  const mineKeys = new Set<string>();
  for (const [coordinateIndex, coordinate] of input.mineCoordinates.entries()) {
    if (!isCoordinateInDimensions(dimensions, coordinate)) {
      return { status: 'invalid', reason: 'invalid-mine-coordinate', coordinateIndex };
    }
    const key = coordinateKey(coordinate);
    if (mineKeys.has(key)) {
      return { status: 'invalid', reason: 'duplicate-mine-coordinate', coordinateIndex };
    }
    if (obstacleKeys.has(key)) {
      return { status: 'invalid', reason: 'mine-obstacle-overlap', coordinateIndex };
    }
    mineKeys.add(key);
  }

  const cells: CellState[] = [];
  for (let y = 0; y < dimensions.height; y += 1) {
    for (let x = 0; x < dimensions.width; x += 1) {
      const key = `${x},${y}`;
      cells.push(
        createCellState({
          terrain: obstacleKeys.has(key) ? 'obstacle' : 'playable',
          containsMine: mineKeys.has(key),
          explored: false,
          mineRevealed: false,
          flagged: false,
        }),
      );
    }
  }

  return { status: 'created', board: createBoard(dimensions, cells) };
}
