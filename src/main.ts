import Phaser from 'phaser';
import { BASELINE_MESSAGE } from './baseline';
import { presentationCopy } from './config/presentation-copy';
import { SHOP_PRICES } from './config/shop-prices';
import { validateShopCatalog } from './core/shop';
import { createPresentationRoot } from './presentation-root';
import { renderShopPanel, renderShopRecoveryPanel } from './ui/shop-presentation';
import { createLocalStorageAdapter } from './systems/persistence/key-value-storage';
import { createProductionStage4Session } from './systems/persistence/production-stage4-runtime';
import { createSystemClock, createWriterIdentity } from './systems/persistence/writer-lease';
import { createSecureTechnicalFacts } from './systems/presentation/technical-facts';
import './style.css';

let browserStorage: Storage | null = null;
try { browserStorage = window.localStorage; } catch { /* The adapter reports unavailable storage. */ }
const checkedShop = validateShopCatalog(SHOP_PRICES);
const shopCatalog = checkedShop.status === 'valid' ? checkedShop.catalog : null;
/** One browser authority; failed secure identity prevents boot without touching saved data. */
export const presentationRoot = (() => {
  try {
    const productionSession = createProductionStage4Session(
      createLocalStorageAdapter(browserStorage), createWriterIdentity(), createSystemClock(), shopCatalog,
    );
    return createPresentationRoot(productionSession, createSecureTechnicalFacts({
      newGameplayRunId: () => globalThis.crypto.randomUUID(),
      newGenerationUint32: () => globalThis.crypto.getRandomValues(new Uint32Array(1))[0],
      newDetectionUint32: () => globalThis.crypto.getRandomValues(new Uint32Array(1))[0],
    }), shopCatalog);
  } catch {
    return null;
  }
})();

// HMR must reload before replacing the composition root, never create a second live session.
import.meta.hot?.on('vite:beforeUpdate', () => window.location.reload());

class BaselineScene extends Phaser.Scene {
  constructor() {
    super('BaselineScene');
  }

  create(): void {
    this.add
      .text(320, 180, BASELINE_MESSAGE, {
        color: '#18324a',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '24px',
      })
      .setOrigin(0.5);
  }
}

const status = document.querySelector<HTMLElement>('#status');
const shopPanel = document.querySelector<HTMLElement>('#shop');
if (shopPanel !== null && presentationRoot !== null) {
  const draw = (message: Parameters<typeof renderShopPanel>[4] = null) => {
    const current = presentationRoot.read();
    if (current.status === 'recovery') {
      renderShopRecoveryPanel(shopPanel, () => { presentationRoot.shopReload(); draw(); });
      return;
    }
    renderShopPanel(shopPanel, current.view, presentationRoot.shopState(), {
      purchase(item) {
        const outcome = presentationRoot.shopPurchase(item);
        if (outcome === null) return;
        draw(outcome?.status === 'committed' ? 'shop.receipt' : outcome?.copyKey ?? null);
      },
      buyAgain() { if (presentationRoot.shopBuyAgain()) draw(); },
      retry() {
        const outcome = presentationRoot.shopRetryRetained();
        draw(outcome.status === 'committed' ? 'shop.receipt' : outcome.copyKey);
      },
      reload() {
        const snapshot = presentationRoot.shopReload();
        draw(snapshot.status === 'recovery' ? 'error.recovery' : null);
      },
    }, message, presentationRoot.shopActions());
  };
  draw();
} else if (shopPanel !== null) {
  shopPanel.textContent = presentationCopy('status.unavailable');
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: 640,
  height: 360,
  backgroundColor: '#dff3ff',
  parent: 'game',
  scene: BaselineScene,
  callbacks: {
    postBoot: () => {
      document.documentElement.dataset.phaserReady = 'true';
      document.documentElement.dataset.phaserVersion = Phaser.VERSION;
      if (status) {
        status.textContent = presentationRoot === null
          ? presentationCopy('status.unavailable') : BASELINE_MESSAGE;
      }
    },
  },
});
