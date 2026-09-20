import { createCoordinate, type BoardState, type Coordinate } from './board';
import { createSeededRandomSource } from './random';
import {
  createRewardPayload,
  createRewardState,
  type RewardPayload,
  type RewardPayloadInput,
  type RewardState,
} from './reward';

export const REWARD_RANDOM_DOMAIN = 'reward-generation-v1';
export const REWARD_WEIGHT_TOTAL = 100;

export interface WeightedRewardPayloadInput {
  readonly weight: number;
  readonly payload: RewardPayloadInput;
}

export interface RewardGenerationConfigInput {
  readonly rewardCount: number;
  readonly payloads: readonly WeightedRewardPayloadInput[];
  readonly oneTimeClaimId: null;
}

export interface WeightedRewardPayload {
  readonly weight: number;
  readonly payload: RewardPayload;
}

export interface RewardGenerationConfig {
  readonly rewardCount: number;
  readonly payloads: readonly WeightedRewardPayload[];
  readonly oneTimeClaimId: null;
}

export type CreateRewardGenerationConfigResult =
  | { readonly status: 'created'; readonly config: RewardGenerationConfig }
  | {
      readonly status: 'invalid';
      readonly reason:
        | 'invalid-reward-count'
        | 'empty-payload-distribution'
        | 'invalid-weight'
        | 'invalid-weight-total'
        | 'invalid-payload'
        | 'invalid-one-time-policy';
      readonly payloadIndex?: number;
    };

export type GenerateRewardsResult =
  | {
      readonly status: 'generated';
      readonly randomSeed: number;
      readonly rewards: readonly RewardState[];
    }
  | { readonly status: 'invalid-generation-seed' }
  | { readonly status: 'insufficient-safe-cells' };

const UTF8 = new TextEncoder();
const FNV1A_OFFSET = 0x811c9dc5;
const FNV1A_PRIME = 0x01000193;

function updateHash(hash: number, byte: number): number {
  return Math.imul(hash ^ byte, FNV1A_PRIME) >>> 0;
}

function copyPayload(payload: RewardPayload): RewardPayload {
  return payload.kind === 'coins'
    ? Object.freeze({ kind: 'coins', amount: payload.amount })
    : Object.freeze({ kind: 'item', item: payload.item, quantity: payload.quantity });
}

export function createRewardGenerationConfig(
  input: RewardGenerationConfigInput,
): CreateRewardGenerationConfigResult {
  if (!Number.isSafeInteger(input.rewardCount) || input.rewardCount < 0) {
    return { status: 'invalid', reason: 'invalid-reward-count' };
  }
  if (!Array.isArray(input.payloads) || input.payloads.length === 0) {
    return { status: 'invalid', reason: 'empty-payload-distribution' };
  }
  if (input.oneTimeClaimId !== null) {
    return { status: 'invalid', reason: 'invalid-one-time-policy' };
  }

  const payloads: WeightedRewardPayload[] = [];
  let totalWeight = 0;
  for (const [payloadIndex, option] of input.payloads.entries()) {
    if (!Number.isSafeInteger(option.weight) || option.weight <= 0) {
      return { status: 'invalid', reason: 'invalid-weight', payloadIndex };
    }
    let payload: RewardPayload;
    try {
      payload = createRewardPayload(option.payload);
    } catch {
      return { status: 'invalid', reason: 'invalid-payload', payloadIndex };
    }
    totalWeight += option.weight;
    if (!Number.isSafeInteger(totalWeight)) {
      return { status: 'invalid', reason: 'invalid-weight', payloadIndex };
    }
    payloads.push(Object.freeze({ weight: option.weight, payload }));
  }
  if (totalWeight !== REWARD_WEIGHT_TOTAL) {
    return { status: 'invalid', reason: 'invalid-weight-total' };
  }

  return {
    status: 'created',
    config: Object.freeze({
      rewardCount: input.rewardCount,
      payloads: Object.freeze(payloads),
      oneTimeClaimId: null,
    }),
  };
}

export function deriveRewardRandomSeed(generationSeed: number): number {
  if (!Number.isInteger(generationSeed) || generationSeed < 0 || generationSeed > 0xffff_ffff) {
    throw new RangeError('Generation seed must be a non-negative 32-bit integer.');
  }

  let hash = FNV1A_OFFSET;
  const domainBytes = UTF8.encode(REWARD_RANDOM_DOMAIN);
  const length = domainBytes.length >>> 0;
  for (const byte of [length >>> 24, length >>> 16, length >>> 8, length]) {
    hash = updateHash(hash, byte);
  }
  for (const byte of domainBytes) hash = updateHash(hash, byte);
  for (const byte of [generationSeed >>> 24, generationSeed >>> 16, generationSeed >>> 8, generationSeed]) {
    hash = updateHash(hash, byte);
  }
  return hash;
}

export function selectRewardPayload(
  config: RewardGenerationConfig,
  roll: number,
): RewardPayload {
  if (!Number.isSafeInteger(roll) || roll < 0 || roll >= REWARD_WEIGHT_TOTAL) {
    throw new RangeError('Reward payload roll must be an integer from 0 through 99.');
  }
  let boundary = 0;
  for (const option of config.payloads) {
    boundary += option.weight;
    if (roll < boundary) return copyPayload(option.payload);
  }
  throw new Error('Reward payload distribution does not cover the roll.');
}

function enumerateUnexploredSafeCoordinates(board: BoardState): Coordinate[] {
  const coordinates: Coordinate[] = [];
  for (const [index, cell] of board.cells.entries()) {
    if (cell.kind === 'safe' && cell.exploration === 'unexplored') {
      coordinates.push(createCoordinate(
        index % board.dimensions.width,
        Math.floor(index / board.dimensions.width),
      ));
    }
  }
  return coordinates;
}

export function generateRewards(input: {
  readonly board: BoardState;
  readonly generationSeed: number;
  readonly config: RewardGenerationConfig;
}): GenerateRewardsResult {
  let randomSeed: number;
  try {
    randomSeed = deriveRewardRandomSeed(input.generationSeed);
  } catch {
    return { status: 'invalid-generation-seed' };
  }

  const candidates = enumerateUnexploredSafeCoordinates(input.board);
  if (input.config.rewardCount > candidates.length) return { status: 'insufficient-safe-cells' };

  const random = createSeededRandomSource(randomSeed);
  for (let selectedIndex = 0; selectedIndex < input.config.rewardCount; selectedIndex += 1) {
    const swapIndex = selectedIndex + random.nextInt(candidates.length - selectedIndex);
    [candidates[selectedIndex], candidates[swapIndex]] = [candidates[swapIndex], candidates[selectedIndex]];
  }

  const selected = candidates.slice(0, input.config.rewardCount);
  const rewards = selected.map((coordinate) => createRewardState({
    coordinate,
    payload: selectRewardPayload(input.config, random.nextInt(REWARD_WEIGHT_TOTAL)),
    claimed: false,
    oneTimeClaimId: input.config.oneTimeClaimId,
  }));
  return Object.freeze({ status: 'generated', randomSeed, rewards: Object.freeze(rewards) });
}
