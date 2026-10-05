import { createStage4AccountState, type Stage4AccountState } from './stage4-account';

export const SHOP_ITEMS = Object.freeze(['lucky', 'detection', 'revive', 'airplane'] as const);
export type ShopItem = typeof SHOP_ITEMS[number];
const validated = Symbol('validated-shop-catalog');
export type ValidatedShopCatalog = Readonly<Record<ShopItem, number>> & { readonly [validated]: true };

export function isShopItem(value: unknown): value is ShopItem {
  return typeof value === 'string' && SHOP_ITEMS.some((item) => item === value);
}

/** Rejects extra or missing keys, invalid prices and mutable config aliases. */
export function validateShopCatalog(input: unknown):
  | { readonly status: 'valid'; readonly catalog: ValidatedShopCatalog }
  | { readonly status: 'invalid' } {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return { status: 'invalid' };
  const record = input as Record<string, unknown>;
  if (Object.keys(record).length !== SHOP_ITEMS.length ||
      !Object.keys(record).every(isShopItem) ||
      !SHOP_ITEMS.every((item) => Number.isSafeInteger(record[item]) && (record[item] as number) > 0)) {
    return { status: 'invalid' };
  }
  return { status: 'valid', catalog: Object.freeze({
    lucky: record.lucky as number, detection: record.detection as number,
    revive: record.revive as number, airplane: record.airplane as number, [validated]: true as const,
  }) };
}

export type ShopPurchaseResult =
  | { readonly status: 'purchased'; readonly account: Stage4AccountState }
  | { readonly status: 'rejected'; readonly reason: 'invalid-shop-item' | 'insufficient-coins' | 'inventory-overflow' };

/** Pure complete-Account replacement; Scene prices and display affordability are never authoritative. */
export function purchaseShopItem(account: Stage4AccountState, item: unknown, catalog: ValidatedShopCatalog): ShopPurchaseResult {
  if (!isShopItem(item)) return { status: 'rejected', reason: 'invalid-shop-item' };
  const price = catalog[item];
  if (account.coins < price) return { status: 'rejected', reason: 'insufficient-coins' };
  const owned = account.inventory[item];
  if (!Number.isSafeInteger(owned + 1)) return { status: 'rejected', reason: 'inventory-overflow' };
  return { status: 'purchased', account: createStage4AccountState({
    ...account, coins: account.coins - price,
    inventory: { ...account.inventory, [item]: owned + 1 },
  }) };
}

export function getShopOffers(account: Stage4AccountState, catalog: ValidatedShopCatalog) {
  return Object.freeze(SHOP_ITEMS.map((item) => Object.freeze({
    item, price: catalog[item], affordable: account.coins >= catalog[item], owned: account.inventory[item],
  })));
}
