/** Working-language semantic resources. Stage 6 owns full bilingual delivery. */
export const PRESENTATION_COPY = Object.freeze({
  'status.loading': 'Loading your game…',
  'status.unavailable': 'We could not safely open this game. Your saved progress has not been changed.',
  'status.committed': 'Saved.',
  'error.domain': 'That action is not available right now.',
  'error.stale': 'Your game changed elsewhere. Reload before choosing again.',
  'error.retry': 'The action was not saved. Reload and try again if your game is unchanged.',
  'error.technical': 'That action could not be completed.',
  'error.uncertain': 'The save result is uncertain. Reload before making another choice.',
  'error.recovery': 'Your saved game needs attention. No data was reset.',
  'error.unknown': 'We could not confirm the result. Reload before continuing.',
  'error.entropy': 'Secure randomness is unavailable. Your game has not changed.',
  'action.reload': 'Reload game',
  'action.retry': 'Try again',
  'action.dismiss': 'Dismiss',
  'shop.title': 'Shop',
  'shop.unavailable': 'The Shop is unavailable. Your saved game has not changed.',
  'shop.account-only': 'Finish or leave the current attempt before shopping.',
  'shop.invalid-item': 'That item is not offered.',
  'shop.insufficient-coins': 'You do not have enough coins for this item.',
  'shop.inventory-unavailable': 'This purchase cannot be completed safely.',
  'shop.unaffordable': 'Not enough coins',
  'shop.buy': 'Buy one',
  'shop.buy-again': 'Buy again',
  'shop.receipt': 'Purchase saved.',
  'shop.balance': 'Coins',
  'shop.coin': 'coins',
  'shop.owned': 'Owned',
  'shop.item.lucky': 'Lucky',
  'shop.item.detection': 'Detection',
  'shop.item.revive': 'Revive',
  'shop.item.airplane': 'Airplane',
  'settings.already-set': 'This preference is already set.',
  'tutorial.already-acknowledged': 'This tutorial step is already marked complete.',
  'error.legacy-read-only': 'This older attempt can be viewed, but cannot be changed until it is dismissed.',
} as const);

export type PresentationCopyKey = keyof typeof PRESENTATION_COPY;

export function presentationCopy(key: PresentationCopyKey): string {
  return PRESENTATION_COPY[key];
}
