import { createAccountState } from '../../src/core/account';
import { createGameState } from '../../src/core/game-state';
import { createRunState, type CharacterPosition, type RunPhase } from '../../src/core/run';
import { createRunItemState } from '../../src/core/run-item-state';
import { detectionGame } from './detection';

export function airplaneGame(rows: readonly string[] = ['SSSS', 'SSSS', 'SSSS', 'SSSS'], options: {
  position?: CharacterPosition; phase?: RunPhase; inventory?: number; uses?: number;
} = {}) {
  const base = detectionGame(rows, { position: { kind: 'waiting' } });
  const position = options.position ?? { kind: 'waiting' };
  return createGameState({
    account: createAccountState({ ...base.account.inventory, airplane: options.inventory ?? 2 }),
    run: createRunState(base.run.board, position, {
      hasTakenStep: position.kind !== 'waiting' || options.phase?.kind === 'pending-mine-encounter' || options.phase?.kind === 'failed',
      phase: options.phase ?? { kind: 'active' },
    }),
    runItems: createRunItemState({ ...base.runItems, successfulAirplaneUses: options.uses ?? 0 }),
  });
}
