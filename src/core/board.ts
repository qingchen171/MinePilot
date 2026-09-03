export interface Coordinate {
  readonly x: number;
  readonly y: number;
}

export interface BoardDimensions {
  readonly width: number;
  readonly height: number;
}

export interface CellFacts {
  readonly terrain: 'playable' | 'obstacle';
  readonly containsMine: boolean;
  readonly explored: boolean;
  readonly mineRevealed: boolean;
  readonly flagged: boolean;
}

export interface ObstacleCell {
  readonly kind: 'obstacle';
}

export type SafeCell =
  | {
      readonly kind: 'safe';
      readonly exploration: 'unexplored';
      readonly flagged: boolean;
    }
  | {
      readonly kind: 'safe';
      readonly exploration: 'explored';
      readonly flagged: false;
    };

export type MineCell =
  | {
      readonly kind: 'mine';
      readonly revelation: 'hidden';
      readonly flagged: boolean;
    }
  | {
      readonly kind: 'mine';
      readonly revelation: 'revealed';
      readonly flagged: false;
    };

export type CellState = ObstacleCell | SafeCell | MineCell;

export interface BoardState {
  readonly dimensions: BoardDimensions;
  readonly cells: readonly CellState[];
}

function requireNonNegativeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer.`);
  }
}

function requirePositiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer.`);
  }
}

export function createCoordinate(x: number, y: number): Coordinate {
  requireNonNegativeInteger(x, 'Coordinate x');
  requireNonNegativeInteger(y, 'Coordinate y');
  return Object.freeze({ x, y });
}

export function createBoardDimensions(dimensions: BoardDimensions): BoardDimensions {
  requirePositiveInteger(dimensions.width, 'Board width');
  requirePositiveInteger(dimensions.height, 'Board height');

  const cellCount = dimensions.width * dimensions.height;
  if (!Number.isSafeInteger(cellCount)) throw new RangeError('Board cell count must be a safe integer.');
  return Object.freeze({ width: dimensions.width, height: dimensions.height });
}

export function createCellState(facts: CellFacts): CellState {
  if (facts.terrain === 'obstacle') {
    if (facts.containsMine) throw new Error('An obstacle cannot contain a mine.');
    if (facts.explored) throw new Error('An obstacle cannot be explored.');
    if (facts.mineRevealed) throw new Error('An obstacle cannot be a revealed mine.');
    if (facts.flagged) throw new Error('An obstacle cannot carry a normal flag.');
    return Object.freeze({ kind: 'obstacle' });
  }

  if (!facts.containsMine) {
    if (facts.mineRevealed) throw new Error('A safe cell cannot be a revealed mine.');
    if (facts.explored && facts.flagged) throw new Error('An explored safe cell cannot carry a normal flag.');
    return facts.explored
      ? Object.freeze({ kind: 'safe', exploration: 'explored', flagged: false })
      : Object.freeze({ kind: 'safe', exploration: 'unexplored', flagged: facts.flagged });
  }

  if (facts.explored) throw new Error('A mine cannot be an explored safe cell.');
  if (facts.mineRevealed && facts.flagged) throw new Error('A revealed mine cannot carry a normal flag.');
  return facts.mineRevealed
    ? Object.freeze({ kind: 'mine', revelation: 'revealed', flagged: false })
    : Object.freeze({ kind: 'mine', revelation: 'hidden', flagged: facts.flagged });
}

export function isSafeCell(cell: CellState): cell is SafeCell {
  return cell.kind === 'safe';
}

export function isMineCell(cell: CellState): cell is MineCell {
  return cell.kind === 'mine';
}

export function createBoard(dimensions: BoardDimensions, cells: readonly CellState[]): BoardState {
  const validatedDimensions = createBoardDimensions(dimensions);
  const cellCount = validatedDimensions.width * validatedDimensions.height;
  if (cells.length !== cellCount) {
    throw new RangeError(`Board requires ${cellCount} cells, but received ${cells.length}.`);
  }

  return Object.freeze({
    dimensions: validatedDimensions,
    cells: Object.freeze([...cells]),
  });
}

export function isCoordinateInDimensions(
  dimensions: BoardDimensions,
  coordinate: Coordinate,
): boolean {
  return (
    typeof coordinate === 'object' &&
    coordinate !== null &&
    Number.isSafeInteger(coordinate.x) &&
    Number.isSafeInteger(coordinate.y) &&
    coordinate.x >= 0 &&
    coordinate.y >= 0 &&
    coordinate.x < dimensions.width &&
    coordinate.y < dimensions.height
  );
}

export function isCoordinateInBoard(board: BoardState, coordinate: Coordinate): boolean {
  return isCoordinateInDimensions(board.dimensions, coordinate);
}

export function getCellAt(board: BoardState, coordinate: Coordinate): CellState | undefined {
  if (!isCoordinateInBoard(board, coordinate)) return undefined;
  return board.cells[coordinate.y * board.dimensions.width + coordinate.x];
}

export function replaceCellAt(
  board: BoardState,
  coordinate: Coordinate,
  replacement: CellState,
): BoardState | undefined {
  if (!isCoordinateInBoard(board, coordinate)) return undefined;

  const cells = [...board.cells];
  cells[coordinate.y * board.dimensions.width + coordinate.x] = replacement;
  return createBoard(board.dimensions, cells);
}
