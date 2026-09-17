import { replaceInventory } from './account';
import { resolvePendingMineEncounterAsSurvived } from './encounter';
import { createGameState, type GameState, type ItemTransactionResult } from './game-state';
import { consumeSuccessfulItemResource, inspectItemResource } from './item-resource';
import { hasApplicableLuckyForEncounter } from './lucky';
import { createRunItemState } from './run-item-state';
import type { TemporaryBenbenCard } from './temporary-benben-card';

export type ReviveRejectionReason =
  | 'no-pending-mine-encounter'
  | 'lucky-priority'
  | 'insufficient-inventory'
  | 'usage-limit-reached'
  | 'invalid-encounter-target';

export type ReviveResult = ItemTransactionResult<undefined, ReviveRejectionReason>;

export type ReviveCompatibilityResult =
  | {
      readonly status: 'candidate';
      readonly candidate: GameState;
      readonly temporaryBenbenCard: TemporaryBenbenCard | null;
      readonly details: undefined;
    }
  | { readonly status: 'rejected'; readonly reason: ReviveRejectionReason };

export function createReviveCandidateWithTemporaryResource(
  game: GameState,
  temporaryBenbenCard: TemporaryBenbenCard | null,
): ReviveCompatibilityResult {
  const { run, account, runItems } = game;
  if (run.phase.kind !== 'pending-mine-encounter') {
    return { status: 'rejected', reason: 'no-pending-mine-encounter' };
  }
  if (hasApplicableLuckyForEncounter(game, temporaryBenbenCard)) {
    return { status: 'rejected', reason: 'lucky-priority' };
  }
  if (runItems.successfulReviveUses >= 1) {
    return { status: 'rejected', reason: 'usage-limit-reached' };
  }
  if (inspectItemResource('revive', account.inventory, temporaryBenbenCard).status === 'unavailable') {
    return { status: 'rejected', reason: 'insufficient-inventory' };
  }
  const survival = resolvePendingMineEncounterAsSurvived(run);
  if (survival.outcome === 'rejected') return { status: 'rejected', reason: survival.reason };
  const consumed = consumeSuccessfulItemResource('revive', account.inventory, temporaryBenbenCard);
  if (consumed.status !== 'consumed') return { status: 'rejected', reason: 'insufficient-inventory' };
  return {
    status: 'candidate',
    candidate: createGameState({
      account: replaceInventory(account, consumed.inventory),
      run: survival.state,
      runItems: createRunItemState({ ...runItems, successfulReviveUses: runItems.successfulReviveUses + 1 }),
    }),
    temporaryBenbenCard: consumed.temporaryBenbenCard,
    details: undefined,
  };
}

/** Internal transaction candidate only; publish requires a successful guarded commit. */
export function createReviveCandidate(game: GameState): ReviveResult {
  const result = createReviveCandidateWithTemporaryResource(game, null);
  return result.status === 'candidate'
    ? { status: 'candidate', candidate: result.candidate, details: undefined }
    : result;
}
