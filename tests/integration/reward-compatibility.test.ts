import { describe, expect, it } from 'vitest';
import { createAccountState, createItemInventoryState } from '../../src/core/account';
import { createAirplaneCandidate } from '../../src/core/airplane';
import { createCoordinate, getCellAt } from '../../src/core/board';
import { createGameState } from '../../src/core/game-state';
import { createInitialBoard } from '../../src/core/initial-board';
import { moveCharacter } from '../../src/core/movement';
import { applyRewardClaimsForExploration } from '../../src/core/reward-claim';
import { createRewardState, type RewardState } from '../../src/core/reward';
import { createWaitingRunState } from '../../src/core/run';
import { createInitialRunItemState } from '../../src/core/run-item-state';

function initialBoard(
  width: number,
  height: number,
  mines: readonly { readonly x: number; readonly y: number }[] = [],
  obstacles: readonly { readonly x: number; readonly y: number }[] = [],
) {
  const result = createInitialBoard({
    dimensions: { width, height },
    mineCoordinates: mines,
    obstacleCoordinates: obstacles,
  });
  if (result.status !== 'created') throw new Error('Expected integration fixture Board creation to succeed.');
  return result.board;
}

const coinReward = (
  x: number,
  y: number,
  amount: number,
  oneTimeClaimId: string | null = null,
): RewardState => createRewardState({
  coordinate: createCoordinate(x, y),
  payload: { kind: 'coins', amount },
  claimed: false,
  oneTimeClaimId,
});

describe('Reward compatibility with Stage 1 exploration transitions', () => {
  it('claims exactly the Reward reached by a real movement and preserves active lifecycle facts', () => {
    const oldRun = createWaitingRunState(initialBoard(2, 1));
    const movement = moveCharacter(oldRun, createCoordinate(0, 0));
    expect(movement.outcome).toBe('moved');
    if (movement.outcome !== 'moved') return;

    const result = applyRewardClaimsForExploration({
      oldBoard: oldRun.board,
      nextBoard: movement.state.board,
      rewards: [coinReward(0, 0, 3, 'move-reward'), coinReward(1, 0, 99)],
      assets: {
        inventory: createItemInventoryState({ lucky: 0, detection: 0, airplane: 0, revive: 0 }),
        coins: 5,
        oneTimeClaimIds: [],
      },
    });

    expect(result).toMatchObject({
      status: 'claimed',
      nextCoins: 8,
      nextOneTimeClaimIds: ['move-reward'],
      claimedCoordinates: [{ x: 0, y: 0 }],
      nextRewards: [{ claimed: true }, { claimed: false }],
    });
    expect(movement.state.phase.kind).toBe('active');
    expect(oldRun.characterPosition.kind).toBe('waiting');
    expect(getCellAt(oldRun.board, createCoordinate(0, 0))).toMatchObject({ exploration: 'unexplored' });
  });

  it('returns nothing for a revisit and for a Hidden Mine encounter', () => {
    const waiting = createWaitingRunState(initialBoard(4, 1, [createCoordinate(3, 0)]));
    const firstMove = moveCharacter(waiting, createCoordinate(0, 0));
    if (firstMove.outcome !== 'moved') throw new Error('Expected first Safe movement.');
    const secondMove = moveCharacter(firstMove.state, createCoordinate(1, 0));
    if (secondMove.outcome !== 'moved') throw new Error('Expected second Safe movement.');
    const revisit = moveCharacter(secondMove.state, createCoordinate(0, 0));
    if (revisit.outcome !== 'moved') throw new Error('Expected Safe revisit.');

    expect(applyRewardClaimsForExploration({
      oldBoard: secondMove.state.board,
      nextBoard: revisit.state.board,
      rewards: [createRewardState({
        coordinate: createCoordinate(0, 0), payload: { kind: 'coins', amount: 2 },
        claimed: true, oneTimeClaimId: null,
      })],
      assets: {
        inventory: createItemInventoryState({ lucky: 0, detection: 0, airplane: 0, revive: 0 }),
        coins: 2,
        oneTimeClaimIds: [],
      },
    })).toEqual({ status: 'nothing-to-claim' });

    const encounter = moveCharacter(revisit.state, createCoordinate(3, 0));
    expect(encounter.outcome).toBe('requires-resolution');
    if (encounter.outcome !== 'requires-resolution') return;
    expect(applyRewardClaimsForExploration({
      oldBoard: revisit.state.board,
      nextBoard: encounter.state.board,
      rewards: [],
      assets: {
        inventory: createItemInventoryState({ lucky: 0, detection: 0, airplane: 0, revive: 0 }),
        coins: 2,
        oneTimeClaimIds: [],
      },
    })).toEqual({ status: 'nothing-to-claim' });
  });

  it('claims the final Safe Reward after movement has atomically made the Run won', () => {
    const oldRun = createWaitingRunState(initialBoard(1, 1));
    const movement = moveCharacter(oldRun, createCoordinate(0, 0));
    if (movement.outcome !== 'moved') throw new Error('Expected final Safe movement.');
    expect(movement.state.phase.kind).toBe('won');

    expect(applyRewardClaimsForExploration({
      oldBoard: oldRun.board,
      nextBoard: movement.state.board,
      rewards: [coinReward(0, 0, 4)],
      assets: {
        inventory: createItemInventoryState({ lucky: 0, detection: 0, airplane: 0, revive: 0 }),
        coins: 0,
        oneTimeClaimIds: [],
      },
    })).toMatchObject({ status: 'claimed', nextCoins: 4 });
  });
});

