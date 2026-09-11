import { describe, expect, it } from 'vitest';
import { createBoard, createCellState } from '../../../src/core/board';
import {
  createRewardState,
  isRewardCompatibleWithBoard,
  type RewardPayload,
} from '../../../src/core/reward';

const board = (explored: boolean) => createBoard({ width: 2, height: 1 }, [
  createCellState({
    terrain: 'playable', containsMine: false, explored, mineRevealed: false, flagged: false,
  }),
  createCellState({
    terrain: 'playable', containsMine: true, explored: false, mineRevealed: false, flagged: false,
  }),
]);

describe('Reward runtime value foundation', () => {
  it.each([
    [{ kind: 'coins', amount: 2 }],
    [{ kind: 'item', item: 'lucky', quantity: 1 }],
    [{ kind: 'item', item: 'detection', quantity: 2 }],
    [{ kind: 'item', item: 'airplane', quantity: 3 }],
    [{ kind: 'item', item: 'revive', quantity: 4 }],
  ] satisfies readonly [RewardPayload][])('constructs an immutable valid reward payload %#', (payload) => {
    const reward = createRewardState({
      coordinate: { x: 0, y: 0 }, payload, claimed: false, oneTimeClaimId: ' claim-1 ',
    });

    expect(reward).toEqual({
      coordinate: { x: 0, y: 0 }, payload, claimed: false, oneTimeClaimId: ' claim-1 ',
    });
    expect(Object.isFrozen(reward)).toBe(true);
    expect(Object.isFrozen(reward.coordinate)).toBe(true);
    expect(Object.isFrozen(reward.payload)).toBe(true);
  });

  it.each([0, -1, 0.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid reward quantity %s',
    (quantity) => {
      expect(() => createRewardState({
        coordinate: { x: 0, y: 0 },
        payload: { kind: 'item', item: 'lucky', quantity },
        claimed: false,
        oneTimeClaimId: null,
      })).toThrow('positive safe integer');
    },
  );

  it.each([0, -1, 0.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid coin amount %s',
    (amount) => {
      expect(() => createRewardState({
        coordinate: { x: 0, y: 0 },
        payload: { kind: 'coins', amount },
        claimed: false,
        oneTimeClaimId: null,
      })).toThrow('positive safe integer');
    },
  );

  it('rejects invalid item and nonblank ID violations at runtime', () => {
    expect(() => createRewardState({
      coordinate: { x: 0, y: 0 },
      payload: { kind: 'item', item: 'future', quantity: 1 },
      claimed: false,
      oneTimeClaimId: null,
    })).toThrow('item is invalid');
    expect(() => createRewardState({
      coordinate: { x: 0, y: 0 }, payload: { kind: 'coins', amount: 1 }, claimed: false, oneTimeClaimId: '   ',
    })).toThrow('nonblank string');
    expect(() => createRewardState({
      coordinate: { x: 0, y: 0 }, payload: { kind: 'coins', amount: 1 }, claimed: 'false', oneTimeClaimId: null,
    })).toThrow('must be a boolean');
    expect(() => createRewardState({
      coordinate: { x: -1, y: 0 }, payload: { kind: 'coins', amount: 1 }, claimed: false, oneTimeClaimId: null,
    })).toThrow('non-negative safe integer');
  });

  it('copies coordinate and payload so external mutation cannot alter the reward', () => {
    const coordinate = { x: 0, y: 0 };
    const payload: { kind: 'coins'; amount: number } = { kind: 'coins', amount: 2 };
    const reward = createRewardState({ coordinate, payload, claimed: false, oneTimeClaimId: null });
    coordinate.x = 1;
    payload.amount = 9;

    expect(reward.coordinate).toEqual({ x: 0, y: 0 });
    expect(reward.payload).toEqual({ kind: 'coins', amount: 2 });
  });

  it('validates only Board-relative reward facts without claiming anything', () => {
    const unclaimed = createRewardState({
      coordinate: { x: 0, y: 0 }, payload: { kind: 'coins', amount: 1 }, claimed: false, oneTimeClaimId: null,
    });
    const claimed = createRewardState({ ...unclaimed, claimed: true });
    const mineReward = createRewardState({ ...unclaimed, coordinate: { x: 1, y: 0 } });

    expect(isRewardCompatibleWithBoard(unclaimed, board(false))).toBe(true);
    expect(isRewardCompatibleWithBoard(claimed, board(true))).toBe(true);
    expect(isRewardCompatibleWithBoard(claimed, board(false))).toBe(false);
    expect(isRewardCompatibleWithBoard(mineReward, board(false))).toBe(false);
  });
});
