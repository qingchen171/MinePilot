import { createAccountState } from '../../src/core/account';
import { createBoard, createCellState, createCoordinate, type CellFacts } from '../../src/core/board';
import { createGameState, type GameState } from '../../src/core/game-state';
import { createRunState, type CharacterPosition, type RunPhase } from '../../src/core/run';
import { createRunItemState } from '../../src/core/run-item-state';

// Row-major fixture: H hidden mine, F flagged mine, R revealed mine, O obstacle,
// E explored safe, W wrongly flagged safe, S unexplored safe.
export function detectionGame(
  rows: readonly string[] = ['HSH', 'SES', 'HSH'],
  options: { seed?: number | null; uses?: number; inventory?: number; position?: CharacterPosition; phase?: RunPhase } = {},
): GameState {
  const cells = rows.join('').split('').map((symbol) => {
    const facts: CellFacts = {
      terrain: symbol === 'O' ? 'obstacle' : 'playable',
      containsMine: 'HFR'.includes(symbol),
      explored: symbol === 'E',
      mineRevealed: symbol === 'R',
      flagged: symbol === 'F' || symbol === 'W',
    };
    return createCellState(facts);
  });
  return createGameState({
    account: createAccountState({ lucky: 3, detection: options.inventory ?? 3, airplane: 2, revive: 1 }),
    run: createRunState(createBoard({ width: rows[0].length, height: rows.length }, cells),
      options.position ?? { kind: 'on-board', coordinate: createCoordinate(1, 1) },
      { phase: options.phase ?? { kind: 'active' } }),
    runItems: createRunItemState({ successfulDetectionUses: options.uses ?? 0, successfulAirplaneUses: 0, successfulReviveUses: 0, detectionRandomSeed: options.seed === undefined ? 123456789 : options.seed }),
  });
}
