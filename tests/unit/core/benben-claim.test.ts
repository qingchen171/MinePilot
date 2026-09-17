import { describe, expect, it } from 'vitest';
import { claimBenbenAssistance, type BenbenClaimInput } from '../../../src/core/benben-claim';
import { deriveBenbenCard } from '../../../src/core/benben-random';

const available = { levelId: 'level-1', status: 'available', failureStreak: 0 } as const;
function input(changes: Partial<BenbenClaimInput> = {}): BenbenClaimInput {
  return {
    attemptLevelId: 'level-1', attemptRunId: 'run-1', claimLevelId: 'level-1',
    hasTakenStep: false, phase: { kind: 'active' }, benbenByLevel: [available],
    temporaryBenbenCard: null, ...changes,
  };
}

describe('Benben Claim', () => {
  it('atomically marks the exact entitlement used and creates the deterministic unconsumed card', () => {
    const result = claimBenbenAssistance(input({
      benbenByLevel: [
        { levelId: 'other', status: 'unavailable', failureStreak: 2 },
        available,
      ],
    }));
    expect(result.status).toBe('claimed');
    if (result.status !== 'claimed') throw new Error('fixture');
    expect(result.nextBenbenByLevel).toEqual([
      { levelId: 'other', status: 'unavailable', failureStreak: 2 },
      { levelId: 'level-1', status: 'used', failureStreak: 0 },
    ]);
    expect(result.temporaryBenbenCard).toEqual({
      item: expect.any(String), consumed: false,
    });
    expect(result.temporaryBenbenCard.item).toBe(
      (deriveBenbenCard({ levelId: 'level-1', runId: 'run-1' }) as { item: string }).item,
    );
  });

  it('is deterministic for the same exact Attempt identity', () => {
    expect(claimBenbenAssistance(input())).toEqual(claimBenbenAssistance(input()));
  });

  it.each([
    ['wrong-level', { claimLevelId: 'other' }, 'wrong-level'],
    ['missing', { benbenByLevel: [] }, 'no-matching-entitlement'],
    ['unavailable', { benbenByLevel: [{ ...available, status: 'unavailable' }] }, 'entitlement-unavailable'],
    ['used', { benbenByLevel: [{ ...available, status: 'used' }] }, 'entitlement-used'],
    ['card', { temporaryBenbenCard: { item: 'lucky', consumed: false } }, 'card-already-exists'],
    ['step', { hasTakenStep: true }, 'step-already-taken'],
    ['pending', { phase: { kind: 'pending-mine-encounter', encounter: { target: { x: 0, y: 0 }, occurredOnFirstStep: true } } }, 'pending-mine-encounter'],
    ['failed', { phase: { kind: 'failed', encounter: { target: { x: 0, y: 0 }, occurredOnFirstStep: true } } }, 'run-failed'],
    ['won', { phase: { kind: 'won' } }, 'run-won'],
    ['invalid-level', { attemptLevelId: '' }, 'invalid-authority'],
    ['invalid-run', { attemptRunId: '' }, 'invalid-authority'],
    ['duplicate-record', { benbenByLevel: [available, available] }, 'invalid-authority'],
  ] as const)('rejects %s without a partial claim', (_caseName, changes, reason) => {
    expect(claimBenbenAssistance(input(changes as Partial<BenbenClaimInput>)))
      .toEqual({ status: 'rejected', reason });
  });

  it('does not mutate or alias caller records', () => {
    const records = [{ ...available }, { levelId: 'other', status: 'used' as const, failureStreak: 0 }];
    const before = structuredClone(records);
    const result = claimBenbenAssistance(input({ benbenByLevel: records }));
    expect(records).toEqual(before);
    expect(Object.isFrozen(result)).toBe(true);
    if (result.status !== 'claimed') throw new Error('fixture');
    expect(Object.isFrozen(result.nextBenbenByLevel)).toBe(true);
    expect(Object.isFrozen(result.temporaryBenbenCard)).toBe(true);
    expect(result.nextBenbenByLevel[1]).not.toBe(records[1]);
  });

  it('does not expose any caller-selected card item input', () => {
    expect(claimBenbenAssistance.length).toBe(1);
    expect(Object.keys(input())).not.toContain('item');
  });
});
