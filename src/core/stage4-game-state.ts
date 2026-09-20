import { createAttemptState, type AttemptState } from './attempt-state';
import { createStage4AccountState, type Stage4AccountState } from './stage4-account';
import { createInitialStage4AccountState } from './stage4-account';

export interface Stage4GameState {
  readonly account: Stage4AccountState;
  readonly currentAttempt: AttemptState | null;
}

function validateCrossFacts(account: Stage4AccountState, attempt: AttemptState): void {
  const claimIds = new Set(account.oneTimeClaimIds);
  for (const reward of attempt.rewards) {
    if (reward.oneTimeClaimId !== null && reward.claimed !== claimIds.has(reward.oneTimeClaimId)) {
      throw new Error('One-time Reward claim must match Account authority.');
    }
  }
  if (attempt.temporaryBenbenCard !== null) {
    const state = account.benbenByLevel.find((entry) => entry.levelId === attempt.levelId);
    if (state?.status !== 'used') throw new Error('Temporary Benben card requires used same-level entitlement.');
  }
  if (attempt.run.phase.kind === 'won' && attempt.terminalDisposition === 'settled') {
    if (!account.completedLevelIds.includes(attempt.levelId) || attempt.rewards.some((reward) => !reward.claimed)) {
      throw new Error('Settled win requires completion and all Rewards claimed.');
    }
    const state = account.benbenByLevel.find((entry) => entry.levelId === attempt.levelId);
    if (state !== undefined && state.failureStreak !== 0) throw new Error('Settled win must reset same-level failure streak.');
  }
}

export function createStage4GameState(input: Stage4GameState): Stage4GameState {
  const account = createStage4AccountState(input.account);
  const currentAttempt = input.currentAttempt === null ? null : createAttemptState(input.currentAttempt);
  if (currentAttempt !== null) validateCrossFacts(account, currentAttempt);
  return Object.freeze({ account, currentAttempt });
}

export function createInitialStage4GameState(): Stage4GameState {
  return Object.freeze({ account: createInitialStage4AccountState(), currentAttempt: null });
}
