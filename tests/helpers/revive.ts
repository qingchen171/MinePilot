import { createAccountState } from '../../src/core/account';
import { createBoard, createCellState } from '../../src/core/board';
import { createGameState } from '../../src/core/game-state';
import { createRunState, type RunPhase } from '../../src/core/run';
import { createRunItemState } from '../../src/core/run-item-state';

export function reviveGame(options: { first?: boolean; lucky?: number; inventory?: number; uses?: number; phase?: RunPhase; allSafeExplored?: boolean } = {}) {
  const first = options.first ?? false;
  const board = createBoard({ width: 4, height: 1 }, [
    createCellState({ terrain: 'playable', containsMine: false, explored: true, mineRevealed: false, flagged: false }),
    createCellState({ terrain: 'playable', containsMine: true, explored: false, mineRevealed: false, flagged: false }),
    createCellState({ terrain: 'playable', containsMine: false, explored: options.allSafeExplored ?? false, mineRevealed: false, flagged: false }),
    createCellState({ terrain: 'playable', containsMine: true, explored: false, mineRevealed: false, flagged: false }),
  ]);
  return createGameState({
    account: createAccountState({ lucky: options.lucky ?? 0, revive: options.inventory ?? 2, detection: 3, airplane: 2 }),
    run: createRunState(board, first ? { kind: 'waiting' } : { kind: 'on-board', coordinate: { x: 0, y: 0 } }, {
      hasTakenStep: true,
      phase: options.phase ?? { kind: 'pending-mine-encounter', encounter: { target: { x: 1, y: 0 }, occurredOnFirstStep: first } },
    }),
    runItems: createRunItemState({ successfulDetectionUses: 1, successfulAirplaneUses: 0, successfulReviveUses: options.uses ?? 0, detectionRandomSeed: 123 }),
  });
}
