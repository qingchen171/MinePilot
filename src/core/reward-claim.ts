import {
  createItemInventoryState,
  type ItemInventoryState,
} from './account';
import {
  createCoordinate,
  type BoardState,
  type Coordinate,
} from './board';
import {
  createRewardState,
  getRewardBoardCompatibilityIssue,
  type RewardItem,
  type RewardState,
} from './reward';
import { isStableId } from './stable-id';

/** Short-lived claim inputs only. This is deliberately not an Account authority. */
export interface RewardClaimAssets {
  readonly inventory: ItemInventoryState;
  readonly coins: number;
  readonly oneTimeClaimIds: readonly string[];
}

export interface ApplyRewardClaimsInput {
  readonly oldBoard: BoardState;
  readonly nextBoard: BoardState;
  readonly rewards: readonly RewardState[];
  readonly assets: RewardClaimAssets;
}

export type RewardClaimAuthorityIssue =
  | 'invalid-inventory'
  | 'invalid-coins'
  | 'invalid-claim-id'
  | 'duplicate-claim-id'
  | 'invalid-reward'
  | 'duplicate-reward-coordinate'
  | 'duplicate-reward-claim-id'
  | 'reward-board-conflict'
  | 'reward-claim-conflict';

export type ApplyRewardClaimsResult =
  | {
      readonly status: 'claimed';
      readonly nextInventory: ItemInventoryState;
      readonly nextCoins: number;
      readonly nextOneTimeClaimIds: readonly string[];
      readonly nextRewards: readonly RewardState[];
      readonly claimedCoordinates: readonly Coordinate[];
    }
  | { readonly status: 'nothing-to-claim' }
  | {
      readonly status: 'rejected';
      readonly reason: 'invalid-board-transition';
    }
  | {
      readonly status: 'rejected';
      readonly reason: 'invalid-authority';
      readonly issue: RewardClaimAuthorityIssue;
      readonly index?: number;
    }
  | {
      readonly status: 'rejected';
      readonly reason: 'asset-overflow';
      readonly asset: 'coins' | RewardItem;
    };

function coordinateKey(coordinate: Coordinate): string {
  return `${coordinate.x},${coordinate.y}`;
}

function boardsShareTopology(oldBoard: BoardState, nextBoard: BoardState): boolean {
  const { width, height } = oldBoard.dimensions;
  if (
    !Number.isSafeInteger(width) || width <= 0 ||
    !Number.isSafeInteger(height) || height <= 0 ||
    nextBoard.dimensions.width !== width || nextBoard.dimensions.height !== height
  ) return false;

  const expectedCellCount = width * height;
  if (
    !Number.isSafeInteger(expectedCellCount) ||
    oldBoard.cells.length !== expectedCellCount ||
    nextBoard.cells.length !== expectedCellCount
  ) return false;

  return oldBoard.cells.every((oldCell, index) => {
    const nextCell = nextBoard.cells[index];
    return nextCell !== undefined && oldCell.kind === nextCell.kind;
  });
}

function cloneReward(reward: RewardState, claimed = reward.claimed): RewardState {
  return createRewardState({
    coordinate: reward.coordinate,
    payload: reward.payload,
    claimed,
    oneTimeClaimId: reward.oneTimeClaimId,
  });
}

function validateAssets(
  assets: RewardClaimAssets,
):
  | { readonly status: 'valid'; readonly inventory: ItemInventoryState; readonly claims: string[] }
  | Extract<ApplyRewardClaimsResult, { readonly reason: 'invalid-authority' }> {
  let inventory: ItemInventoryState;
  try {
    inventory = createItemInventoryState(assets.inventory);
  } catch {
    return { status: 'rejected', reason: 'invalid-authority', issue: 'invalid-inventory' };
  }
  if (!Number.isSafeInteger(assets.coins) || assets.coins < 0) {
    return { status: 'rejected', reason: 'invalid-authority', issue: 'invalid-coins' };
  }
  if (!Array.isArray(assets.oneTimeClaimIds)) {
    return { status: 'rejected', reason: 'invalid-authority', issue: 'invalid-claim-id' };
  }
  const claims = [...assets.oneTimeClaimIds];
  if (claims.some((claimId) => !isStableId(claimId))) {
    return { status: 'rejected', reason: 'invalid-authority', issue: 'invalid-claim-id' };
  }
  if (new Set(claims).size !== claims.length) {
    return { status: 'rejected', reason: 'invalid-authority', issue: 'duplicate-claim-id' };
  }
  return { status: 'valid', inventory, claims };
}

