import { getCellAt } from './board';
import { revealMine } from './reveal-mine';
import { createRevealedMineOccupancyPosition, createRunState, type RunState } from './run';

export type ResolvePendingMineEncounterAsSurvivedResult =
  | { readonly outcome: 'resolved'; readonly state: RunState }
  | {
      readonly outcome: 'rejected';
      readonly reason: 'no-pending-mine-encounter' | 'invalid-encounter-target';
    };

/** Composition primitive, not an Item command or a publishable persistence result. */
export function resolvePendingMineEncounterAsSurvived(
  run: RunState,
): ResolvePendingMineEncounterAsSurvivedResult {
  if (run.phase.kind !== 'pending-mine-encounter') {
    return { outcome: 'rejected', reason: 'no-pending-mine-encounter' };
  }
  const target = run.phase.encounter.target;
  const cell = getCellAt(run.board, target);
  if (cell?.kind !== 'mine' || cell.revelation !== 'hidden' || cell.flagged) {
    return { outcome: 'rejected', reason: 'invalid-encounter-target' };
  }
  const revealed = revealMine(run.board, target);
  if (revealed.outcome !== 'changed') {
    return { outcome: 'rejected', reason: 'invalid-encounter-target' };
  }
  return {
    outcome: 'resolved',
    state: createRunState(revealed.board, createRevealedMineOccupancyPosition(target), {
      hasTakenStep: run.hasTakenStep,
      phase: { kind: 'active' },
    }),
  };
}

export type SettleMineEncounterAsFailureResult =
  | { readonly outcome: 'failed'; readonly state: RunState }
  | { readonly outcome: 'rejected'; readonly reason: 'no-pending-mine-encounter' };

export function settleMineEncounterAsFailure(
  run: RunState,
): SettleMineEncounterAsFailureResult {
  if (run.phase.kind !== 'pending-mine-encounter') {
    return { outcome: 'rejected', reason: 'no-pending-mine-encounter' };
  }

  return {
    outcome: 'failed',
    state: createRunState(run.board, run.characterPosition, {
      hasTakenStep: run.hasTakenStep,
      phase: { kind: 'failed', encounter: run.phase.encounter },
    }),
  };
}
