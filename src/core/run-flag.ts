import type { Coordinate } from './board';
import { setFlagged } from './flag';
import { createRunState, type RunState } from './run';

export type RunFlagTransitionResult =
  | {
      readonly outcome: 'changed';
      readonly change: 'placed' | 'removed';
      readonly state: RunState;
    }
  | {
      readonly outcome: 'rejected';
      readonly reason:
        | 'pending-mine-encounter'
        | 'run-failed'
        | 'run-won'
        | 'out-of-bounds'
        | 'not-flaggable';
    }
  | {
      readonly outcome: 'unchanged';
      readonly reason: 'already-flagged' | 'already-unflagged';
    };

export function setRunFlagged(
  run: RunState,
  coordinate: Coordinate,
  desiredFlagged: boolean,
): RunFlagTransitionResult {
  if (run.phase.kind === 'pending-mine-encounter') {
    return { outcome: 'rejected', reason: 'pending-mine-encounter' };
  }
  if (run.phase.kind === 'failed') return { outcome: 'rejected', reason: 'run-failed' };
  if (run.phase.kind === 'won') return { outcome: 'rejected', reason: 'run-won' };

  const boardResult = setFlagged(run.board, coordinate, desiredFlagged);
  if (boardResult.outcome !== 'changed') return boardResult;

  return {
    outcome: 'changed',
    change: boardResult.change,
    state: createRunState(boardResult.board, run.characterPosition, {
      hasTakenStep: run.hasTakenStep,
      phase: run.phase,
    }),
  };
}
