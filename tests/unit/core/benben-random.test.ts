import { describe, expect, it, vi } from 'vitest';
import {
  BENBEN_CARD_RANDOM_DOMAIN,
  BENBEN_ELIGIBILITY_RANDOM_DOMAIN,
  deriveBenbenCard,
  deriveBenbenEligibility,
} from '../../../src/core/benben-random';

describe('Benben deterministic random foundation', () => {
  it('locks explicit versioned and separate domains', () => {
    expect(BENBEN_ELIGIBILITY_RANDOM_DOMAIN).toBe('benben-eligibility-v1');
    expect(BENBEN_CARD_RANDOM_DOMAIN).toBe('benben-card-v1');
    expect(BENBEN_ELIGIBILITY_RANDOM_DOMAIN).not.toBe(BENBEN_CARD_RANDOM_DOMAIN);
  });

  it.each([
    [{ levelId: 'level-1', runId: 'run-1' }, { seed: 359193113, roll: 2, success: true }, { seed: 2913223879, roll: 4, item: 'detection' }],
    [{ levelId: ' level-1 ', runId: 'run-1' }, { seed: 1849215731, roll: 4, success: false }, { seed: 3757351541, roll: 5, item: 'detection' }],
    [{ levelId: '关卡一', runId: '尝试甲' }, { seed: 3601564647, roll: 2, success: true }, { seed: 3052911989, roll: 8, item: 'revive' }],
    [{ levelId: 'level-1', runId: 'run-2' }, { seed: 308860256, roll: 2, success: true }, { seed: 2930001498, roll: 4, item: 'detection' }],
  ] as const)('locks golden vector %#', (identity, eligibility, card) => {
    expect(deriveBenbenEligibility(identity)).toEqual({ status: 'derived', ...eligibility });
    expect(deriveBenbenCard(identity)).toEqual({ status: 'derived', ...card });
  });

  it('uses exact IDs and length-prefix encoding rather than trimming or ambiguous concatenation', () => {
    expect(deriveBenbenEligibility({ levelId: 'level-1', runId: 'run-1' }))
      .not.toEqual(deriveBenbenEligibility({ levelId: ' level-1 ', runId: 'run-1' }));
    expect(deriveBenbenEligibility({ levelId: 'a', runId: 'bc' })).toEqual({
      status: 'derived', seed: 2040637385, roll: 8, success: false,
    });
    expect(deriveBenbenEligibility({ levelId: 'ab', runId: 'c' })).toEqual({
      status: 'derived', seed: 2209334589, roll: 0, success: true,
    });
  });

  it.each([
    [{ levelId: '', runId: 'run' }, 'invalid-level-id'],
    [{ levelId: '   ', runId: 'run' }, 'invalid-level-id'],
    [{ levelId: 'level', runId: '' }, 'invalid-run-id'],
    [{ levelId: 'level', runId: '\t' }, 'invalid-run-id'],
  ] as const)('rejects invalid identity %#', (identity, reason) => {
    expect(deriveBenbenEligibility(identity)).toEqual({ status: 'rejected', reason });
    expect(deriveBenbenCard(identity)).toEqual({ status: 'rejected', reason });
  });

  it('replays both logical events exactly across 100 retries', () => {
    const identity = { levelId: 'level-replay', runId: 'run-replay' };
    const eligibility = deriveBenbenEligibility(identity);
    const card = deriveBenbenCard(identity);
    for (let retry = 0; retry < 100; retry += 1) {
      expect(deriveBenbenEligibility(identity)).toEqual(eligibility);
      expect(deriveBenbenCard(identity)).toEqual(card);
    }
  });

  it('uses exact 0..2 success mapping across all observed bounded rolls', () => {
    const observed = new Map<number, boolean>();
    for (let index = 0; index < 2_000 && observed.size < 10; index += 1) {
      const result = deriveBenbenEligibility({ levelId: 'level-map', runId: `run-${index}` });
      if (result.status === 'derived') observed.set(result.roll, result.success);
    }
    expect([...observed.keys()].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const [roll, success] of observed) expect(success).toBe(roll <= 2);
  });

  it('uses the exact 3/3/1/3 card buckets across every bounded roll', () => {
    const observed = new Map<number, string>();
    for (let index = 0; index < 2_000 && observed.size < 10; index += 1) {
      const result = deriveBenbenCard({ levelId: 'level-map', runId: `run-${index}` });
      if (result.status === 'derived') observed.set(result.roll, result.item);
    }
    expect([...observed.keys()].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect([...observed.entries()].sort(([a], [b]) => a - b).map(([, item]) => item)).toEqual([
      'lucky', 'lucky', 'lucky',
      'detection', 'detection', 'detection',
      'airplane',
      'revive', 'revive', 'revive',
    ]);
  });

  it('has no shared mutable stream, so cross-domain call order is irrelevant', () => {
    const identity = { levelId: 'level-order', runId: 'run-order' };
    const firstEligibility = deriveBenbenEligibility(identity);
    const firstCard = deriveBenbenCard(identity);
    for (let index = 0; index < 20; index += 1) deriveBenbenCard(identity);
    expect(deriveBenbenEligibility(identity)).toEqual(firstEligibility);
    for (let index = 0; index < 20; index += 1) deriveBenbenEligibility(identity);
    expect(deriveBenbenCard(identity)).toEqual(firstCard);
  });

  it('does not call Math.random', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be used.');
    });
    try {
      expect(deriveBenbenEligibility({ levelId: 'level', runId: 'run' }).status).toBe('derived');
      expect(deriveBenbenCard({ levelId: 'level', runId: 'run' }).status).toBe('derived');
      expect(random).not.toHaveBeenCalled();
    } finally {
      random.mockRestore();
    }
  });

  it('does not expose a caller configuration override parameter', () => {
    expect(deriveBenbenEligibility.length).toBe(1);
    expect(deriveBenbenCard.length).toBe(1);
  });
});

