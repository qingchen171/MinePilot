import { describe, expect, it } from 'vitest';
import { createPresentationRoot } from '../../../../src/presentation-root';
import { createInitialStage4GameState } from '../../../../src/core/stage4-game-state';
import { validateShopCatalog } from '../../../../src/core/shop';
import { SHOP_PRICES } from '../../../../src/config/shop-prices';
import type { PresentationSessionPort } from '../../../../src/systems/presentation/session-port';

const runtime = createInitialStage4GameState();
const fresh = { status: 'fresh' as const, runtime, persistence: { kind: 'no-save' as const } };
const technical = { nextRunId: () => 'run', nextGenerationSeed: () => 1, nextDetectionSeed: () => 7 };
const port: PresentationSessionPort = { read: () => fresh, reload: () => fresh,
  execute: () => ({ status: 'rejected', reason: 'storage-failure' }) };

describe('S5-07 exact retained-operation ownership', () => {
  it('cleans only the Game-owned retained envelope on Game exit', () => {
    const root = createPresentationRoot(port, technical);
    expect(root.submit({ kind: 'detection' })).toMatchObject({ status: 'rejected', policy: { retainEnvelope: true } });
    expect(root.gameRetryAvailable()).toBe(true);
    root.gameExit();
    expect(root.gameRetryAvailable()).toBe(false);
    expect(root.gameRetry()).toBeNull();
    expect(root.submit({ kind: 'detection' })).toMatchObject({ status: 'rejected', policy: { retainEnvelope: true } });
  });

  it('never cancels an unrelated Shop-owned envelope when Game cleanup runs', () => {
    const checked = validateShopCatalog(SHOP_PRICES);
    if (checked.status !== 'valid') throw new Error('catalog');
    const root = createPresentationRoot(port, technical, checked.catalog);
    expect(root.shopPurchase('lucky')).toMatchObject({ status: 'rejected', policy: { retainEnvelope: true } });
    root.gameExit();
    expect(root.shopActions().retry).toBe(true);
    expect(root.gameRetryAvailable()).toBe(false);
  });
  it('owns first-shop tutorial retry on the Shop prompt and cancels only that token on exit', () => {
    const checked = validateShopCatalog(SHOP_PRICES);
    if (checked.status !== 'valid') throw new Error('catalog');
    const root = createPresentationRoot(port, technical, checked.catalog);
    expect(root.navigation.navigate('shop').status).toBe('navigated');
    expect(root.submit({ kind: 'acknowledge-tutorial', milestoneId: 'first-shop' }))
      .toMatchObject({ status: 'rejected', policy: { retainEnvelope: true } });
    expect(root.shopTutorialRetryAvailable()).toBe(true);
    expect(root.gameRetryAvailable()).toBe(false);
    root.gameExit();
    expect(root.shopTutorialRetryAvailable()).toBe(true);
    expect(root.shopTutorialRetry()).toMatchObject({ status: 'rejected', policy: { retainEnvelope: true } });
    expect(root.navigation.navigate('home').status).toBe('navigated');
    expect(root.shopTutorialRetryAvailable()).toBe(false);
    expect(root.navigation.navigate('shop').status).toBe('navigated');
    expect(root.shopPurchase('lucky')).toMatchObject({ status: 'rejected', policy: { retainEnvelope: true } });
    expect(root.shopActions().retry).toBe(true);
  });
});
