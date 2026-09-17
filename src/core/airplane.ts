import { replaceInventory } from './account';
import { createCellState, getCellAt, isCoordinateInBoard, replaceCellAt, type Coordinate } from './board';
import { createGameState, type GameState, type ItemTransactionResult } from './game-state';
import { getNeighborCoordinates } from './neighborhood';
import { consumeSuccessfulItemResource, inspectItemResource } from './item-resource';
import { revealMine } from './reveal-mine';
import { createRunState, settleRunAsWon } from './run';
import { createRunItemState } from './run-item-state';
import type { TemporaryBenbenCard } from './temporary-benben-card';

export type AirplaneRejectionReason =
  | 'pending-mine-encounter' | 'run-failed' | 'run-won'
  | 'insufficient-inventory' | 'usage-limit-reached' | 'out-of-bounds';
export type AirplaneResult = ItemTransactionResult<undefined, AirplaneRejectionReason>;

export type AirplaneCompatibilityResult =
  | {
      readonly status: 'candidate';
      readonly candidate: GameState;
      readonly details: undefined;
      readonly temporaryBenbenCard: TemporaryBenbenCard | null;
    }
  | { readonly status: 'rejected'; readonly reason: AirplaneRejectionReason };

export function createAirplaneCandidateWithTemporaryResource(
  game: GameState,
  target: Coordinate,
  temporaryBenbenCard: TemporaryBenbenCard | null,
): AirplaneCompatibilityResult {
  const { run, account, runItems } = game;
  if (run.phase.kind === 'pending-mine-encounter') return { status: 'rejected', reason: 'pending-mine-encounter' };
  if (run.phase.kind === 'failed') return { status: 'rejected', reason: 'run-failed' };
  if (run.phase.kind === 'won') return { status: 'rejected', reason: 'run-won' };
  if (runItems.successfulAirplaneUses >= 1) return { status: 'rejected', reason: 'usage-limit-reached' };
  if (!isCoordinateInBoard(run.board, target)) return { status: 'rejected', reason: 'out-of-bounds' };
  if (inspectItemResource('airplane', account.inventory, temporaryBenbenCard).status === 'unavailable') {
    return { status: 'rejected', reason: 'insufficient-inventory' };
  }

  let board = run.board;
  for (const coordinate of [target, ...getNeighborCoordinates(run.board, target)]) {
    const cell = getCellAt(board, coordinate);
    if (cell?.kind === 'mine' && cell.revelation === 'hidden') {
      const revealed = revealMine(board, coordinate);
      if (revealed.outcome !== 'changed') throw new Error('Validated Airplane mine must be revealable.');
      board = revealed.board;
    } else if (cell?.kind === 'safe' && cell.exploration === 'unexplored') {
      const explored = replaceCellAt(board, coordinate, createCellState({
        terrain: 'playable', containsMine: false, explored: true, mineRevealed: false, flagged: false,
      }));
      if (explored === undefined) throw new Error('Validated Airplane coordinate must remain in bounds.');
      board = explored;
    }
  }
  const consumed = consumeSuccessfulItemResource('airplane', account.inventory, temporaryBenbenCard);
  if (consumed.status !== 'consumed') return { status: 'rejected', reason: 'insufficient-inventory' };
  const changedRun = createRunState(board, run.characterPosition, { hasTakenStep: run.hasTakenStep, phase: run.phase });
  const victory = settleRunAsWon(changedRun);
  return {
    status: 'candidate',
    candidate: createGameState({
      account: replaceInventory(account, consumed.inventory),
      run: victory.outcome === 'won' ? victory.state : changedRun,
      runItems: createRunItemState({ ...runItems, successfulAirplaneUses: runItems.successfulAirplaneUses + 1 }),
    }),
    details: undefined,
    temporaryBenbenCard: consumed.temporaryBenbenCard,
  };
}

/** Internal candidate only: the complete area and consumption must be persisted together. */
export function createAirplaneCandidate(game: GameState, target: Coordinate): AirplaneResult {
  const result = createAirplaneCandidateWithTemporaryResource(game, target, null);
  return result.status === 'candidate'
    ? { status: 'candidate', candidate: result.candidate, details: undefined }
    : result;
}
