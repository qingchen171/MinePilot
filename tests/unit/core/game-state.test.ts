import { describe, expect, it } from 'vitest';
import { createAccountState } from '../../../src/core/account';
import { createBoard, createCellState } from '../../../src/core/board';
import {
  createGameState,
  type ItemTransactionResult,
} from '../../../src/core/game-state';
import { createInitialRunItemState } from '../../../src/core/run-item-state';
import { createWaitingRunState } from '../../../src/core/run';

function createValidGameState() {
  const board = createBoard({ width: 1, height: 1 }, [
    createCellState({
      terrain: 'playable',
      containsMine: false,
      explored: false,
      mineRevealed: false,
      flagged: false,
    }),
  ]);
  return createGameState({
    account: createAccountState({ lucky: 1, detection: 2, airplane: 3, revive: 4 }),
    run: createWaitingRunState(board),
    runItems: createInitialRunItemState(99),
  });
}

describe('GameState item transaction candidate boundary', () => {
  it('combines Account, Run, and attempt-local item authority without aliasing containers', () => {
    const original = createValidGameState();
    const rebuilt = createGameState(original);

    expect(rebuilt).toEqual(original);
    expect(rebuilt).not.toBe(original);
    expect(rebuilt.account).not.toBe(original.account);
    expect(rebuilt.run).not.toBe(original.run);
    expect(rebuilt.runItems).not.toBe(original.runItems);
    expect(Object.isFrozen(rebuilt)).toBe(true);
  });

  it('revalidates nested runtime facts instead of trusting TypeScript-only input', () => {
    const input = createValidGameState();
    const invalidItems = { ...input.runItems, successfulReviveUses: 2 };

    expect(() => createGameState({ ...input, runItems: invalidItems })).toThrow(
      'Successful Revive uses must be a safe integer between 0 and 1.',
    );
  });

  it('defines rejected item transactions without a publishable candidate', () => {
    const result: ItemTransactionResult<never, 'not-active'> = {
      status: 'rejected',
      reason: 'not-active',
    };

    expect(result).toEqual({ status: 'rejected', reason: 'not-active' });
    expect('candidate' in result).toBe(false);
  });
});
