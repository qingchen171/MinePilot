import { describe, expect, it } from 'vitest';
import type { BenbenLevelState } from '../../../src/core/benben';
import {
  deriveBenbenEligibility,
  type BenbenEligibilityDerivationResult,
} from '../../../src/core/benben-random';
import type { RunPhase } from '../../../src/core/run';
import {
  settleTerminalOutcome,
  type TerminalSettlementInput,
} from '../../../src/core/terminal-settlement';

const won: RunPhase = { kind: 'won' };
const failed: RunPhase = {
  kind: 'failed',
  encounter: { target: { x: 0, y: 0 }, occurredOnFirstStep: false },
};
const benben = (
  levelId: string,
  status: BenbenLevelState['status'] = 'unavailable',
  failureStreak = 0,
): BenbenLevelState => ({ levelId, status, failureStreak });
const eligibility = (
  success: boolean,
): Extract<BenbenEligibilityDerivationResult, { status: 'derived' }> => ({
  status: 'derived', seed: success ? 1 : 2, roll: success ? 0 : 3, success,
});

function settle(
  nextPhase: RunPhase,
  changes: Partial<TerminalSettlementInput> = {},
) {
  return settleTerminalOutcome({
    levelId: 'level-current',
    nextPhase,
    previousDisposition: 'not-applicable',
    completedLevelIds: [],
    benbenByLevel: [],
    ...changes,
  });
}

describe('won terminal settlement', () => {
  it('appends a first completion once and keeps replay completion unique', () => {
    expect(settle(won)).toMatchObject({
      status: 'settled', terminalDisposition: 'settled',
      nextCompletedLevelIds: ['level-current'], nextBenbenByLevel: [],
    });
    expect(settle(won, { completedLevelIds: ['level-current'] })).toMatchObject({
      status: 'settled', nextCompletedLevelIds: ['level-current'],
    });
  });

  it('preserves exact unknown historical IDs and their order', () => {
    expect(settle(won, { completedLevelIds: [' unknown ', 'historic'] })).toMatchObject({
      status: 'settled', nextCompletedLevelIds: [' unknown ', 'historic', 'level-current'],
    });
  });

  it('resets only an unavailable streak while preserving record order', () => {
    const result = settle(won, {
      benbenByLevel: [benben('other', 'unavailable', 2), benben('level-current', 'unavailable', 1)],
    });
    expect(result).toMatchObject({
      status: 'settled',
      nextBenbenByLevel: [benben('other', 'unavailable', 2), benben('level-current')],
    });
  });

  it.each([0, 1, 2])('resets unavailable streak %s on completion', (failureStreak) => {
    expect(settle(won, {
      benbenByLevel: [benben('level-current', 'unavailable', failureStreak)],
    })).toMatchObject({
      status: 'settled', nextBenbenByLevel: [benben('level-current')],
    });
  });

  it.each(['available', 'used'] as const)('preserves %s entitlement on completion', (status) => {
    expect(settle(won, { benbenByLevel: [benben('level-current', status)] })).toMatchObject({
      status: 'settled', nextBenbenByLevel: [benben('level-current', status)],
    });
  });

  it('does not create a meaningless Benben record when none exists', () => {
    expect(settle(won)).toMatchObject({ status: 'settled', nextBenbenByLevel: [] });
  });
});

