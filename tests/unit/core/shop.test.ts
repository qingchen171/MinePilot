import { describe, expect, it } from 'vitest';
import { SHOP_PRICES } from '../../../src/config/shop-prices';
import { createInitialStage4AccountState, createStage4AccountState } from '../../../src/core/stage4-account';
import { getShopOffers, purchaseShopItem, validateShopCatalog } from '../../../src/core/shop';

const validated = validateShopCatalog(SHOP_PRICES);
if (validated.status !== 'valid') throw new Error('Production Shop catalog invalid');
const catalog = validated.catalog;

describe('S5-03 pure Shop authority', () => {
  it('has exactly four validated prices in the one source', () => {
    expect(getShopOffers(createInitialStage4AccountState(), catalog).map(({ item, price }) => [item, price]))
      .toEqual([['lucky', 1], ['detection', 2], ['revive', 4], ['airplane', 8]]);
    for (const invalid of [null, [], {}, { lucky: 1, detection: 2, revive: 4, airplane: 8, bonus: 1 },
      { lucky: 0, detection: 2, revive: 4, airplane: 8 },
      { lucky: 1, detection: 2, revive: 4, airplane: Number.NaN }]) {
      expect(validateShopCatalog(invalid).status).toBe('invalid');
    }
    expect(Object.isFrozen(catalog)).toBe(true);
    expect(catalog).not.toBe(SHOP_PRICES);
  });

  it('debits trusted price, grants exactly one item and preserves the whole Account', () => {
    const old = createStage4AccountState({ ...createInitialStage4AccountState(), coins: 20,
      completedLevelIds: ['level-a'], oneTimeClaimIds: ['claim-a'],
      benbenByLevel: [{ levelId: 'level-a', failureStreak: 2, status: 'unavailable' }],
    });
    const result = purchaseShopItem(old, 'airplane', catalog);
    expect(result.status).toBe('purchased');
    if (result.status !== 'purchased') return;
    expect(result.account.coins).toBe(12);
    expect(result.account.inventory).toEqual({ ...old.inventory, airplane: old.inventory.airplane + 1 });
    expect(result.account.completedLevelIds).toEqual(old.completedLevelIds);
    expect(result.account.oneTimeClaimIds).toEqual(old.oneTimeClaimIds);
    expect(result.account.benbenByLevel).toEqual(old.benbenByLevel);
    expect(old.coins).toBe(20);
    expect(old.inventory.airplane).toBe(1);
    const again = purchaseShopItem(result.account, 'airplane', catalog);
    expect(again).toMatchObject({ status: 'purchased', account: { coins: 4, inventory: { airplane: 3 } } });
  });

  it('rejects invalid items, insufficient coins and safe-integer overflow without a candidate', () => {
    const account = createInitialStage4AccountState();
    expect(purchaseShopItem(account, 'bogus', catalog)).toEqual({ status: 'rejected', reason: 'invalid-shop-item' });
    expect(purchaseShopItem(account, 'lucky', catalog)).toEqual({ status: 'rejected', reason: 'insufficient-coins' });
    const maximum = createStage4AccountState({ ...account, coins: 1,
      inventory: { ...account.inventory, lucky: Number.MAX_SAFE_INTEGER } });
    expect(purchaseShopItem(maximum, 'lucky', catalog)).toEqual({ status: 'rejected', reason: 'inventory-overflow' });
    expect(maximum.coins).toBe(1);
  });
});