function validateRewards(
  rewards: readonly RewardState[],
  oldBoard: BoardState,
  currentClaims: ReadonlySet<string>,
):
  | { readonly status: 'valid'; readonly rewards: readonly RewardState[] }
  | Extract<ApplyRewardClaimsResult, { readonly reason: 'invalid-authority' }> {
  if (!Array.isArray(rewards)) {
    return { status: 'rejected', reason: 'invalid-authority', issue: 'invalid-reward' };
  }
  const copied: RewardState[] = [];
  const coordinates = new Set<string>();
  const rewardClaimIds = new Set<string>();

  for (const [index, reward] of rewards.entries()) {
    let validated: RewardState;
    try {
      validated = cloneReward(reward);
    } catch {
      return { status: 'rejected', reason: 'invalid-authority', issue: 'invalid-reward', index };
    }
    const key = coordinateKey(validated.coordinate);
    if (coordinates.has(key)) {
      return {
        status: 'rejected', reason: 'invalid-authority',
        issue: 'duplicate-reward-coordinate', index,
      };
    }
    coordinates.add(key);
    if (getRewardBoardCompatibilityIssue(validated, oldBoard) !== null) {
      return {
        status: 'rejected', reason: 'invalid-authority',
        issue: 'reward-board-conflict', index,
      };
    }
    if (validated.oneTimeClaimId !== null) {
      if (rewardClaimIds.has(validated.oneTimeClaimId)) {
        return {
          status: 'rejected', reason: 'invalid-authority',
          issue: 'duplicate-reward-claim-id', index,
        };
      }
      rewardClaimIds.add(validated.oneTimeClaimId);
      if (validated.claimed !== currentClaims.has(validated.oneTimeClaimId)) {
        return {
          status: 'rejected', reason: 'invalid-authority',
          issue: 'reward-claim-conflict', index,
        };
      }
    }
    copied.push(validated);
  }
  return { status: 'valid', rewards: Object.freeze(copied) };
}

export function getNewlyExploredSafeCoordinates(
  oldBoard: BoardState,
  nextBoard: BoardState,
): readonly Coordinate[] | undefined {
  if (!boardsShareTopology(oldBoard, nextBoard)) return undefined;
  const coordinates: Coordinate[] = [];
  for (let index = 0; index < oldBoard.cells.length; index += 1) {
    const oldCell = oldBoard.cells[index];
    const nextCell = nextBoard.cells[index];
    if (
      oldCell?.kind === 'safe' && oldCell.exploration === 'unexplored' &&
      nextCell?.kind === 'safe' && nextCell.exploration === 'explored'
    ) {
      coordinates.push(createCoordinate(
        index % oldBoard.dimensions.width,
        Math.floor(index / oldBoard.dimensions.width),
      ));
    }
  }
  return Object.freeze(coordinates);
}

/**
 * Computes the complete Reward asset/claim update for one trusted gameplay Board transition.
 * The result is an intermediate pure value, never a Runtime or persistence candidate.
 */
export function applyRewardClaimsForExploration(
  input: ApplyRewardClaimsInput,
): ApplyRewardClaimsResult {
  const newlyExplored = getNewlyExploredSafeCoordinates(input.oldBoard, input.nextBoard);
  if (newlyExplored === undefined) {
    return { status: 'rejected', reason: 'invalid-board-transition' };
  }

  const assets = validateAssets(input.assets);
  if (assets.status === 'rejected') return assets;
  const rewards = validateRewards(input.rewards, input.oldBoard, new Set(assets.claims));
  if (rewards.status === 'rejected') return rewards;

  const rewardByCoordinate = new Map<string, number>();
  rewards.rewards.forEach((reward, index) => rewardByCoordinate.set(coordinateKey(reward.coordinate), index));
  const claimedIndexes: number[] = [];
  const claimedCoordinates: Coordinate[] = [];
  let nextCoins = input.assets.coins;
  const quantities: Record<RewardItem, number> = { ...assets.inventory };
  const nextClaims = [...assets.claims];

  for (const coordinate of newlyExplored) {
    const rewardIndex = rewardByCoordinate.get(coordinateKey(coordinate));
    if (rewardIndex === undefined) continue;
    const reward = rewards.rewards[rewardIndex];
    if (reward === undefined || reward.claimed) continue;

    if (reward.payload.kind === 'coins') {
      const total = nextCoins + reward.payload.amount;
      if (!Number.isSafeInteger(total) || total < 0) {
        return { status: 'rejected', reason: 'asset-overflow', asset: 'coins' };
      }
      nextCoins = total;
    } else {
      const total = quantities[reward.payload.item] + reward.payload.quantity;
      if (!Number.isSafeInteger(total) || total < 0) {
        return { status: 'rejected', reason: 'asset-overflow', asset: reward.payload.item };
      }
      quantities[reward.payload.item] = total;
    }
    if (reward.oneTimeClaimId !== null) nextClaims.push(reward.oneTimeClaimId);
    claimedIndexes.push(rewardIndex);
    claimedCoordinates.push(createCoordinate(coordinate.x, coordinate.y));
  }

  if (claimedIndexes.length === 0) {
    for (const [index, reward] of rewards.rewards.entries()) {
      if (getRewardBoardCompatibilityIssue(reward, input.nextBoard) !== null) {
        return {
          status: 'rejected', reason: 'invalid-authority',
          issue: 'reward-board-conflict', index,
        };
      }
    }
    return { status: 'nothing-to-claim' };
  }

  const claimed = new Set(claimedIndexes);
  const nextRewards = Object.freeze(rewards.rewards.map(
    (reward, index) => cloneReward(reward, claimed.has(index) ? true : reward.claimed),
  ));
  const nextClaimSet = new Set(nextClaims);
  for (const [index, reward] of nextRewards.entries()) {
    if (
      getRewardBoardCompatibilityIssue(reward, input.nextBoard) !== null ||
      (reward.oneTimeClaimId !== null && reward.claimed !== nextClaimSet.has(reward.oneTimeClaimId))
    ) {
      return {
        status: 'rejected', reason: 'invalid-authority',
        issue: 'reward-board-conflict', index,
      };
    }
  }

  return {
    status: 'claimed',
    nextInventory: createItemInventoryState(quantities),
    nextCoins,
    nextOneTimeClaimIds: Object.freeze(nextClaims),
    nextRewards,
    claimedCoordinates: Object.freeze(claimedCoordinates),
  };
}
