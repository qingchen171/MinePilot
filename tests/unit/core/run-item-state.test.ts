import { describe, expect, it } from 'vitest';
import {
  createInitialRunItemState,
  createRunItemState,
  type RunItemState,
} from '../../../src/core/run-item-state';

const itemState = (overrides: Partial<RunItemState> = {}): RunItemState => ({
  successfulDetectionUses: 0,
  successfulAirplaneUses: 0,
  successfulReviveUses: 0,
  detectionRandomSeed: 123,
  ...overrides,
});

describe('attempt-local item state foundation', () => {
  it('creates a new-attempt container with zero successful uses and explicit Detection seed', () => {
    expect(createInitialRunItemState(123)).toEqual(itemState());
  });

  it('preserves an explicitly unknown Detection seed without fabricating a valid seed', () => {
    expect(createInitialRunItemState(null)).toEqual(itemState({ detectionRandomSeed: null }));
  });

  it('accepts the frozen per-attempt maximum successful-use counts', () => {
    const state = createRunItemState(itemState({
      successfulDetectionUses: 2,
      successfulAirplaneUses: 1,
      successfulReviveUses: 1,
      detectionRandomSeed: 0xffff_ffff,
    }));

    expect(state).toMatchObject({
      successfulDetectionUses: 2,
      successfulAirplaneUses: 1,
      successfulReviveUses: 1,
      detectionRandomSeed: 0xffff_ffff,
    });
    expect(Object.isFrozen(state)).toBe(true);
  });

  it.each([
    ['Detection over cap', { successfulDetectionUses: 3 }],
    ['Airplane over cap', { successfulAirplaneUses: 2 }],
    ['Revive over cap', { successfulReviveUses: 2 }],
    ['negative use count', { successfulDetectionUses: -1 }],
    ['fractional use count', { successfulAirplaneUses: 0.5 }],
  ] as const)('rejects %s', (_description, override) => {
    expect(() => createRunItemState(itemState(override))).toThrow();
  });

  it.each([-1, 1.5, 0x1_0000_0000, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid Detection random seed %s',
    (seed) => {
      expect(() => createRunItemState(itemState({ detectionRandomSeed: seed }))).toThrow(
        'Detection random seed must be null or a non-negative uint32 integer.',
      );
    },
  );

  it('does not include a Lucky use counter or any gameplay transition', () => {
    const state = createInitialRunItemState(0);

    expect(Object.keys(state)).toEqual([
      'successfulDetectionUses',
      'successfulAirplaneUses',
      'successfulReviveUses',
      'detectionRandomSeed',
    ]);
  });
});
