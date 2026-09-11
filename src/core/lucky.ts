import { replaceInventory } from './account';
import { resolvePendingMineEncounterAsSurvived } from './encounter';
import { createGameState, type GameState } from './game-state';

export type LuckyNotApplicableReason = 'no-pending-mine-encounter' | 'not-first-step' | 'no-lucky';
export type LuckyCandidateResult =
  | { readonly status: 'candidate'; readonly candidate: GameState }
  | { readonly status: 'not-applicable'; readonly reason: LuckyNotApplicableReason }
  | { readonly status: 'rejected'; readonly reason: 'invalid-game-state' | 'invalid-encounter-target' };

/** Internal candidate, never publishable before guarded persistence succeeds. */
export function createLuckyCandidate(input: GameState): LuckyCandidateResult {
  let game: GameState;
  try { game = createGameState(input); }
  catch { return { status: 'rejected', reason: 'invalid-game-state' }; }
  const { run, account } = game;
  if (run.phase.kind !== 'pending-mine-encounter') {
    return { status: 'not-applicable', reason: 'no-pending-mine-encounter' };
  }
  if (!run.phase.encounter.occurredOnFirstStep) {
    return { status: 'not-applicable', reason: 'not-first-step' };
  }
  if (account.inventory.lucky === 0) return { status: 'not-applicable', reason: 'no-lucky' };
  const survival = resolvePendingMineEncounterAsSurvived(run);
  if (survival.outcome !== 'resolved') return { status: 'rejected', reason: 'invalid-encounter-target' };
  return {
    status: 'candidate',
    candidate: createGameState({
      account: replaceInventory(account, { ...account.inventory, lucky: account.inventory.lucky - 1 }),
      run: survival.state,
      runItems: game.runItems,
    }),
  };
}
