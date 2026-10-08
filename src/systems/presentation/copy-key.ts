import type { PresentationCopyKey } from '../../config/presentation-copy';
import type { ResultCategory } from './result-policy';

const RESULT_KEYS: Record<ResultCategory, PresentationCopyKey> = {
  domain: 'error.domain', stale: 'error.stale',
  'pre-commit-retainable': 'error.retry', 'pre-commit-discard': 'error.technical',
  uncertain: 'error.uncertain', recovery: 'error.recovery',
  technical: 'error.technical', unknown: 'error.unknown',
};

const SHOP_REASON_KEYS: Readonly<Record<string, PresentationCopyKey>> = Object.freeze({
  'shop-requires-account-only': 'shop.account-only',
  'invalid-shop-item': 'shop.invalid-item',
  'insufficient-coins': 'shop.insufficient-coins',
  'inventory-overflow': 'shop.inventory-unavailable',
});
const PREFERENCE_REASON_KEYS: Readonly<Record<string, PresentationCopyKey>> = Object.freeze({
  'settings-unchanged': 'settings.already-set',
  'tutorial-already-acknowledged': 'tutorial.already-acknowledged',
  'not-writable': 'error.legacy-read-only',
});

export function copyKeyForResult(category: ResultCategory, reason?: string): PresentationCopyKey {
  if (reason !== undefined && Object.hasOwn(SHOP_REASON_KEYS, reason)) return SHOP_REASON_KEYS[reason]!;
  if (reason !== undefined && Object.hasOwn(PREFERENCE_REASON_KEYS, reason)) return PREFERENCE_REASON_KEYS[reason]!;
  return RESULT_KEYS[category];
}
