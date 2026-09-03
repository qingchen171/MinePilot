import { createRunState, type RunState } from './run';

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
