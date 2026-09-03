import { describe, expect, it } from 'vitest';
import { createSeededRandomSource } from '../../../src/core/random';

function sequence(seed: number, length = 8): number[] {
  const random = createSeededRandomSource(seed);
  return Array.from({ length }, () => random.nextInt(1_000_000));
}

describe('seeded deterministic random source', () => {
  it('replays the same integer sequence for the same seed and call order', () => {
    expect(sequence(123_456_789)).toEqual(sequence(123_456_789));
  });

  it('produces different fixed samples for different seeds', () => {
    expect(sequence(1)).not.toEqual(sequence(2));
  });

  it.each([1, 2, 3, 10, 65_537, 0x1_0000_0000])(
    'keeps nextInt output inside [0, %s)',
    (maxExclusive) => {
      const random = createSeededRandomSource(0xffff_ffff);
      for (let index = 0; index < 1_000; index += 1) {
        const value = random.nextInt(maxExclusive);
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(maxExclusive);
      }
    },
  );

  it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, 0x1_0000_0000])(
    'rejects an invalid seed: %s',
    (seed) => {
      expect(() => createSeededRandomSource(seed)).toThrow(
        'Random seed must be a non-negative 32-bit integer.',
      );
    },
  );

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 0x1_0000_0001])(
    'rejects an invalid maxExclusive: %s',
    (maxExclusive) => {
      expect(() => createSeededRandomSource(0).nextInt(maxExclusive)).toThrow(
        'maxExclusive must be an integer from 1 through 2^32.',
      );
    },
  );

  it('accepts both boundary seeds', () => {
    expect(createSeededRandomSource(0).nextInt(10)).toBeGreaterThanOrEqual(0);
    expect(createSeededRandomSource(0xffff_ffff).nextInt(10)).toBeGreaterThanOrEqual(0);
  });

  it('does not call Math.random', () => {
    const original = Math.random;
    Math.random = () => {
      throw new Error('Math.random must not be used.');
    };
    try {
      expect(createSeededRandomSource(42).nextInt(10)).toBeGreaterThanOrEqual(0);
    } finally {
      Math.random = original;
    }
  });
});
