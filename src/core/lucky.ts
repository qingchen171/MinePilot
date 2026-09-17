import { replaceInventory } from './account';
import type { Coordinate } from './board';
import { resolvePendingMineEncounterAsSurvived } from './encounter';
import { createGameState, type GameState } from './game-state';
import { consumeSuccessfulItemResource, inspectItemResource } from './item-resource';
import { moveCharacter } from './movement';
import type { TemporaryBenbenCard } from './temporary-benben-card';

export type LuckyNotApplicableReason = 'no-pending-mine-encounter' | 'not-first-step' | 'no-lucky';
export type LuckyCandidateResult =
  | { readonly status: 'candidate'; readonly candidate: GameState }
  | { readonly status: 'not-applicable'; readonly reason: LuckyNotApplicableReason }
  | { readonly status: 'rejected'; readonly reason: 'invalid-game-state' | 'invalid-encounter-target' };

export type LuckyCompatibilityResult =
  | {
      readonly status: 'candidate';
      readonly candidate: GameState;
      readonly temporaryBenbenCard: TemporaryBenbenCard | null;
    }
  | Exclude<LuckyCandidateResult, { status: 'candidate' }>;

export type AutomaticLuckyCompatibilityResult =
  | {
      readonly status: 'candidate';
      readonly resolution: 'lucky' | 'pending' | 'moved';
      readonly candidate: GameState;
      readonly temporaryBenbenCard: TemporaryBenbenCard | null;
    }
  | Extract<LuckyCandidateResult, { status: 'rejected' }>
  | { readonly status: 'movement-rejected'; readonly reason: string }
  | { readonly status: 'unchanged'; readonly reason: 'already-at-target' };

export function hasApplicableLuckyForEncounter(
  game: GameState,
  temporaryBenbenCard: TemporaryBenbenCard | null,
): boolean {
  return game.run.phase.kind === 'pending-mine-encounter' &&
    game.run.phase.encounter.occurredOnFirstStep &&
    inspectItemResource('lucky', game.account.inventory, temporaryBenbenCard).status === 'available';
}

/** Internal compatibility candidate. Lucky applicability precedes resource inspection. */
export function createLuckyCandidateWithTemporaryResource(
  input: GameState,
  temporaryBenbenCard: TemporaryBenbenCard | null,
): LuckyCompatibilityResult {
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
  const resource = inspectItemResource('lucky', account.inventory, temporaryBenbenCard);
  if (resource.status === 'unavailable') return { status: 'not-applicable', reason: 'no-lucky' };
  const survival = resolvePendingMineEncounterAsSurvived(run);
  if (survival.outcome !== 'resolved') return { status: 'rejected', reason: 'invalid-encounter-target' };
  const consumed = consumeSuccessfulItemResource('lucky', account.inventory, temporaryBenbenCard);
  if (consumed.status !== 'consumed') return { status: 'not-applicable', reason: 'no-lucky' };
  return {
    status: 'candidate',
    candidate: createGameState({
      account: replaceInventory(account, consumed.inventory),
      run: survival.state,
      runItems: game.runItems,
    }),
    temporaryBenbenCard: consumed.temporaryBenbenCard,
  };
}

/** Pure movement composition. Applicable Lucky resolves before a pending candidate is returned. */
export function createMovementCandidateWithAutomaticLuckyResource(
  input: GameState,
  target: Coordinate,
  temporaryBenbenCard: TemporaryBenbenCard | null,
): AutomaticLuckyCompatibilityResult {
  let game: GameState;
  try { game = createGameState(input); }
  catch { return { status: 'rejected', reason: 'invalid-game-state' }; }
  const movement = moveCharacter(game.run, target);
  if (movement.outcome === 'rejected') {
    return { status: 'movement-rejected', reason: movement.reason };
  }
  if (movement.outcome === 'unchanged') return { status: 'unchanged', reason: movement.reason };
  const movedGame = createGameState({ ...game, run: movement.state });
  if (movement.outcome === 'moved') {
    return {
      status: 'candidate', resolution: 'moved', candidate: movedGame,
      temporaryBenbenCard,
    };
  }
  const lucky = createLuckyCandidateWithTemporaryResource(movedGame, temporaryBenbenCard);
  if (lucky.status === 'rejected') return lucky;
  return lucky.status === 'candidate'
    ? {
        status: 'candidate', resolution: 'lucky', candidate: lucky.candidate,
        temporaryBenbenCard: lucky.temporaryBenbenCard,
      }
    : {
        status: 'candidate', resolution: 'pending', candidate: movedGame,
        temporaryBenbenCard,
      };
}

/** Internal candidate, never publishable before guarded persistence succeeds. */
export function createLuckyCandidate(input: GameState): LuckyCandidateResult {
  const result = createLuckyCandidateWithTemporaryResource(input, null);
  return result.status === 'candidate'
    ? { status: 'candidate', candidate: result.candidate }
    : result;
}
