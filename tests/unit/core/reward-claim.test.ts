import { describe, expect, it } from 'vitest';
import { createItemInventoryState, type ItemInventoryState } from '../../../src/core/account';
import { createBoard, createCellState, type BoardState, type CellState } from '../../../src/core/board';
import {
  applyRewardClaimsForExploration,
  getNewlyExploredSafeCoordinates,
  type RewardClaimAssets,
} from '../../../src/core/reward-claim';
import { createRewardState, type RewardItem, type RewardState } from '../../../src/core/reward';

const inventory = (changes: Partial<ItemInventoryState> = {}) => createItemInventoryState({
  lucky: 0, detection: 0, airplane: 0, revive: 0, ...changes,
});
const safe = (explored = false): CellState => createCellState({
  terrain: 'playable', containsMine: false, explored, mineRevealed: false, flagged: false,
});
const mine = (revealed = false): CellState => createCellState({
  terrain: 'playable', containsMine: true, explored: false, mineRevealed: revealed, flagged: false,
});
const obstacle = (): CellState => createCellState({
  terrain: 'obstacle', containsMine: false, explored: false, mineRevealed: false, flagged: false,
});
const board = (width: number, ...cells: CellState[]): BoardState =>
  createBoard({ width, height: cells.length / width }, cells);
const coinReward = (x: number, y: number, amount = 1, options: Partial<RewardState> = {}) =>
  createRewardState({
    coordinate: { x, y }, payload: { kind: 'coins', amount },
    claimed: options.claimed ?? false, oneTimeClaimId: options.oneTimeClaimId ?? null,
  });
const itemReward = (x: number, y: number, item: RewardItem, quantity = 1) =>
  createRewardState({
    coordinate: { x, y }, payload: { kind: 'item', item, quantity },
    claimed: false, oneTimeClaimId: null,
  });
const assets = (changes: Partial<RewardClaimAssets> = {}): RewardClaimAssets => ({
  inventory: inventory(), coins: 0, oneTimeClaimIds: [], ...changes,
});

