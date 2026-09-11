export interface ItemInventoryState {
  readonly lucky: number;
  readonly detection: number;
  readonly airplane: number;
  readonly revive: number;
}

export interface AccountState {
  readonly inventory: ItemInventoryState;
}

function requireInventoryQuantity(value: number, item: keyof ItemInventoryState): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${item} inventory must be a non-negative safe integer.`);
  }
}

export function createItemInventoryState(input: ItemInventoryState): ItemInventoryState {
  requireInventoryQuantity(input.lucky, 'lucky');
  requireInventoryQuantity(input.detection, 'detection');
  requireInventoryQuantity(input.airplane, 'airplane');
  requireInventoryQuantity(input.revive, 'revive');

  return Object.freeze({
    lucky: input.lucky,
    detection: input.detection,
    airplane: input.airplane,
    revive: input.revive,
  });
}

export function createAccountState(inventory: ItemInventoryState): AccountState {
  return Object.freeze({ inventory: createItemInventoryState(inventory) });
}

/** Replaces only inventory while preserving every fact owned by the account. */
export function replaceInventory<TAccount extends AccountState>(
  account: TAccount,
  nextInventory: ItemInventoryState,
): TAccount & { readonly inventory: ItemInventoryState } {
  return Object.freeze({
    ...account,
    inventory: createItemInventoryState(nextInventory),
  });
}