describe('failed terminal settlement', () => {
  it('appends the first unavailable failure record', () => {
    expect(settle(failed)).toMatchObject({
      status: 'settled', nextCompletedLevelIds: [],
      nextBenbenByLevel: [benben('level-current', 'unavailable', 1)],
    });
  });

  it('increments an existing zero streak without eligibility', () => {
    expect(settle(failed, {
      benbenByLevel: [benben('level-current', 'unavailable', 0)],
    })).toMatchObject({
      status: 'settled',
      nextBenbenByLevel: [benben('level-current', 'unavailable', 1)],
    });
  });

  it('increments unavailable in place and preserves unrelated records', () => {
    expect(settle(failed, {
      completedLevelIds: ['historic'],
      benbenByLevel: [benben('level-current', 'unavailable', 1), benben('other', 'used')],
    })).toMatchObject({
      status: 'settled', nextCompletedLevelIds: ['historic'],
      nextBenbenByLevel: [benben('level-current', 'unavailable', 2), benben('other', 'used')],
    });
  });

  it('requires eligibility at the third Failure boundary', () => {
    expect(settle(failed, {
      benbenByLevel: [benben('level-current', 'unavailable', 2)],
    })).toEqual({ status: 'rejected', reason: 'eligibility-required' });
  });

  it('uses eligibility success to make assistance available and resets the streak', () => {
    expect(settle(failed, {
      benbenByLevel: [benben('level-current', 'unavailable', 2)],
      eligibility: eligibility(true),
    })).toMatchObject({
      status: 'settled', nextBenbenByLevel: [benben('level-current', 'available', 0)],
    });
  });

  it('uses eligibility failure to start a new three-Failure cycle from zero', () => {
    const failedRoll = settle(failed, {
      benbenByLevel: [benben('level-current', 'unavailable', 2)],
      eligibility: eligibility(false),
    });
    expect(failedRoll).toMatchObject({
      status: 'settled', nextBenbenByLevel: [benben('level-current', 'unavailable', 0)],
    });
    if (failedRoll.status !== 'settled') return;
    const next = settle(failed, { benbenByLevel: failedRoll.nextBenbenByLevel });
    expect(next).toMatchObject({
      status: 'settled', nextBenbenByLevel: [benben('level-current', 'unavailable', 1)],
    });
    if (next.status !== 'settled') return;
    const second = settle(failed, { benbenByLevel: next.nextBenbenByLevel });
    expect(second).toMatchObject({
      status: 'settled', nextBenbenByLevel: [benben('level-current', 'unavailable', 2)],
    });
    if (second.status !== 'settled') return;
    expect(settle(failed, { benbenByLevel: second.nextBenbenByLevel })).toEqual({
      status: 'rejected', reason: 'eligibility-required',
    });
  });

  it.each(['available', 'used'] as const)('does not accumulate after status is %s', (status) => {
    expect(settle(failed, { benbenByLevel: [benben('level-current', status)] })).toMatchObject({
      status: 'settled', nextBenbenByLevel: [benben('level-current', status)],
    });
  });

  it.each([0, 1])('rejects eligibility before the roll boundary at streak %s', (failureStreak) => {
    expect(settle(failed, {
      benbenByLevel: [benben('level-current', 'unavailable', failureStreak)],
      eligibility: eligibility(true),
    })).toEqual({ status: 'rejected', reason: 'unexpected-eligibility' });
  });

  it('rejects eligibility when no matching Benben record exists', () => {
    expect(settle(failed, { eligibility: eligibility(true) })).toEqual({
      status: 'rejected', reason: 'unexpected-eligibility',
    });
  });

  it.each(['available', 'used'] as const)('rejects eligibility after status is %s', (status) => {
    expect(settle(failed, {
      benbenByLevel: [benben('level-current', status)], eligibility: eligibility(false),
    })).toEqual({ status: 'rejected', reason: 'unexpected-eligibility' });
  });
});

