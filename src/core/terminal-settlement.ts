import { createBenbenLevelState, type BenbenLevelState } from './benben';
import { BENBEN_ASSISTANCE_CONFIGURATION } from './benben-configuration';
import type { BenbenEligibilityDerivationResult } from './benben-random';
import type { RunPhase } from './run';
import { isStableId } from './stable-id';
import type { TerminalDisposition } from './terminal-disposition';

export interface TerminalSettlementInput {
  readonly levelId: unknown;
  readonly nextPhase: RunPhase;
  readonly previousDisposition: unknown;
  readonly completedLevelIds: unknown;
  readonly benbenByLevel: unknown;
  readonly eligibility?: BenbenEligibilityDerivationResult;
}

export type TerminalSettlementResult =
  | {
      readonly status: 'settled';
      readonly terminalDisposition: 'settled';
      readonly nextCompletedLevelIds: readonly string[];
      readonly nextBenbenByLevel: readonly BenbenLevelState[];
    }
  | {
      readonly status: 'not-applicable';
      readonly reason: 'already-settled' | 'legacy-excluded';
    }
  | {
      readonly status: 'rejected';
      readonly reason:
        | 'invalid-authority'
        | 'invalid-terminal-transition'
        | 'eligibility-required'
        | 'unexpected-eligibility'
        | 'invalid-eligibility';
    };

function copyCompletedLevelIds(input: unknown): readonly string[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const copied: string[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < input.length; index += 1) {
    if (!Object.hasOwn(input, index)) return undefined;
    const levelId = input[index];
    if (!isStableId(levelId) || seen.has(levelId)) return undefined;
    seen.add(levelId);
    copied.push(levelId);
  }
  return Object.freeze(copied);
}

function copyBenbenByLevel(input: unknown): readonly BenbenLevelState[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const copied: BenbenLevelState[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < input.length; index += 1) {
    if (!Object.hasOwn(input, index)) return undefined;
    const value = input[index];
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
    const record = value as Record<string, unknown>;
    let state: BenbenLevelState;
    try {
      state = createBenbenLevelState({
        levelId: record.levelId,
        failureStreak: record.failureStreak,
        status: record.status,
      });
    } catch {
      return undefined;
    }
    if (seen.has(state.levelId)) return undefined;
    seen.add(state.levelId);
    copied.push(state);
  }
  return Object.freeze(copied);
}

function isTerminalPhase(phase: unknown): phase is Extract<RunPhase, { kind: 'won' | 'failed' }> {
  return typeof phase === 'object' && phase !== null && 'kind' in phase &&
    (phase.kind === 'won' || phase.kind === 'failed');
}

function settleWon(
  levelId: string,
  completedLevelIds: readonly string[],
  benbenByLevel: readonly BenbenLevelState[],
): Extract<TerminalSettlementResult, { status: 'settled' }> {
  const nextCompletedLevelIds = completedLevelIds.includes(levelId)
    ? [...completedLevelIds]
    : [...completedLevelIds, levelId];
  const nextBenbenByLevel = benbenByLevel.map((entry) =>
    entry.levelId === levelId && entry.status === 'unavailable'
      ? createBenbenLevelState({ ...entry, failureStreak: 0 })
      : createBenbenLevelState(entry),
  );
  return Object.freeze({
    status: 'settled',
    terminalDisposition: 'settled',
    nextCompletedLevelIds: Object.freeze(nextCompletedLevelIds),
    nextBenbenByLevel: Object.freeze(nextBenbenByLevel),
  });
}

