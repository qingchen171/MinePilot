import {
  createCellState,
  getCellAt,
  replaceCellAt,
  type Coordinate,
} from './board';
import {
  createOnBoardPosition,
  createPendingMineEncounterRunState,
  createRunState,
  type MineEncounter,
  type RunState,
} from './run';

export type MoveCharacterResult =
  | { readonly outcome: 'moved'; readonly state: RunState }
  | {
      readonly outcome: 'requires-resolution';
      readonly encounter: MineEncounter;
      readonly state: RunState;
    }
  | {
      readonly outcome: 'rejected';
      readonly reason:
        | 'out-of-bounds'
        | 'flagged'
        | 'obstacle'
        | 'revealed-mine'
        | 'pending-mine-encounter'
        | 'run-failed';
    }
  | { readonly outcome: 'unchanged'; readonly reason: 'already-at-target' };

function coordinatesEqual(left: Coordinate, right: Coordinate): boolean {
  return left.x === right.x && left.y === right.y;
}

export function moveCharacter(run: RunState, target: Coordinate): MoveCharacterResult {
  if (run.phase.kind === 'pending-mine-encounter') {
    return { outcome: 'rejected', reason: 'pending-mine-encounter' };
  }
  if (run.phase.kind === 'failed') return { outcome: 'rejected', reason: 'run-failed' };

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
    if (targetCell.revelation === 'revealed') {
      return { outcome: 'rejected', reason: 'revealed-mine' };
    }

    const state = createPendingMineEncounterRunState(run, target);
    if (state.phase.kind !== 'pending-mine-encounter') {
      throw new Error('Pending mine encounter state was not created.');
    }
    return { outcome: 'requires-resolution', encounter: state.phase.encounter, state };
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
    state: createRunState(nextBoard, createOnBoardPosition(target), { hasTakenStep: true }),
  };
}
