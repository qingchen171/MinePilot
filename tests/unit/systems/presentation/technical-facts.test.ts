import { describe, expect, it, vi } from 'vitest';
import { createSecureTechnicalFacts, GENERATION_VERSION, RNG_VERSION } from '../../../../src/systems/presentation/technical-facts';

describe('S5-02 narrow injected technical facts', () => {
  it('keeps gameplay run identity, generation and Detection entropy as distinct capabilities', () => {
    const run = vi.fn(() => 'run-1');
    const generation = vi.fn(() => 0);
    const detection = vi.fn(() => 0xffff_ffff);
    const source = createSecureTechnicalFacts({
      newGameplayRunId: run, newGenerationUint32: generation, newDetectionUint32: detection,
    });
    expect(source.nextRunId()).toBe('run-1');
    expect(source.nextGenerationSeed()).toBe(0);
    expect(source.nextDetectionSeed()).toBe(0xffff_ffff);
    expect(run).toHaveBeenCalledTimes(1);
    expect(generation).toHaveBeenCalledTimes(1);
    expect(detection).toHaveBeenCalledTimes(1);
    expect({ RNG_VERSION, GENERATION_VERSION }).toEqual({
      RNG_VERSION: 'mulberry32-v1', GENERATION_VERSION: 'mine-placement-v1',
    });
  });

  it('rejects absent, throwing and invalid secure entropy without fallback', () => {
    const source = createSecureTechnicalFacts({
      newGameplayRunId: () => '',
      newGenerationUint32: () => Number.NaN,
      newDetectionUint32: () => { throw new Error('secure crypto unavailable'); },
    });
    expect(() => source.nextRunId()).toThrow();
    expect(() => source.nextGenerationSeed()).toThrow();
    expect(() => source.nextDetectionSeed()).toThrow();
    const high = createSecureTechnicalFacts({
      newGameplayRunId: () => 'run', newGenerationUint32: () => 0x1_0000_0000,
      newDetectionUint32: () => -1,
    });
    expect(() => high.nextGenerationSeed()).toThrow();
    expect(() => high.nextDetectionSeed()).toThrow();
  });
});
