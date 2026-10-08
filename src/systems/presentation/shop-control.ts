import type { ShopItem } from '../../core/shop';
import type { PresentationOutcome } from './adapter';
import type { PublicSnapshot } from './adapter';

export type ShopControlState = 'ready' | 'submitting' | 'receipt-disarmed';

/** Shop-only authorization latch at application lifetime, never a saved gameplay fact. */
export function createShopControl(port: {
  read(): PublicSnapshot;
  submit(choice: { readonly kind: 'purchase'; readonly item: ShopItem }): PresentationOutcome;
}) {
  let state: ShopControlState = 'ready';
  let last: PresentationOutcome | null = null;
  let canRearm = false;
  return Object.freeze({
    state: () => state,
    last: () => last,
    canRearm: () => canRearm,
    actions: () => Object.freeze({
      buyAgain: state === 'receipt-disarmed' && canRearm,
      retry: state === 'receipt-disarmed' && !canRearm && last?.status === 'rejected' && last.policy.retainEnvelope,
      reload: state === 'receipt-disarmed' && !canRearm && !(last?.status === 'rejected' && last.policy.retainEnvelope),
    }),
    purchase(item: ShopItem): PresentationOutcome | null {
  if (state !== 'ready') return null;
      // Synchronous disarm precedes even a synchronously completing persistence commit.
      state = 'submitting';
      try {
        last = port.submit({ kind: 'purchase', item });
        canRearm = last.status === 'committed' ||
          (last.status === 'rejected' && !last.policy.reloadRequired && !last.policy.retainEnvelope);
        return last;
      } finally {
        state = 'receipt-disarmed';
      }
    },
    buyAgain(): boolean {
      if (state !== 'receipt-disarmed' || !canRearm) return false;
      const snapshot = port.read();
      if (snapshot.status === 'recovery' || snapshot.facts.shop.status !== 'available') return false;
      state = 'ready';
      last = null;
      canRearm = false;
      return true;
    },
    afterReload(snapshot: PublicSnapshot): void {
      if (state !== 'receipt-disarmed') return;
      // Reload consumes the exact retained envelope in the adapter. Never leave a dead Retry.
      if (last?.status === 'rejected' && last.policy.retainEnvelope) last = null;
      canRearm = snapshot.status !== 'recovery' && snapshot.facts.shop.status === 'available';
    },
    afterRetainedRetry(result: PresentationOutcome): void {
      if (state !== 'receipt-disarmed') return;
      last = result;
      canRearm = result.status === 'committed' ||
        (result.status === 'rejected' && !result.policy.reloadRequired && !result.policy.retainEnvelope);
    },
    /** Exiting cannot re-authorize a purchase or leave a dead Retry control. */
    afterExit(): void {
      if (state !== 'receipt-disarmed') return;
      if (last?.status === 'rejected' && last.policy.retainEnvelope) {
        last = null;
        canRearm = false;
      }
    },
  });
}