function settleFailed(
  levelId: string,
  completedLevelIds: readonly string[],
  benbenByLevel: readonly BenbenLevelState[],
  eligibilitySupplied: boolean,
  eligibility: unknown,
): TerminalSettlementResult {
  const matchingIndex = benbenByLevel.findIndex((entry) => entry.levelId === levelId);
  const current = matchingIndex === -1
    ? createBenbenLevelState({ levelId, status: 'unavailable', failureStreak: 0 })
    : benbenByLevel[matchingIndex];
  if (current === undefined) throw new Error('Benben record lookup failed.');

  let nextCurrent = createBenbenLevelState(current);
  if (current.status === 'unavailable') {
    const rollBoundary = current.failureStreak === BENBEN_ASSISTANCE_CONFIGURATION.failuresPerRoll - 1;
    if (!rollBoundary && eligibilitySupplied) {
      return { status: 'rejected', reason: 'unexpected-eligibility' };
    }
    if (rollBoundary) {
      if (!eligibilitySupplied) return { status: 'rejected', reason: 'eligibility-required' };
      if (!isValidEligibility(eligibility)) {
        return { status: 'rejected', reason: 'invalid-eligibility' };
      }
      nextCurrent = createBenbenLevelState({
        levelId,
        status: eligibility.success ? 'available' : 'unavailable',
        failureStreak: 0,
      });
    } else {
      nextCurrent = createBenbenLevelState({
        levelId,
        status: 'unavailable',
        failureStreak: current.failureStreak + 1,
      });
    }
  } else if (eligibilitySupplied) {
    return { status: 'rejected', reason: 'unexpected-eligibility' };
  }

  const nextBenbenByLevel = benbenByLevel.map(createBenbenLevelState);
  if (matchingIndex === -1) nextBenbenByLevel.push(nextCurrent);
  else nextBenbenByLevel[matchingIndex] = nextCurrent;

  return Object.freeze({
    status: 'settled',
    terminalDisposition: 'settled',
    nextCompletedLevelIds: Object.freeze([...completedLevelIds]),
    nextBenbenByLevel: Object.freeze(nextBenbenByLevel),
  });
}

function isValidEligibility(
  value: unknown,
): value is Extract<BenbenEligibilityDerivationResult, { readonly status: 'derived' }> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  const { eligibilitySuccessNumerator, eligibilitySuccessDenominator } =
    BENBEN_ASSISTANCE_CONFIGURATION;
  return result.status === 'derived' &&
    typeof result.seed === 'number' && Number.isInteger(result.seed) &&
    result.seed >= 0 && result.seed <= 0xffff_ffff &&
    typeof result.roll === 'number' && Number.isInteger(result.roll) &&
    result.roll >= 0 && result.roll < eligibilitySuccessDenominator &&
    typeof result.success === 'boolean' &&
    result.success === (result.roll < eligibilitySuccessNumerator);
}

/**
 * Pure terminal compatibility step for a short-lived post-Run-transition composition.
 * This does not create an Account, Attempt, persistence candidate, or publishable Runtime.
 */
export function settleTerminalOutcome(input: TerminalSettlementInput): TerminalSettlementResult {
  const disposition = input.previousDisposition as TerminalDisposition;
  if (disposition === 'settled') {
    return { status: 'not-applicable', reason: 'already-settled' };
  }
  if (disposition === 'legacy-excluded') {
    return { status: 'not-applicable', reason: 'legacy-excluded' };
  }
  if (disposition !== 'not-applicable') {
    return { status: 'rejected', reason: 'invalid-authority' };
  }
  if (!isTerminalPhase(input.nextPhase)) {
    return { status: 'rejected', reason: 'invalid-terminal-transition' };
  }
  if (!isStableId(input.levelId)) {
    return { status: 'rejected', reason: 'invalid-authority' };
  }
  const completedLevelIds = copyCompletedLevelIds(input.completedLevelIds);
  const benbenByLevel = copyBenbenByLevel(input.benbenByLevel);
  if (completedLevelIds === undefined || benbenByLevel === undefined) {
    return { status: 'rejected', reason: 'invalid-authority' };
  }
  if (
    benbenByLevel.some(
      (entry) =>
        entry.status === 'unavailable' &&
        entry.failureStreak >= BENBEN_ASSISTANCE_CONFIGURATION.failuresPerRoll,
    )
  ) {
    return { status: 'rejected', reason: 'invalid-authority' };
  }
  const eligibilitySupplied = Object.hasOwn(input, 'eligibility');
  if (input.nextPhase.kind === 'won') {
    if (eligibilitySupplied) return { status: 'rejected', reason: 'unexpected-eligibility' };
    return settleWon(input.levelId, completedLevelIds, benbenByLevel);
  }
  return settleFailed(
    input.levelId,
    completedLevelIds,
    benbenByLevel,
    eligibilitySupplied,
    input.eligibility,
  );
}