describe('Reward exploration compatibility', () => {
  it('claims one Coin Reward on a newly explored Safe', () => {
    const result = applyRewardClaimsForExploration({
      oldBoard: board(1, safe()), nextBoard: board(1, safe(true)),
      rewards: [coinReward(0, 0, 4)], assets: assets({ coins: 3 }),
    });
    expect(result).toMatchObject({
      status: 'claimed', nextCoins: 7, claimedCoordinates: [{ x: 0, y: 0 }],
      nextRewards: [{ claimed: true }],
    });
  });

  it.each(['lucky', 'detection', 'airplane', 'revive'] as const)(
    'claims one %s Item Reward',
    (item) => {
      const result = applyRewardClaimsForExploration({
        oldBoard: board(1, safe()), nextBoard: board(1, safe(true)),
        rewards: [itemReward(0, 0, item, 2)], assets: assets({ inventory: inventory({ [item]: 3 }) }),
      });
      expect(result.status).toBe('claimed');
      if (result.status === 'claimed') expect(result.nextInventory[item]).toBe(5);
    },
  );

  it('returns nothing-to-claim when the newly explored Safe has no Reward', () => {
    expect(applyRewardClaimsForExploration({
      oldBoard: board(1, safe()), nextBoard: board(1, safe(true)), rewards: [], assets: assets(),
    })).toEqual({ status: 'nothing-to-claim' });
  });

  it('does not pay an already claimed Reward on an already explored Safe', () => {
    expect(applyRewardClaimsForExploration({
      oldBoard: board(1, safe(true)), nextBoard: board(1, safe(true)),
      rewards: [coinReward(0, 0, 5, { claimed: true })], assets: assets({ coins: 8 }),
    })).toEqual({ status: 'nothing-to-claim' });
  });

  it('rejects an already claimed Reward that is presented as newly explored instead of paying it twice', () => {
    const result = applyRewardClaimsForExploration({
      oldBoard: board(1, safe()), nextBoard: board(1, safe(true)),
      rewards: [coinReward(0, 0, 5, { claimed: true })], assets: assets({ coins: 8 }),
    });
    expect(result).toMatchObject({
      status: 'rejected', reason: 'invalid-authority', issue: 'reward-board-conflict',
    });
    expect('nextCoins' in result).toBe(false);
  });

  it('rejects Coin overflow without a partial result', () => {
    expect(applyRewardClaimsForExploration({
      oldBoard: board(1, safe()), nextBoard: board(1, safe(true)),
      rewards: [coinReward(0, 0)], assets: assets({ coins: Number.MAX_SAFE_INTEGER }),
    })).toEqual({ status: 'rejected', reason: 'asset-overflow', asset: 'coins' });
  });

  it.each(['lucky', 'detection', 'airplane', 'revive'] as const)(
    'rejects %s Item overflow without a partial result',
    (item) => {
      expect(applyRewardClaimsForExploration({
        oldBoard: board(1, safe()), nextBoard: board(1, safe(true)),
        rewards: [itemReward(0, 0, item)],
        assets: assets({ inventory: inventory({ [item]: Number.MAX_SAFE_INTEGER }) }),
      })).toEqual({ status: 'rejected', reason: 'asset-overflow', asset: item });
    },
  );

  it('claims several Rewards as one complete result', () => {
    const result = applyRewardClaimsForExploration({
      oldBoard: board(3, safe(), safe(), safe()), nextBoard: board(3, safe(true), safe(true), safe(true)),
      rewards: [coinReward(0, 0, 2), itemReward(1, 0, 'lucky', 3), itemReward(2, 0, 'revive', 1)],
      assets: assets({ inventory: inventory({ revive: 2 }), coins: 4 }),
    });
    expect(result).toMatchObject({
      status: 'claimed', nextCoins: 6,
      nextInventory: { lucky: 3, detection: 0, airplane: 0, revive: 3 },
      nextRewards: [{ claimed: true }, { claimed: true }, { claimed: true }],
    });
  });

  it('rejects the entire batch when a later Reward overflows', () => {
    const result = applyRewardClaimsForExploration({
      oldBoard: board(2, safe(), safe()), nextBoard: board(2, safe(true), safe(true)),
      rewards: [coinReward(0, 0, 5), itemReward(1, 0, 'revive')],
      assets: assets({ inventory: inventory({ revive: Number.MAX_SAFE_INTEGER }), coins: 7 }),
    });
    expect(result).toEqual({ status: 'rejected', reason: 'asset-overflow', asset: 'revive' });
    expect('nextCoins' in result).toBe(false);
    expect('nextRewards' in result).toBe(false);
  });

  it('atomically records a successful one-time claim', () => {
    const result = applyRewardClaimsForExploration({
      oldBoard: board(1, safe()), nextBoard: board(1, safe(true)),
      rewards: [coinReward(0, 0, 2, { oneTimeClaimId: 'tutorial-l4' })],
      assets: assets({ oneTimeClaimIds: ['historic'] }),
    });
    expect(result).toMatchObject({
      status: 'claimed', nextOneTimeClaimIds: ['historic', 'tutorial-l4'],
      nextRewards: [{ claimed: true, oneTimeClaimId: 'tutorial-l4' }],
    });
  });

  it.each([
    ['unclaimed Reward with an existing claim', false, ['fixed']],
    ['claimed Reward without its claim', true, []],
  ] as const)('rejects %s as invalid authority', (_name, claimed, oneTimeClaimIds) => {
    const explored = claimed;
    expect(applyRewardClaimsForExploration({
      oldBoard: board(1, safe(explored)), nextBoard: board(1, safe(explored)),
      rewards: [coinReward(0, 0, 1, { claimed, oneTimeClaimId: 'fixed' })],
      assets: assets({ oneTimeClaimIds }),
    })).toMatchObject({ status: 'rejected', reason: 'invalid-authority', issue: 'reward-claim-conflict' });
  });

  it('rejects duplicate Reward coordinates and duplicate one-time IDs', () => {
    const oldBoard = board(2, safe(), safe());
    const nextBoard = board(2, safe(true), safe(true));
    expect(applyRewardClaimsForExploration({
      oldBoard, nextBoard,
      rewards: [coinReward(0, 0), coinReward(0, 0, 2)], assets: assets(),
    })).toMatchObject({ status: 'rejected', issue: 'duplicate-reward-coordinate' });
    expect(applyRewardClaimsForExploration({
      oldBoard, nextBoard,
      rewards: [
        coinReward(0, 0, 1, { oneTimeClaimId: 'same' }),
        coinReward(1, 0, 1, { oneTimeClaimId: 'same' }),
      ], assets: assets(),
    })).toMatchObject({ status: 'rejected', issue: 'duplicate-reward-claim-id' });
  });

  it('uses row-major claim order while preserving Reward input order', () => {
    const inputRewards = [
      coinReward(1, 1, 1, { oneTimeClaimId: 'last' }),
      coinReward(1, 0, 1, { oneTimeClaimId: 'middle' }),
      coinReward(0, 0, 1, { oneTimeClaimId: 'first' }),
    ];
    const result = applyRewardClaimsForExploration({
      oldBoard: board(2, safe(), safe(), safe(), safe()),
      nextBoard: board(2, safe(true), safe(true), safe(), safe(true)),
      rewards: inputRewards, assets: assets({ oneTimeClaimIds: ['historic'] }),
    });
    expect(result).toMatchObject({
      status: 'claimed',
      claimedCoordinates: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
      nextOneTimeClaimIds: ['historic', 'first', 'middle', 'last'],
    });
    if (result.status === 'claimed') {
      expect(result.nextRewards.map((reward) => reward.coordinate)).toEqual(inputRewards.map((reward) => reward.coordinate));
    }
  });

  it('rejects dimension, cell-count, obstacle/playable, and Mine-identity mismatch', () => {
    expect(getNewlyExploredSafeCoordinates(board(1, safe()), board(2, safe(), safe()))).toBeUndefined();
    const malformed = { dimensions: { width: 1, height: 1 }, cells: [safe(), safe()] } as BoardState;
    expect(getNewlyExploredSafeCoordinates(board(1, safe()), malformed)).toBeUndefined();
    expect(getNewlyExploredSafeCoordinates(board(1, obstacle()), board(1, safe()))).toBeUndefined();
    expect(getNewlyExploredSafeCoordinates(board(1, mine()), board(1, safe()))).toBeUndefined();
  });

  it('allows hidden-to-revealed Mine and flag changes without treating them as Safe exploration', () => {
    expect(getNewlyExploredSafeCoordinates(
      board(2, mine(), safe()), board(2, mine(true), safe(true)),
    )).toEqual([{ x: 1, y: 0 }]);
  });

  it('validates inventory, Coins, claim IDs, and Reward-to-Board authority before claims', () => {
    const oldBoard = board(1, safe());
    const nextBoard = board(1, safe(true));
    const invalidInventory = { lucky: -1, detection: 0, airplane: 0, revive: 0 } as ItemInventoryState;
    expect(applyRewardClaimsForExploration({ oldBoard, nextBoard, rewards: [], assets: assets({ inventory: invalidInventory }) }))
      .toMatchObject({ issue: 'invalid-inventory' });
    expect(applyRewardClaimsForExploration({ oldBoard, nextBoard, rewards: [], assets: assets({ coins: -1 }) }))
      .toMatchObject({ issue: 'invalid-coins' });
    expect(applyRewardClaimsForExploration({ oldBoard, nextBoard, rewards: [], assets: assets({ oneTimeClaimIds: ['x', 'x'] }) }))
      .toMatchObject({ issue: 'duplicate-claim-id' });
    expect(applyRewardClaimsForExploration({
      oldBoard: board(1, mine()), nextBoard: board(1, mine()),
      rewards: [coinReward(0, 0)], assets: assets(),
    })).toMatchObject({ issue: 'reward-board-conflict' });
  });

  it('does not mutate or alias Board, assets, claims, Rewards, coordinates, or payloads', () => {
    const oldBoard = board(1, safe());
    const nextBoard = board(1, safe(true));
    const currentInventory = inventory({ lucky: 1 });
    const currentClaims = ['historic'];
    const reward = coinReward(0, 0, 2, { oneTimeClaimId: 'new' });
    const rewards = [reward];
    const result = applyRewardClaimsForExploration({
      oldBoard, nextBoard, rewards, assets: { inventory: currentInventory, coins: 1, oneTimeClaimIds: currentClaims },
    });
    expect(result.status).toBe('claimed');
    if (result.status !== 'claimed') return;
    expect(oldBoard.cells[0]).toEqual({ kind: 'safe', exploration: 'unexplored', flagged: false });
    expect(currentInventory).toEqual({ lucky: 1, detection: 0, airplane: 0, revive: 0 });
    expect(currentClaims).toEqual(['historic']);
    expect(reward.claimed).toBe(false);
    expect(result.nextOneTimeClaimIds).not.toBe(currentClaims);
    expect(result.nextRewards).not.toBe(rewards);
    expect(result.nextRewards[0]).not.toBe(reward);
    expect(result.nextRewards[0]?.coordinate).not.toBe(reward.coordinate);
    expect(result.nextRewards[0]?.payload).not.toBe(reward.payload);
    expect(Object.isFrozen(result.nextRewards)).toBe(true);
    expect(Object.isFrozen(result.claimedCoordinates)).toBe(true);
  });
});
