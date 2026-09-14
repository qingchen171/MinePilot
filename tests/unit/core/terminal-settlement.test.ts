import { describe, expect, it } from 'vitest';
import type { BenbenLevelState } from '../../../src/core/benben';
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
    ...(nextPhase.kind === 'failed' ? { failureThreshold: 3 } : {}),
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
      benbenByLevel: [benben('other', 'unavailable', 4), benben('level-current', 'unavailable', 7)],
    });
    expect(result).toMatchObject({
      status: 'settled',
      nextBenbenByLevel: [benben('other', 'unavailable', 4), benben('level-current')],
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

  it('increments unavailable in place and preserves unrelated records', () => {
    expect(settle(failed, {
      completedLevelIds: ['historic'],
      benbenByLevel: [benben('level-current', 'unavailable', 1), benben('other', 'used')],
    })).toMatchObject({
      status: 'settled', nextCompletedLevelIds: ['historic'],
      nextBenbenByLevel: [benben('level-current', 'unavailable', 2), benben('other', 'used')],
    });
  });

  it('crosses the threshold into canonical available state', () => {
    expect(settle(failed, {
      benbenByLevel: [benben('level-current', 'unavailable', 2)],
    })).toMatchObject({
      status: 'settled', nextBenbenByLevel: [benben('level-current', 'available', 0)],
    });
  });

  it('unlocks on the first failure when threshold is one', () => {
    expect(settle(failed, { failureThreshold: 1 })).toMatchObject({
      status: 'settled', nextBenbenByLevel: [benben('level-current', 'available', 0)],
    });
  });

  it.each(['available', 'used'] as const)('does not accumulate after status is %s', (status) => {
    expect(settle(failed, { benbenByLevel: [benben('level-current', status)] })).toMatchObject({
      status: 'settled', nextBenbenByLevel: [benben('level-current', status)],
    });
  });

  it('applies a changed threshold only on this real failure', () => {
    const history = [benben('level-current', 'unavailable', 2)];
    expect(history[0]?.failureStreak).toBe(2);
    expect(settle(failed, { benbenByLevel: history, failureThreshold: 2 })).toMatchObject({
      status: 'settled', nextBenbenByLevel: [benben('level-current', 'available', 0)],
    });
  });

  it('does not overflow a maximum-safe historical streak', () => {
    expect(settle(failed, {
      failureThreshold: Number.MAX_SAFE_INTEGER,
      benbenByLevel: [benben('level-current', 'unavailable', Number.MAX_SAFE_INTEGER)],
    })).toMatchObject({
      status: 'settled', nextBenbenByLevel: [benben('level-current', 'available', 0)],
    });
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

  it.each([
    ['missing', undefined, true],
    ['undefined', undefined, false],
    ['null', null, false],
    ['zero', 0, false],
    ['negative', -1, false],
    ['fractional', 1.5, false],
    ['NaN', Number.NaN, false],
    ['Infinity', Number.POSITIVE_INFINITY, false],
    ['unsafe', Number.MAX_SAFE_INTEGER + 1, false],
  ] as const)('rejects %s threshold', (_name, value, omit) => {
    const input: Record<string, unknown> = {
      levelId: 'level-current', nextPhase: failed, previousDisposition: 'not-applicable',
      completedLevelIds: [], benbenByLevel: [],
    };
    if (!omit) input.failureThreshold = value;
    expect(settleTerminalOutcome(input as unknown as TerminalSettlementInput)).toEqual({
      status: 'rejected', reason: omit || value === undefined ? 'missing-config' : 'invalid-threshold',
    });
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

