export interface BenbenCardWeights {
  readonly lucky: number;
  readonly detection: number;
  readonly airplane: number;
  readonly revive: number;
}

export interface BenbenAssistanceConfiguration {
  readonly failuresPerRoll: number;
  readonly eligibilitySuccessNumerator: number;
  readonly eligibilitySuccessDenominator: number;
  readonly cardWeights: BenbenCardWeights;
}

export interface BenbenAssistanceConfigurationInput {
  readonly failuresPerRoll: unknown;
  readonly eligibilitySuccessNumerator: unknown;
  readonly eligibilitySuccessDenominator: unknown;
  readonly cardWeights: {
    readonly lucky: unknown;
    readonly detection: unknown;
    readonly airplane: unknown;
    readonly revive: unknown;
  };
}

function requirePositiveSafeInteger(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer.`);
  }
  return value;
}

export function createBenbenAssistanceConfiguration(
  input: BenbenAssistanceConfigurationInput,
): BenbenAssistanceConfiguration {
  const failuresPerRoll = requirePositiveSafeInteger(input.failuresPerRoll, 'Benben failures per roll');
  const numerator = requirePositiveSafeInteger(
    input.eligibilitySuccessNumerator,
    'Benben eligibility numerator',
  );
  const denominator = requirePositiveSafeInteger(
    input.eligibilitySuccessDenominator,
    'Benben eligibility denominator',
  );
  if (numerator > denominator) {
    throw new RangeError('Benben eligibility numerator must not exceed its denominator.');
  }

  const cardWeights = Object.freeze({
    lucky: requirePositiveSafeInteger(input.cardWeights.lucky, 'Benben Lucky card weight'),
    detection: requirePositiveSafeInteger(input.cardWeights.detection, 'Benben Detection card weight'),
    airplane: requirePositiveSafeInteger(input.cardWeights.airplane, 'Benben Airplane card weight'),
    revive: requirePositiveSafeInteger(input.cardWeights.revive, 'Benben Revive card weight'),
  });
  const totalWeight = cardWeights.lucky + cardWeights.detection
    + cardWeights.airplane + cardWeights.revive;
  if (!Number.isSafeInteger(totalWeight)) {
    throw new RangeError('Benben total card weight must be a positive safe integer.');
  }

  return Object.freeze({
    failuresPerRoll,
    eligibilitySuccessNumerator: numerator,
    eligibilitySuccessDenominator: denominator,
    cardWeights,
  });
}

/** The single production-owned Benben product configuration. */
export const BENBEN_ASSISTANCE_CONFIGURATION = createBenbenAssistanceConfiguration({
  failuresPerRoll: 3,
  eligibilitySuccessNumerator: 3,
  eligibilitySuccessDenominator: 10,
  cardWeights: {
    lucky: 3,
    detection: 3,
    airplane: 1,
    revive: 3,
  },
});

