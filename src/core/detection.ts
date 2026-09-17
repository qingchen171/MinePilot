import { replaceInventory } from './account';
import { getCellAt, type Coordinate } from './board';
import { createGameState, type GameState, type ItemTransactionResult } from './game-state';
import { getNeighborCoordinates } from './neighborhood';
import { consumeSuccessfulItemResource, inspectItemResource } from './item-resource';
import { createSeededRandomSource } from './random';
import { revealMine } from './reveal-mine';
import { createRunState } from './run';
import { createRunItemState } from './run-item-state';
import type { TemporaryBenbenCard } from './temporary-benben-card';

export type DetectionRejectionReason =
  | 'pending-mine-encounter' | 'run-failed' | 'run-won' | 'waiting'
  | 'insufficient-inventory' | 'usage-limit-reached' | 'no-hidden-mine'
  | 'invalid-detection-seed' | 'seed-unavailable';

export type DetectionResult = ItemTransactionResult<
  { readonly target: Coordinate }, DetectionRejectionReason
>;

export type DetectionCompatibilityResult =
  | {
      readonly status: 'candidate';
      readonly candidate: GameState;
      readonly details: { readonly target: Coordinate };
      readonly temporaryBenbenCard: TemporaryBenbenCard | null;
    }
  | { readonly status: 'rejected'; readonly reason: DetectionRejectionReason };

export function createDetectionCandidateWithTemporaryResource(
  game: GameState,
  initializeSeed: () => number,
  temporaryBenbenCard: TemporaryBenbenCard | null,
): DetectionCompatibilityResult {
  const { run, account, runItems } = game;
  if (run.phase.kind === 'pending-mine-encounter') return { status: 'rejected', reason: 'pending-mine-encounter' };
  if (run.phase.kind === 'failed') return { status: 'rejected', reason: 'run-failed' };
  if (run.phase.kind === 'won') return { status: 'rejected', reason: 'run-won' };
  if (run.characterPosition.kind === 'waiting') return { status: 'rejected', reason: 'waiting' };
  if (runItems.successfulDetectionUses >= 2) return { status: 'rejected', reason: 'usage-limit-reached' };
  if (inspectItemResource('detection', account.inventory, temporaryBenbenCard).status === 'unavailable') {
    return { status: 'rejected', reason: 'insufficient-inventory' };
  }

  const unflagged: Coordinate[] = [];
  const flagged: Coordinate[] = [];
  for (const coordinate of getNeighborCoordinates(run.board, run.characterPosition.coordinate)) {
    const cell = getCellAt(run.board, coordinate);
    if (cell?.kind === 'mine' && cell.revelation === 'hidden') {
      (cell.flagged ? flagged : unflagged).push(coordinate);
    }
  }
  const candidates = unflagged.length > 0 ? unflagged : flagged;
  if (candidates.length === 0) return { status: 'rejected', reason: 'no-hidden-mine' };

  let selectionSeed = runItems.detectionRandomSeed;
  if (selectionSeed === null) {
    try { selectionSeed = initializeSeed(); }
    catch { return { status: 'rejected', reason: 'seed-unavailable' }; }
  }
  if (!Number.isInteger(selectionSeed) || selectionSeed < 0 || selectionSeed > 0xffff_ffff) {
    return { status: 'rejected', reason: 'invalid-detection-seed' };
  }
  const target = candidates[createSeededRandomSource(selectionSeed).nextInt(candidates.length)];
  const revealed = revealMine(run.board, target);
  if (revealed.outcome !== 'changed') return { status: 'rejected', reason: 'no-hidden-mine' };
  const consumed = consumeSuccessfulItemResource('detection', account.inventory, temporaryBenbenCard);
  if (consumed.status !== 'consumed') return { status: 'rejected', reason: 'insufficient-inventory' };

  return {
    status: 'candidate',
    candidate: createGameState({
      account: replaceInventory(account, consumed.inventory),
      run: createRunState(revealed.board, run.characterPosition, { hasTakenStep: run.hasTakenStep, phase: run.phase }),
      runItems: createRunItemState({
        ...runItems,
        successfulDetectionUses: runItems.successfulDetectionUses + 1,
        detectionRandomSeed: (selectionSeed + 1) % 0x1_0000_0000,
      }),
    }),
    details: { target },
    temporaryBenbenCard: consumed.temporaryBenbenCard,
  };
}

/** Internal candidate only: reveal details must not be published before guarded commit. */
export function createDetectionCandidate(
  game: GameState,
  initializeSeed: () => number,
): DetectionResult {
  const result = createDetectionCandidateWithTemporaryResource(game, initializeSeed, null);
  return result.status === 'candidate'
    ? { status: 'candidate', candidate: result.candidate, details: result.details }
    : result;
}
