import { describe, expect, it } from 'vitest';
import { createItemInventoryState } from '../../../src/core/account';
import { consumeSuccessfulItemResource, inspectItemResource } from '../../../src/core/item-resource';

const inventory = createItemInventoryState({ lucky: 2, detection: 3, airplane: 4, revive: 5 });

describe('temporary/account Item resource compatibility', () => {
  it('selects a matching unconsumed temporary card before permanent inventory', () => {
    expect(inspectItemResource('detection', inventory, { item: 'detection', consumed: false }))
      .toEqual({ status: 'available', source: 'temporary' });
  });

  it('consumes only the temporary card and preserves inventory', () => {
    const result = consumeSuccessfulItemResource('detection', inventory, { item: 'detection', consumed: false });
    expect(result).toEqual({
      status: 'consumed', source: 'temporary', inventory,
      temporaryBenbenCard: { item: 'detection', consumed: true },
    });
    if (result.status !== 'consumed') throw new Error('fixture');
    expect(result.inventory).not.toBe(inventory);
  });

  it.each([
    ['no card', null],
    ['mismatched', { item: 'airplane', consumed: false }],
    ['consumed', { item: 'detection', consumed: true }],
  ] as const)('falls back to permanent inventory for %s', (_name, card) => {
    const result = consumeSuccessfulItemResource('detection', inventory, card);
    expect(result).toMatchObject({
      status: 'consumed', source: 'account',
      inventory: { lucky: 2, detection: 2, airplane: 4, revive: 5 },
      temporaryBenbenCard: card,
    });
  });

  it('allows a matching temporary resource with zero permanent inventory', () => {
    const empty = createItemInventoryState({ lucky: 0, detection: 0, airplane: 0, revive: 0 });
    expect(consumeSuccessfulItemResource('revive', empty, { item: 'revive', consumed: false }))
      .toMatchObject({ status: 'consumed', source: 'temporary', inventory: empty });
  });

  it('returns unavailable without mutating inputs', () => {
    const empty = createItemInventoryState({ lucky: 0, detection: 0, airplane: 0, revive: 0 });
    const card = { item: 'lucky' as const, consumed: false };
    expect(consumeSuccessfulItemResource('revive', empty, card)).toEqual({ status: 'unavailable' });
    expect(card).toEqual({ item: 'lucky', consumed: false });
    expect(empty.revive).toBe(0);
  });
});