describe('terminal settlement gates and validation', () => {
  it('does not settle an already-settled or legacy-excluded outcome', () => {
    expect(settle(failed, { previousDisposition: 'settled' })).toEqual({
      status: 'not-applicable', reason: 'already-settled',
    });
    expect(settle(won, { previousDisposition: 'legacy-excluded' })).toEqual({
      status: 'not-applicable', reason: 'legacy-excluded',
    });
  });

  it.each([
    { kind: 'active' },
    { kind: 'pending-mine-encounter', encounter: { target: { x: 0, y: 0 }, occurredOnFirstStep: true } },
  ] as const)('rejects non-terminal phase $kind', (nextPhase) => {
    expect(settleTerminalOutcome({
      levelId: 'level-current', nextPhase, previousDisposition: 'not-applicable',
      completedLevelIds: [], benbenByLevel: [],
    })).toEqual({ status: 'rejected', reason: 'invalid-terminal-transition' });
  });

  it('rejects eligibility on won without reopening settled or legacy outcomes', () => {
    expect(settle(won, { eligibility: eligibility(true) })).toEqual({
      status: 'rejected', reason: 'unexpected-eligibility',
    });
    expect(settle(won, {
      eligibility: eligibility(true), previousDisposition: 'settled',
    })).toEqual({ status: 'not-applicable', reason: 'already-settled' });
    expect(settle(failed, {
      eligibility: eligibility(true), previousDisposition: 'legacy-excluded',
    })).toEqual({ status: 'not-applicable', reason: 'legacy-excluded' });
  });

  it.each([
    undefined,
    null,
    { status: 'rejected', reason: 'invalid-run-id' },
    { status: 'derived', seed: -1, roll: 0, success: true },
    { status: 'derived', seed: 1, roll: 10, success: false },
    { status: 'derived', seed: 1, roll: 2, success: false },
  ])('rejects malformed or rejected eligibility %#', (value) => {
    expect(settleTerminalOutcome({
      levelId: 'level-current', nextPhase: failed, previousDisposition: 'not-applicable',
      completedLevelIds: [], benbenByLevel: [benben('level-current', 'unavailable', 2)],
      eligibility: value as BenbenEligibilityDerivationResult,
    })).toEqual({ status: 'rejected', reason: 'invalid-eligibility' });
  });

  it('consumes a real deterministic S4-08A eligibility result without modifying it', () => {
    const derived = deriveBenbenEligibility({ levelId: 'level-current', runId: 'run-current' });
    expect(derived.status).toBe('derived');
    expect(deriveBenbenEligibility({ levelId: 'level-current', runId: 'run-current' })).toEqual(derived);
    const snapshot = structuredClone(derived);
    expect(settle(failed, {
      benbenByLevel: [benben('level-current', 'unavailable', 2)], eligibility: derived,
    })).toMatchObject({
      status: 'settled',
      nextBenbenByLevel: [benben('level-current', derived.status === 'derived' && derived.success ? 'available' : 'unavailable', 0)],
    });
    expect(derived).toEqual(snapshot);
  });

  it.each([
    ['duplicate completion IDs', { completedLevelIds: ['same', 'same'] }],
    ['invalid completion ID', { completedLevelIds: [' '] }],
    ['duplicate Benben levels', { benbenByLevel: [benben('same'), benben('same')] }],
    ['invalid Benben ID', { benbenByLevel: [benben(' ')] }],
    ['available nonzero streak', { benbenByLevel: [benben('x', 'available', 1)] }],
    ['used nonzero streak', { benbenByLevel: [benben('x', 'used', 1)] }],
    ['negative streak', { benbenByLevel: [benben('x', 'unavailable', -1)] }],
    ['fractional streak', { benbenByLevel: [benben('x', 'unavailable', 1.5)] }],
    ['unsafe streak', { benbenByLevel: [benben('x', 'unavailable', Number.MAX_SAFE_INTEGER + 1)] }],
    ['roll-overdue streak', { benbenByLevel: [benben('x', 'unavailable', 3)] }],
    ['past-due streak', { benbenByLevel: [benben('x', 'unavailable', 4)] }],
  ])('rejects %s instead of repairing it', (_name, changes) => {
    expect(settle(won, changes)).toEqual({ status: 'rejected', reason: 'invalid-authority' });
  });

  it('preserves Stable IDs exactly and does not mutate or alias inputs', () => {
    const completedLevelIds = [' old-id '];
    const record = benben(' current-id ', 'unavailable', 2);
    const benbenByLevel = [record];
    const result = settleTerminalOutcome({
      levelId: ' current-id ', nextPhase: won, previousDisposition: 'not-applicable',
      completedLevelIds, benbenByLevel,
    });
    expect(result.status).toBe('settled');
    if (result.status !== 'settled') return;
    expect(result.nextCompletedLevelIds).toEqual([' old-id ', ' current-id ']);
    expect(result.nextBenbenByLevel).toEqual([benben(' current-id ')]);
    expect(completedLevelIds).toEqual([' old-id ']);
    expect(benbenByLevel).toEqual([record]);
    expect(result.nextCompletedLevelIds).not.toBe(completedLevelIds);
    expect(result.nextBenbenByLevel).not.toBe(benbenByLevel);
    expect(result.nextBenbenByLevel[0]).not.toBe(record);
    expect(Object.isFrozen(result.nextCompletedLevelIds)).toBe(true);
    expect(Object.isFrozen(result.nextBenbenByLevel)).toBe(true);
    expect(Object.isFrozen(result.nextBenbenByLevel[0])).toBe(true);
  });
});
