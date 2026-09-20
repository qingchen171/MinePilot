import { createCoordinate, getCellAt, type BoardState, type Coordinate } from './board';
import type { ItemInventoryState } from './account';
import { createStableId } from './stable-id';

export type RewardItem = keyof ItemInventoryState;

export type RewardPayload =
  | { readonly kind: 'coins'; readonly amount: number }
  | { readonly kind: 'item'; readonly item: RewardItem; readonly quantity: number };

export interface RewardState {
  readonly coordinate: Coordinate;
  readonly payload: RewardPayload;
  readonly claimed: boolean;
  readonly oneTimeClaimId: string | null;
}

export interface RewardStateInput {
  readonly coordinate: Coordinate;
  readonly payload:
    | { readonly kind: 'coins'; readonly amount: number }
    | { readonly kind: 'item'; readonly item: unknown; readonly quantity: number };
  readonly claimed: unknown;
  readonly oneTimeClaimId: unknown;
}

export type RewardPayloadInput = RewardStateInput['payload'];

export type RewardBoardCompatibilityIssue = 'invalid-coordinate' | 'claimed-mismatch';

export function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function isRewardItem(value: unknown): value is RewardItem {
  return value === 'lucky' || value === 'detection' || value === 'airplane' || value === 'revive';
}

export function createRewardPayload(input: RewardPayloadInput): RewardPayload {
  if (input.kind === 'coins') {
    if (!isPositiveSafeInteger(input.amount)) {
      throw new RangeError('Coin reward amount must be a positive safe integer.');
    }
    return Object.freeze({ kind: 'coins', amount: input.amount });
  }

  if (!isRewardItem(input.item)) throw new Error('Item reward item is invalid.');
  if (!isPositiveSafeInteger(input.quantity)) {
    throw new RangeError('Item reward quantity must be a positive safe integer.');
  }
  return Object.freeze({ kind: 'item', item: input.item, quantity: input.quantity });
}

export function createRewardState(input: RewardStateInput): RewardState {
  const coordinate = createCoordinate(input.coordinate.x, input.coordinate.y);
  if (typeof input.claimed !== 'boolean') throw new Error('Reward claimed must be a boolean.');
  const payload = createRewardPayload(input.payload);

  return Object.freeze({
    coordinate,
    payload,
    claimed: input.claimed,
    oneTimeClaimId: input.oneTimeClaimId === null
      ? null
      : createStableId(input.oneTimeClaimId, 'One-time claim ID'),
  });
}

/** Board-relative construction rule only; this does not claim or grant a reward. */
export function isRewardCompatibleWithBoard(reward: RewardState, board: BoardState): boolean {
  return getRewardBoardCompatibilityIssue(reward, board) === null;
}

export function getRewardBoardCompatibilityIssue(
  reward: RewardState,
  board: BoardState,
): RewardBoardCompatibilityIssue | null {
  const cell = getCellAt(board, reward.coordinate);
  if (cell?.kind !== 'safe') return 'invalid-coordinate';
  return reward.claimed === (cell.exploration === 'explored') ? null : 'claimed-mismatch';
}
