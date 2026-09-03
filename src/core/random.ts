export interface RandomSource {
  nextInt(maxExclusive: number): number;
}

export type RandomSeed = number;

const UINT32_RANGE = 0x1_0000_0000;
const MAX_UINT32 = 0xffff_ffff;

function requireSeed(seed: number): void {
  if (!Number.isInteger(seed) || seed < 0 || seed > MAX_UINT32) {
    throw new RangeError('Random seed must be a non-negative 32-bit integer.');
  }
}

function requireMaxExclusive(maxExclusive: number): void {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > UINT32_RANGE) {
    throw new RangeError('maxExclusive must be an integer from 1 through 2^32.');
  }
}

export function createSeededRandomSource(seed: RandomSeed): RandomSource {
  requireSeed(seed);
  let state = seed >>> 0;

  // Mulberry32 is persistence-sensitive. Changing these operations changes every replayed seed.
  function nextUint32(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (value ^ (value >>> 14)) >>> 0;
  }

  return Object.freeze({
    nextInt(maxExclusive: number): number {
      requireMaxExclusive(maxExclusive);

      const acceptanceLimit = Math.floor(UINT32_RANGE / maxExclusive) * maxExclusive;
      let value = nextUint32();
      while (value >= acceptanceLimit) value = nextUint32();
      return value % maxExclusive;
    },
  });
}
