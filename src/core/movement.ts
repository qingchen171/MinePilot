import {
  createCellState,
  getCellAt,
  replaceCellAt,
  type Coordinate,
} from './board';
import { createOnBoardPosition, createRunState, type RunState } from './run';

export type MoveCharacterResult =
  | { readonly outcome: 'moved'; readonly state: RunState }
  | { readonly outcome: 'requires-resolution'; readonly encounter: 'hidden-mine' }
  | {
      readonly outcome: 'rejected';
      readonly reason: 'out-of-bounds' | 'flagged' | 'obstacle' | 'revealed-mine';
    }
  | { readonly outcome: 'unchanged'; readonly reason: 'already-at-target' };

function coordinatesEqual(left: Coordinate, right: Coordinate): boolean {
  return left.x === right.x && left.y === right.y;
}

export function moveCharacter(run: RunState, target: Coordinate): MoveCharacterResult {
  const targetCell = getCellAt(run.board, target);
  if (targetCell === undefined) return { outcome: 'rejected', reason: 'out-of-bounds' };

  if (
    run.characterPosition.kind === 'on-board' &&
    coordinatesEqual(run.characterPosition.coordinate, target)
  ) {
    return { outcome: 'unchanged', reason: 'already-at-target' };
  }

  if (targetCell.kind !== 'obstacle' && targetCell.flagged) {
    return { outcome: 'rejected', reason: 'flagged' };
  }
  if (targetCell.kind === 'obstacle') return { outcome: 'rejected', reason: 'obstacle' };
  if (targetCell.kind === 'mine') {
    return targetCell.revelation === 'revealed'
      ? { outcome: 'rejected', reason: 'revealed-mine' }
      : { outcome: 'requires-resolution', encounter: 'hidden-mine' };
  }

  const nextBoard =
    targetCell.exploration === 'explored'
      ? run.board
      : replaceCellAt(
          run.board,
          target,
          createCellState({
            terrain: 'playable',
            containsMine: false,
            explored: true,
            mineRevealed: false,
            flagged: false,
          }),
        );

  if (nextBoard === undefined) return { outcome: 'rejected', reason: 'out-of-bounds' };

  return {
    outcome: 'moved',
    state: createRunState(nextBoard, createOnBoardPosition(target)),
  };
}
