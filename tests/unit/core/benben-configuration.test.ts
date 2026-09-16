import { describe, expect, it } from 'vitest';
import {
  BENBEN_ASSISTANCE_CONFIGURATION,
  createBenbenAssistanceConfiguration,
  type BenbenAssistanceConfigurationInput,
} from '../../../src/core/benben-configuration';

function valid(overrides: Partial<BenbenAssistanceConfigurationInput> = {}): BenbenAssistanceConfigurationInput {
  return {
    failuresPerRoll: 3,
    eligibilitySuccessNumerator: 3,
    eligibilitySuccessDenominator: 10,
    cardWeights: { lucky: 3, detection: 3, airplane: 1, revive: 3 },
    ...overrides,
  };
}

describe('global Benben assistance configuration', () => {
  it('defines the one exact immutable production authority', () => {
    expect(BENBEN_ASSISTANCE_CONFIGURATION).toEqual({
      failuresPerRoll: 3,
      eligibilitySuccessNumerator: 3,
      eligibilitySuccessDenominator: 10,
      cardWeights: { lucky: 3, detection: 3, airplane: 1, revive: 3 },
    });
    expect(Object.isFrozen(BENBEN_ASSISTANCE_CONFIGURATION)).toBe(true);
    expect(Object.isFrozen(BENBEN_ASSISTANCE_CONFIGURATION.cardWeights)).toBe(true);
    expect(Object.values(BENBEN_ASSISTANCE_CONFIGURATION.cardWeights).reduce((sum, value) => sum + value, 0)).toBe(10);
  });

  it.each([0, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid failuresPerRoll %s',
    (value) => expect(() => createBenbenAssistanceConfiguration(valid({ failuresPerRoll: value })))
      .toThrow('Benben failures per roll must be a positive safe integer.'),
  );

  it.each([0, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid eligibility numerator %s',
    (value) => expect(() => createBenbenAssistanceConfiguration(valid({ eligibilitySuccessNumerator: value })))
      .toThrow('Benben eligibility numerator must be a positive safe integer.'),
  );

  it.each([0, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid eligibility denominator %s',
    (value) => expect(() => createBenbenAssistanceConfiguration(valid({ eligibilitySuccessDenominator: value })))
      .toThrow('Benben eligibility denominator must be a positive safe integer.'),
  );

  it('rejects numerator greater than denominator without clamping', () => {
    expect(() => createBenbenAssistanceConfiguration(valid({
      eligibilitySuccessNumerator: 4,
      eligibilitySuccessDenominator: 3,
    }))).toThrow('Benben eligibility numerator must not exceed its denominator.');
  });

  it.each(['lucky', 'detection', 'airplane', 'revive'] as const)(
    'rejects invalid %s weight',
    (item) => expect(() => createBenbenAssistanceConfiguration(valid({
      cardWeights: {
        lucky: 3,
        detection: 3,
        airplane: 1,
        revive: 3,
        [item]: 0,
      },
    }))).toThrow(`Benben ${item === 'lucky' ? 'Lucky' : item === 'detection' ? 'Detection' : item === 'airplane' ? 'Airplane' : 'Revive'} card weight must be a positive safe integer.`),
  );

  it('rejects a safe-integer overflow in total card weight', () => {
    expect(() => createBenbenAssistanceConfiguration(valid({
      cardWeights: {
        lucky: Number.MAX_SAFE_INTEGER,
        detection: 1,
        airplane: 1,
        revive: 1,
      },
    }))).toThrow('Benben total card weight must be a positive safe integer.');
  });

  it('copies and freezes weights so caller mutation cannot alter constructed authority', () => {
    const weights = { lucky: 3, detection: 3, airplane: 1, revive: 3 };
    const configuration = createBenbenAssistanceConfiguration(valid({ cardWeights: weights }));
    weights.lucky = 99;
    expect(configuration.cardWeights.lucky).toBe(3);
  });
});

