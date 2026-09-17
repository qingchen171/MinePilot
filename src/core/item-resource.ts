import {
  createItemInventoryState,
  type ItemInventoryState,
} from './account';
import { type RewardItem } from './reward';
import {
  createTemporaryBenbenCard,
  type TemporaryBenbenCard,
} from './temporary-benben-card';

export type ItemResourceSource = 'temporary' | 'account';

export type ItemResourceInspection =
  | { readonly status: 'available'; readonly source: ItemResourceSource }
  | { readonly status: 'unavailable' };

export type ItemResourceConsumption =
  | {
      readonly status: 'consumed';
      readonly source: ItemResourceSource;
      readonly inventory: ItemInventoryState;
      readonly temporaryBenbenCard: TemporaryBenbenCard | null;
    }
  | { readonly status: 'unavailable' };

function copyCard(card: TemporaryBenbenCard | null): TemporaryBenbenCard | null {
  return card === null ? null : createTemporaryBenbenCard(card);
}

/** Resource availability only. Gameplay legality remains owned by each Item rule. */
export function inspectItemResource(
  item: RewardItem,
  inventory: ItemInventoryState,
  temporaryBenbenCard: TemporaryBenbenCard | null,
): ItemResourceInspection {
  const checkedInventory = createItemInventoryState(inventory);
  const checkedCard = copyCard(temporaryBenbenCard);
  if (checkedCard?.item === item && !checkedCard.consumed) {
    return Object.freeze({ status: 'available', source: 'temporary' });
  }
  return checkedInventory[item] > 0
    ? Object.freeze({ status: 'available', source: 'account' })
    : Object.freeze({ status: 'unavailable' });
}

/** Called only after an Item action has been proven successful. */
export function consumeSuccessfulItemResource(
  item: RewardItem,
  inventory: ItemInventoryState,
  temporaryBenbenCard: TemporaryBenbenCard | null,
): ItemResourceConsumption {
  const checkedInventory = createItemInventoryState(inventory);
  const checkedCard = copyCard(temporaryBenbenCard);
  const resource = inspectItemResource(item, checkedInventory, checkedCard);
  if (resource.status === 'unavailable') return resource;
  if (resource.source === 'temporary') {
    if (checkedCard === null) throw new Error('Temporary resource must have a card.');
    return Object.freeze({
      status: 'consumed',
      source: 'temporary',
      inventory: checkedInventory,
      temporaryBenbenCard: createTemporaryBenbenCard({
        item: checkedCard.item,
        consumed: true,
      }),
    });
  }
  return Object.freeze({
    status: 'consumed',
    source: 'account',
    inventory: createItemInventoryState({
      ...checkedInventory,
      [item]: checkedInventory[item] - 1,
    }),
    temporaryBenbenCard: checkedCard,
  });
}