describe('Reward compatibility with a real Airplane candidate', () => {
  function airplaneGame() {
    return createGameState({
      account: createAccountState({ lucky: 1, detection: 2, airplane: 2, revive: 3 }),
      run: createWaitingRunState(initialBoard(
        3,
        3,
        [createCoordinate(1, 0), createCoordinate(2, 2)],
        [createCoordinate(0, 1)],
      )),
      runItems: createInitialRunItemState(123),
    });
  }

  it('claims multiple Coin/Item Rewards from the actual clipped area transition', () => {
    const oldGame = airplaneGame();
    const airplane = createAirplaneCandidate(oldGame, createCoordinate(0, 0));
    expect(airplane.status).toBe('candidate');
    if (airplane.status !== 'candidate') return;

    const result = applyRewardClaimsForExploration({
      oldBoard: oldGame.run.board,
      nextBoard: airplane.candidate.run.board,
      rewards: [
        coinReward(0, 0, 5, 'air-coin'),
        createRewardState({
          coordinate: createCoordinate(1, 1),
          payload: { kind: 'item', item: 'airplane', quantity: 2 },
          claimed: false,
          oneTimeClaimId: 'air-item',
        }),
        coinReward(1, 2, 100),
      ],
      assets: {
        inventory: airplane.candidate.account.inventory,
        coins: 7,
        oneTimeClaimIds: [],
      },
    });

    expect(result).toMatchObject({
      status: 'claimed',
      nextCoins: 12,
      nextInventory: { lucky: 1, detection: 2, airplane: 3, revive: 3 },
      nextOneTimeClaimIds: ['air-coin', 'air-item'],
      claimedCoordinates: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    });
    expect(airplane.candidate.run.characterPosition.kind).toBe('waiting');
    expect(airplane.candidate.run.hasTakenStep).toBe(false);
    expect(airplane.candidate.runItems.successfulAirplaneUses).toBe(1);
    expect(getCellAt(airplane.candidate.run.board, createCoordinate(1, 0))).toMatchObject({
      kind: 'mine', revelation: 'revealed',
    });
    expect(getCellAt(oldGame.run.board, createCoordinate(0, 0))).toMatchObject({ exploration: 'unexplored' });
  });

  it('does not repay a Reward on an already explored Safe inside the Airplane area', () => {
    const waiting = createWaitingRunState(initialBoard(3, 2));
    const priorMove = moveCharacter(waiting, createCoordinate(1, 0));
    if (priorMove.outcome !== 'moved') throw new Error('Expected prior Safe movement.');
    const oldGame = createGameState({
      account: createAccountState({ lucky: 0, detection: 0, airplane: 1, revive: 0 }),
      run: priorMove.state,
      runItems: createInitialRunItemState(null),
    });
    const airplane = createAirplaneCandidate(oldGame, createCoordinate(0, 0));
    if (airplane.status !== 'candidate') throw new Error('Expected Airplane candidate.');

    expect(applyRewardClaimsForExploration({
      oldBoard: oldGame.run.board,
      nextBoard: airplane.candidate.run.board,
      rewards: [createRewardState({
        coordinate: createCoordinate(1, 0), payload: { kind: 'coins', amount: 20 },
        claimed: true, oneTimeClaimId: null,
      })],
      assets: { inventory: airplane.candidate.account.inventory, coins: 6, oneTimeClaimIds: [] },
    })).toEqual({ status: 'nothing-to-claim' });
  });

  it('allows the real Airplane transition to reach won before Reward settlement', () => {
    const oldGame = createGameState({
      account: createAccountState({ lucky: 0, detection: 0, airplane: 1, revive: 0 }),
      run: createWaitingRunState(initialBoard(1, 1)),
      runItems: createInitialRunItemState(null),
    });
    const airplane = createAirplaneCandidate(oldGame, createCoordinate(0, 0));
    if (airplane.status !== 'candidate') throw new Error('Expected Airplane candidate.');
    expect(airplane.candidate.run.phase.kind).toBe('won');
    expect(applyRewardClaimsForExploration({
      oldBoard: oldGame.run.board,
      nextBoard: airplane.candidate.run.board,
      rewards: [coinReward(0, 0, 1)],
      assets: { inventory: airplane.candidate.account.inventory, coins: 0, oneTimeClaimIds: [] },
    })).toMatchObject({ status: 'claimed', nextCoins: 1 });
  });

  it('rejects Reward overflow without turning the Airplane intermediate into a final publishable candidate', () => {
    const oldGame = airplaneGame();
    const airplane = createAirplaneCandidate(oldGame, createCoordinate(0, 0));
    if (airplane.status !== 'candidate') throw new Error('Expected Airplane candidate.');
    const result = applyRewardClaimsForExploration({
      oldBoard: oldGame.run.board,
      nextBoard: airplane.candidate.run.board,
      rewards: [coinReward(0, 0, 1)],
      assets: {
        inventory: airplane.candidate.account.inventory,
        coins: Number.MAX_SAFE_INTEGER,
        oneTimeClaimIds: [],
      },
    });

    expect(result).toEqual({ status: 'rejected', reason: 'asset-overflow', asset: 'coins' });
    expect('candidate' in result).toBe(false);
    expect(oldGame.account.inventory.airplane).toBe(2);
    expect(oldGame.runItems.successfulAirplaneUses).toBe(0);
    expect(getCellAt(oldGame.run.board, createCoordinate(0, 0))).toMatchObject({ exploration: 'unexplored' });
  });
});
