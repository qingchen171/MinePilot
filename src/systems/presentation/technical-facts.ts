import type { TechnicalFactsSource } from './session-port';

const UINT32_MAX = 0xffff_ffff;
export const RNG_VERSION = 'mulberry32-v1';
export const GENERATION_VERSION = 'mine-placement-v1';

export interface InjectedTechnicalCapabilities {
  newGameplayRunId(): string;
  newGenerationUint32(): number;
  newDetectionUint32(): number;
}

function uint32(seed: number): number {
  if (typeof seed !== 'number' || !Number.isInteger(seed) || seed < 0 || seed > UINT32_MAX) {
    throw new Error('Secure entropy returned an invalid seed.');
  }
  return seed;
}

/** Separate technical identities; never consumes or advances gameplay RandomSource. */
export function createSecureTechnicalFacts(capabilities: InjectedTechnicalCapabilities): TechnicalFactsSource {
  return {
    nextRunId() {
      const id = capabilities.newGameplayRunId();
      if (typeof id !== 'string' || id.trim().length === 0) throw new Error('Secure entropy returned an invalid run ID.');
      return id;
    },
    nextGenerationSeed: () => uint32(capabilities.newGenerationUint32()),
    nextDetectionSeed: () => uint32(capabilities.newDetectionUint32()),
  };
}
