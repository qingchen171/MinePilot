import { createAccountState } from './account';
import { getCellAt, type Coordinate } from './board';
import { createGameState, type GameState, type ItemTransactionResult } from './game-state';
import { getNeighborCoordinates } from './neighborhood';
import { createSeededRandomSource } from './random';
import { revealMine } from './reveal-mine';
import { createRunState } from './run';
import { createRunItemState } from './run-item-state';

export type DetectionRejectionReason =
  | 'pending-mine-encounter' | 'run-failed' | 'run-won' | 'waiting'
  | 'insufficient-inventory' | 'usage-limit-reached' | 'no-hidden-mine'
  | 'invalid-detection-seed' | 'seed-unavailable';

export type DetectionResult = ItemTransactionResult<
  { readonly target: Coordinate }, DetectionRejectionReason
>;

/** Internal candidate only: reveal details must not be published before guarded commit. */
export function createDetectionCandidate(
  game: GameState,
  initializeSeed: () => number,
): DetectionResult {
  const { run, account, runItems } = game;
  if (run.phase.kind === 'pending-mine-encounter') return { status: 'rejected', reason: 'pending-mine-encounter' };
  if (run.phase.kind === 'failed') return { status: 'rejected', reason: 'run-failed' };
  if (run.phase.kind === 'won') return { status: 'rejected', reason: 'run-won' };
  if (run.characterPosition.kind === 'waiting') return { status: 'rejected', reason: 'waiting' };
  if (account.inventory.detection === 0) return { status: 'rejected', reason: 'insufficient-inventory' };
  if (runItems.successfulDetectionUses >= 2) return { status: 'rejected', reason: 'usage-limit-reached' };

  const unflagged: Coordinate[] = [];
  const flagged: Coordinate[] = [];
  // Preserve the frozen neighborhood order within both priority groups.
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

  return {
    status: 'candidate',
    candidate: createGameState({
      account: createAccountState({ ...account.inventory, detection: account.inventory.detection - 1 }),
      run: createRunState(revealed.board, run.characterPosition, { hasTakenStep: run.hasTakenStep, phase: run.phase }),
      runItems: createRunItemState({
        ...runItems,
        successfulDetectionUses: runItems.successfulDetectionUses + 1,
        // Detection next-use seed, not the internal Mulberry32 continuation state.
        detectionRandomSeed: (selectionSeed + 1) % 0x1_0000_0000,
      }),
    }),
    details: { target },
  };
}
