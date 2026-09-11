import { replaceInventory } from './account';
import { createCellState, getCellAt, isCoordinateInBoard, replaceCellAt, type Coordinate } from './board';
import { createGameState, type GameState, type ItemTransactionResult } from './game-state';
import { getNeighborCoordinates } from './neighborhood';
import { revealMine } from './reveal-mine';
import { createRunState, settleRunAsWon } from './run';
import { createRunItemState } from './run-item-state';

export type AirplaneRejectionReason =
  | 'pending-mine-encounter' | 'run-failed' | 'run-won'
  | 'insufficient-inventory' | 'usage-limit-reached' | 'out-of-bounds';
export type AirplaneResult = ItemTransactionResult<undefined, AirplaneRejectionReason>;

/** Internal candidate only: the complete area and consumption must be persisted together. */
export function createAirplaneCandidate(game: GameState, target: Coordinate): AirplaneResult {
  const { run, account, runItems } = game;
  if (run.phase.kind === 'pending-mine-encounter') return { status: 'rejected', reason: 'pending-mine-encounter' };
  if (run.phase.kind === 'failed') return { status: 'rejected', reason: 'run-failed' };
  if (run.phase.kind === 'won') return { status: 'rejected', reason: 'run-won' };
  if (account.inventory.airplane === 0) return { status: 'rejected', reason: 'insufficient-inventory' };
  if (runItems.successfulAirplaneUses >= 1) return { status: 'rejected', reason: 'usage-limit-reached' };
  if (!isCoordinateInBoard(run.board, target)) return { status: 'rejected', reason: 'out-of-bounds' };

  let board = run.board;
  // The shared neighborhood excludes center; Airplane explicitly includes it once.
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
  const changedRun = createRunState(board, run.characterPosition, { hasTakenStep: run.hasTakenStep, phase: run.phase });
  const victory = settleRunAsWon(changedRun);
  return {
    status: 'candidate',
    candidate: createGameState({
      account: replaceInventory(account, { ...account.inventory, airplane: account.inventory.airplane - 1 }),
      run: victory.outcome === 'won' ? victory.state : changedRun,
      runItems: createRunItemState({ ...runItems, successfulAirplaneUses: runItems.successfulAirplaneUses + 1 }),
    }),
    details: undefined,
  };
}
