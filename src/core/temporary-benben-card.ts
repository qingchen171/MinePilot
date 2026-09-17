import { isRewardItem, type RewardItem } from './reward';

export interface TemporaryBenbenCard {
  readonly item: RewardItem;
  readonly consumed: boolean;
}

export interface TemporaryBenbenCardInput {
  readonly item: unknown;
  readonly consumed: unknown;
}

/** Attempt-owned value only; claiming and consuming are separate gameplay commands. */
export function createTemporaryBenbenCard(
  input: TemporaryBenbenCardInput,
): TemporaryBenbenCard {
  if (!isRewardItem(input.item)) {
    throw new Error('Temporary Benben card item is invalid.');
  }
  if (typeof input.consumed !== 'boolean') {
    throw new Error('Temporary Benben card consumed state must be a boolean.');
  }
  return Object.freeze({ item: input.item, consumed: input.consumed });
}
