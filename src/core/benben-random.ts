import { BENBEN_ASSISTANCE_CONFIGURATION } from './benben-configuration';
import { createSeededRandomSource } from './random';
import { isStableId } from './stable-id';
import type { RewardItem } from './reward';

export const BENBEN_ELIGIBILITY_RANDOM_DOMAIN = 'benben-eligibility-v1';
export const BENBEN_CARD_RANDOM_DOMAIN = 'benben-card-v1';

export interface BenbenRandomIdentityInput {
  readonly levelId: unknown;
  readonly runId: unknown;
}

type InvalidBenbenRandomIdentity = {
  readonly status: 'rejected';
  readonly reason: 'invalid-level-id' | 'invalid-run-id';
};

export type BenbenEligibilityDerivationResult =
  | InvalidBenbenRandomIdentity
  | {
      readonly status: 'derived';
      readonly seed: number;
      readonly roll: number;
      readonly success: boolean;
    };

export type BenbenCardDerivationResult =
  | InvalidBenbenRandomIdentity
  | {
      readonly status: 'derived';
      readonly seed: number;
      readonly roll: number;
      readonly item: RewardItem;
    };

const UTF8 = new TextEncoder();
const FNV1A_OFFSET = 0x811c9dc5;
const FNV1A_PRIME = 0x01000193;

function updateHash(hash: number, byte: number): number {
  return Math.imul(hash ^ byte, FNV1A_PRIME) >>> 0;
}

/**
 * FNV-1a over three ordered, uint32-byte-length-prefixed UTF-8 fields.
 * Domain, exact level ID, and exact run ID are therefore unambiguous and compatibility-sensitive.
 */
function deriveSeed(domain: string, levelId: string, runId: string): number {
  let hash = FNV1A_OFFSET;
  for (const field of [domain, levelId, runId]) {
    const bytes = UTF8.encode(field);
    const length = bytes.length >>> 0;
    hash = updateHash(hash, length >>> 24);
    hash = updateHash(hash, length >>> 16);
    hash = updateHash(hash, length >>> 8);
    hash = updateHash(hash, length);
    for (const byte of bytes) hash = updateHash(hash, byte);
  }
  return hash;
}

function validateIdentity(input: BenbenRandomIdentityInput):
  | InvalidBenbenRandomIdentity
  | { readonly levelId: string; readonly runId: string } {
  if (!isStableId(input.levelId)) return { status: 'rejected', reason: 'invalid-level-id' };
  if (!isStableId(input.runId)) return { status: 'rejected', reason: 'invalid-run-id' };
  return { levelId: input.levelId, runId: input.runId };
}

export function deriveBenbenEligibility(
  input: BenbenRandomIdentityInput,
): BenbenEligibilityDerivationResult {
  const identity = validateIdentity(input);
  if ('status' in identity) return identity;

  const seed = deriveSeed(BENBEN_ELIGIBILITY_RANDOM_DOMAIN, identity.levelId, identity.runId);
  const roll = createSeededRandomSource(seed).nextInt(
    BENBEN_ASSISTANCE_CONFIGURATION.eligibilitySuccessDenominator,
  );
  return Object.freeze({
    status: 'derived',
    seed,
    roll,
    success: roll < BENBEN_ASSISTANCE_CONFIGURATION.eligibilitySuccessNumerator,
  });
}

export function deriveBenbenCard(input: BenbenRandomIdentityInput): BenbenCardDerivationResult {
  const identity = validateIdentity(input);
  if ('status' in identity) return identity;

  const { cardWeights } = BENBEN_ASSISTANCE_CONFIGURATION;
  const totalWeight = cardWeights.lucky + cardWeights.detection
    + cardWeights.airplane + cardWeights.revive;
  const seed = deriveSeed(BENBEN_CARD_RANDOM_DOMAIN, identity.levelId, identity.runId);
  const roll = createSeededRandomSource(seed).nextInt(totalWeight);

  let item: RewardItem;
  if (roll < cardWeights.lucky) item = 'lucky';
  else if (roll < cardWeights.lucky + cardWeights.detection) item = 'detection';
  else if (roll < cardWeights.lucky + cardWeights.detection + cardWeights.airplane) item = 'airplane';
  else item = 'revive';

  return Object.freeze({ status: 'derived', seed, roll, item });
}
