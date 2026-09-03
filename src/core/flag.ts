import {
  createCellState,
  getCellAt,
  replaceCellAt,
  type BoardState,
  type Coordinate,
} from './board';

export type FlagTransitionResult =
  | {
      readonly outcome: 'changed';
      readonly change: 'placed' | 'removed';
      readonly board: BoardState;
    }
  | {
      readonly outcome: 'rejected';
      readonly reason: 'out-of-bounds' | 'not-flaggable';
    }
  | {
      readonly outcome: 'unchanged';
      readonly reason: 'already-flagged' | 'already-unflagged';
    };

export function setFlagged(
  board: BoardState,
  coordinate: Coordinate,
  desiredFlagged: boolean,
): FlagTransitionResult {
  const cell = getCellAt(board, coordinate);
  if (cell === undefined) return { outcome: 'rejected', reason: 'out-of-bounds' };

  if (
    cell.kind === 'obstacle' ||
    (cell.kind === 'safe' && cell.exploration === 'explored') ||
    (cell.kind === 'mine' && cell.revelation === 'revealed')
  ) {
    return { outcome: 'rejected', reason: 'not-flaggable' };
  }

  if (cell.flagged === desiredFlagged) {
    return {
      outcome: 'unchanged',
      reason: desiredFlagged ? 'already-flagged' : 'already-unflagged',
    };
  }

  const replacement =
    cell.kind === 'safe'
      ? createCellState({
          terrain: 'playable',
          containsMine: false,
          explored: false,
          mineRevealed: false,
          flagged: desiredFlagged,
        })
      : createCellState({
          terrain: 'playable',
          containsMine: true,
          explored: false,
          mineRevealed: false,
          flagged: desiredFlagged,
        });

  const nextBoard = replaceCellAt(board, coordinate, replacement);
  if (nextBoard === undefined) return { outcome: 'rejected', reason: 'out-of-bounds' };

  return {
    outcome: 'changed',
    change: desiredFlagged ? 'placed' : 'removed',
    board: nextBoard,
  };
}
