import { createItemInventoryState, type ItemInventoryState } from './account';
import { createBenbenLevelState, type BenbenLevelState } from './benben';
import { createStableId } from './stable-id';

export interface Stage4AccountState {
  readonly inventory: ItemInventoryState;
  readonly coins: number;
  readonly completedLevelIds: readonly string[];
  readonly oneTimeClaimIds: readonly string[];
  readonly benbenByLevel: readonly BenbenLevelState[];
}

export interface Stage4AccountInput extends Stage4AccountState {}

function ids(values: readonly string[], name: string): readonly string[] {
  const copied = values.map((value) => createStableId(value, name));
  if (new Set(copied).size !== copied.length) throw new Error(`${name}s must be unique.`);
  return Object.freeze(copied);
}

export function createStage4AccountState(input: Stage4AccountInput): Stage4AccountState {
  if (!Number.isSafeInteger(input.coins) || input.coins < 0) {
    throw new RangeError('Account coins must be a non-negative safe integer.');
  }
  const benbenByLevel = input.benbenByLevel.map(createBenbenLevelState);
  if (benbenByLevel.some((entry) => entry.status === 'unavailable' && entry.failureStreak > 2)) {
    throw new Error('Unavailable Benben failure streak must not exceed two.');
  }
  if (new Set(benbenByLevel.map((entry) => entry.levelId)).size !== benbenByLevel.length) {
    throw new Error('Benben level IDs must be unique.');
  }
  return Object.freeze({
    inventory: createItemInventoryState(input.inventory),
    coins: input.coins,
    completedLevelIds: ids(input.completedLevelIds, 'Completed level ID'),
    oneTimeClaimIds: ids(input.oneTimeClaimIds, 'One-time claim ID'),
    benbenByLevel: Object.freeze(benbenByLevel),
  });
}

export function createInitialStage4AccountState(): Stage4AccountState {
  return createStage4AccountState({
    inventory: { lucky: 1, detection: 2, airplane: 1, revive: 1 },
    coins: 0,
    completedLevelIds: [],
    oneTimeClaimIds: [],
    benbenByLevel: [],
  });
}

export function replaceStage4Inventory(
  account: Stage4AccountState,
  inventory: ItemInventoryState,
): Stage4AccountState {
  return createStage4AccountState({ ...account, inventory });
}
