import { describe, expect, it, vi } from 'vitest';
import { createShopControl } from '../../../../src/systems/presentation/shop-control';
import { createInitialStage4GameState } from '../../../../src/core/stage4-game-state';
import { validateShopCatalog } from '../../../../src/core/shop';
import { SHOP_PRICES } from '../../../../src/config/shop-prices';
import { sanitizeStage4Runtime } from '../../../../src/systems/presentation/public-facts';

const checked = validateShopCatalog(SHOP_PRICES);
if (checked.status !== 'valid') throw new Error('catalog fixture');
const snapshot = { status: 'fresh' as const, facts: sanitizeStage4Runtime(createInitialStage4GameState(), checked.catalog) };

describe('S5-03 Shop-only authorization latch', () => {
  it('disarms synchronously, blocks duplicate activation and requires a distinct buy-again', () => {
    const submit = vi.fn(() => ({ status: 'committed' as const, snapshot, copyKey: 'status.committed' as const }));
    const read = vi.fn(() => snapshot);
    const control = createShopControl({ read, submit });
    expect(control.state()).toBe('ready');
    expect(control.purchase('lucky')?.status).toBe('committed');
    expect(control.state()).toBe('receipt-disarmed');
    expect(control.purchase('lucky')).toBeNull();
    expect(submit).toHaveBeenCalledTimes(1);
    // A reconstructed presentation invokes the same application-lifetime control, not a fresh latch.
    expect(control.state()).toBe('receipt-disarmed');
    expect(control.buyAgain()).toBe(true);
    expect(read).toHaveBeenCalledTimes(1);
    expect(control.purchase('lucky')?.status).toBe('committed');
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it('cannot re-arm on stale, uncertain or unavailable authority', () => {
    const stale = createShopControl({ read: () => snapshot, submit: () => ({
      status: 'rejected' as const, reason: 'revision-conflict', copyKey: 'error.stale' as const,
      policy: { category: 'stale' as const, committedByThisSubmission: false as const,
        retainEnvelope: false, retryUseful: false, reloadRequired: true },
    }) });
    stale.purchase('lucky');
    expect(stale.buyAgain()).toBe(false);
    stale.afterReload(snapshot);
    expect(stale.buyAgain()).toBe(true);
    const uncertain = createShopControl({ read: () => snapshot, submit: () => ({
      status: 'rejected' as const, reason: 'commit-commit-outcome-uncertain', copyKey: 'error.uncertain' as const,
      policy: { category: 'uncertain' as const, committedByThisSubmission: 'uncertain' as const,
        retainEnvelope: false, retryUseful: false, reloadRequired: true },
    }) });
    uncertain.purchase('lucky');
    expect(uncertain.buyAgain()).toBe(false);
    uncertain.afterReload({ status: 'recovery', reason: 'invalid-save' });
    expect(uncertain.buyAgain()).toBe(false);
    uncertain.afterReload(snapshot);
    expect(uncertain.buyAgain()).toBe(true);
  });
});
