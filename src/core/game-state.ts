import { createAccountState, type AccountState } from './account';
import { createRunItemState, type RunItemState } from './run-item-state';
import { createRunState, type RunState } from './run';

export interface GameState {
  readonly account: AccountState;
  readonly run: RunState;
  readonly runItems: RunItemState;
}

export interface GameStateInput {
  readonly account: AccountState;
  readonly run: RunState;
  readonly runItems: RunItemState;
}

export type ItemTransactionResult<TDetails, TReason extends string> =
  | {
      readonly status: 'candidate';
      readonly candidate: GameState;
      readonly details: TDetails;
    }
  | {
      readonly status: 'rejected';
      readonly reason: TReason;
    };

export function createGameState(input: GameStateInput): GameState {
  const account = createAccountState(input.account.inventory);
  const run = createRunState(input.run.board, input.run.characterPosition, {
    hasTakenStep: input.run.hasTakenStep,
    phase: input.run.phase,
  });
  const runItems = createRunItemState(input.runItems);

  return Object.freeze({ account, run, runItems });
}
