import { createStableId } from './stable-id';

export type BenbenLevelStatus = 'unavailable' | 'available' | 'used';

export interface BenbenLevelState {
  readonly levelId: string;
  readonly failureStreak: number;
  readonly status: BenbenLevelStatus;
}

export interface BenbenLevelStateInput {
  readonly levelId: unknown;
  readonly failureStreak: unknown;
  readonly status: unknown;
}

export function createBenbenLevelState(input: BenbenLevelStateInput): BenbenLevelState {
  const levelId = createStableId(input.levelId, 'Benben level ID');
  if (
    typeof input.failureStreak !== 'number' ||
    !Number.isSafeInteger(input.failureStreak) ||
    input.failureStreak < 0
  ) {
    throw new RangeError('Benben failure streak must be a non-negative safe integer.');
  }
  if (input.status !== 'unavailable' && input.status !== 'available' && input.status !== 'used') {
    throw new Error('Benben status is invalid.');
  }
  if (input.status !== 'unavailable' && input.failureStreak !== 0) {
    throw new Error('Available or used Benben state must have a zero failure streak.');
  }
  return Object.freeze({
    levelId,
    failureStreak: input.failureStreak,
    status: input.status,
  });
}

