import { createAccountState } from './account';
import { resolvePendingMineEncounterAsSurvived } from './encounter';
import { createGameState, type GameState, type ItemTransactionResult } from './game-state';
import { createRunItemState } from './run-item-state';

export type ReviveRejectionReason =
  | 'no-pending-mine-encounter'
  | 'lucky-priority'
  | 'insufficient-inventory'
  | 'usage-limit-reached'
  | 'invalid-encounter-target';

export type ReviveResult = ItemTransactionResult<undefined, ReviveRejectionReason>;

/** Internal transaction candidate only; publish requires a successful guarded commit. */
export function createReviveCandidate(game: GameState): ReviveResult {
  const { run, account, runItems } = game;
  if (run.phase.kind !== 'pending-mine-encounter') {
    return { status: 'rejected', reason: 'no-pending-mine-encounter' };
  }
  if (run.phase.encounter.occurredOnFirstStep && account.inventory.lucky > 0) {
    return { status: 'rejected', reason: 'lucky-priority' };
  }
  if (account.inventory.revive === 0) {
    return { status: 'rejected', reason: 'insufficient-inventory' };
  }
  if (runItems.successfulReviveUses >= 1) {
    return { status: 'rejected', reason: 'usage-limit-reached' };
  }
  const survival = resolvePendingMineEncounterAsSurvived(run);
  if (survival.outcome === 'rejected') return { status: 'rejected', reason: survival.reason };
  return {
    status: 'candidate',
    candidate: createGameState({
      account: createAccountState({ ...account.inventory, revive: account.inventory.revive - 1 }),
      run: survival.state,
      runItems: createRunItemState({ ...runItems, successfulReviveUses: runItems.successfulReviveUses + 1 }),
    }),
    details: undefined,
  };
}
