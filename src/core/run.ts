import { createCoordinate, getCellAt, type BoardState, type Coordinate } from './board';

export interface WaitingPosition {
  readonly kind: 'waiting';
}

export interface OnBoardPosition {
  readonly kind: 'on-board';
  readonly coordinate: Coordinate;
}

export type CharacterPosition = WaitingPosition | OnBoardPosition;

export interface RunState {
  readonly board: BoardState;
  readonly characterPosition: CharacterPosition;
}

export function createWaitingPosition(): WaitingPosition {
  return Object.freeze({ kind: 'waiting' });
}

export function createOnBoardPosition(coordinate: Coordinate): OnBoardPosition {
  return Object.freeze({
    kind: 'on-board',
    coordinate: createCoordinate(coordinate.x, coordinate.y),
  });
}

export function createRunState(board: BoardState, characterPosition: CharacterPosition): RunState {
  if (characterPosition.kind === 'waiting') {
    return Object.freeze({ board, characterPosition: createWaitingPosition() });
  }

  const position = createOnBoardPosition(characterPosition.coordinate);
  const cell = getCellAt(board, position.coordinate);
  if (cell === undefined) throw new Error('An on-board character position must be inside the board.');
  if (cell.kind !== 'safe' || cell.exploration !== 'explored') {
    throw new Error('An on-board character position must reference an explored safe cell.');
  }

  return Object.freeze({ board, characterPosition: position });
}

export function createWaitingRunState(board: BoardState): RunState {
  return createRunState(board, createWaitingPosition());
}
