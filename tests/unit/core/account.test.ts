import { describe, expect, it } from 'vitest';
import {
  createAccountState,
  createItemInventoryState,
  type ItemInventoryState,
} from '../../../src/core/account';

const inventory = (overrides: Partial<ItemInventoryState> = {}): ItemInventoryState => ({
  lucky: 1,
  detection: 2,
  airplane: 3,
  revive: 4,
  ...overrides,
});

describe('Account item inventory foundation', () => {
  it('constructs all four cross-attempt item quantities without an artificial upper cap', () => {
    const state = createAccountState(inventory({ lucky: Number.MAX_SAFE_INTEGER }));

    expect(state).toEqual({
      inventory: {
        lucky: Number.MAX_SAFE_INTEGER,
        detection: 2,
        airplane: 3,
        revive: 4,
      },
    });
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.inventory)).toBe(true);
  });

  it.each([
    ['negative', -1],
    ['fractional', 1.5],
    ['unsafe', Number.MAX_SAFE_INTEGER + 1],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('rejects a %s inventory quantity at runtime', (_description, value) => {
    expect(() => createItemInventoryState(inventory({ detection: value }))).toThrow(
      'detection inventory must be a non-negative safe integer.',
    );
  });

  it('copies input facts so later external mutation cannot alter account authority', () => {
    const input = inventory();
    const state = createAccountState(input);
    (input as { lucky: number }).lucky = 99;

    expect(state.inventory.lucky).toBe(1);
  });
});
