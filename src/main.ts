import Phaser from 'phaser';
import { BASELINE_MESSAGE } from './baseline';
import { presentationCopy } from './config/presentation-copy';
import { SHOP_PRICES } from './config/shop-prices';
import { validateShopCatalog } from './core/shop';
import { createPresentationRoot } from './presentation-root';
import { renderShopPanel, renderShopRecoveryPanel } from './ui/shop-presentation';
import { renderNavigationPages, type PublicPage } from './ui/navigation-pages';
import type { PresentationCopyKey } from './config/presentation-copy';
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
const navigationPanel = document.querySelector<HTMLElement>('#navigation');
const pagePanel = document.querySelector<HTMLElement>('#page');
const gamePanel = document.querySelector<HTMLElement>('#game');
const shopPanel = document.querySelector<HTMLElement>('#shop');
if (shopPanel !== null && navigationPanel !== null && pagePanel !== null && presentationRoot !== null) {
  const resultMessage = (result: { readonly status: string; readonly reason?: string;
    readonly outcome?: { readonly status: string; readonly copyKey: PresentationCopyKey } }): PresentationCopyKey | null => {
    if (result.status === 'committed') return 'status.committed';
    if (result.status === 'rejected') return result.outcome?.copyKey ?? 'error.unknown';
    if (result.status === 'recovery') return 'error.recovery';
    if (result.status !== 'blocked') return null;
    if (result.reason === 'shop.account-only') return 'nav.shop-restricted';
    if (result.reason === 'shop.unavailable') return 'shop.unavailable';
    if (result.reason === 'level-unavailable') return 'nav.level-unavailable';
    if (result.reason === 'no-attempt') return 'nav.no-attempt';
    if (result.reason === 'authority-changed') return 'nav.authority-changed';
    return 'nav.operation-unresolved';
  };
  const draw = (message: PresentationCopyKey | null = null) => {
    const current = presentationRoot.read();
    const route = presentationRoot.navigation.route() as PublicPage;
    gamePanel!.hidden = route !== 'game' || current.status === 'recovery';
    shopPanel.hidden = route !== 'shop' || current.status === 'recovery';
    renderNavigationPages(navigationPanel, pagePanel, route,
      current.status === 'recovery' ? null : current.view,
      presentationRoot.navigation.levels(), presentationRoot.navigation.pendingSelection(), {
        navigate(next) { draw(resultMessage(presentationRoot.navigation.navigate(next))); },
        selectLevel(id) { draw(resultMessage(presentationRoot.navigation.selectLevel(id))); },
        confirmReplacement() { draw(resultMessage(presentationRoot.navigation.confirmReplacement())); },
        cancelReplacement() { presentationRoot.navigation.cancelSelection(); draw(); },
        retryReplacement() { draw(resultMessage(presentationRoot.navigation.retryReplacement())); },
        leaveForShop() { draw(resultMessage(presentationRoot.navigation.leaveAttemptForShop())); },
        setSetting(key, enabled) {
          const outcome = presentationRoot.submit({ kind: 'set-setting', key, enabled });
          draw(outcome.status === 'committed' ? 'settings.saved' : outcome.copyKey);
        },
        reload() { presentationRoot.reload(); draw(); },
      }, message);
    if (route === 'shop' && current.status !== 'recovery') {
      renderShopPanel(shopPanel, current.view, presentationRoot.shopState(), {
        purchase(item) {
          const outcome = presentationRoot.shopPurchase(item);
          if (outcome !== null) draw(outcome.status === 'committed' ? 'shop.receipt' : outcome.copyKey);
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
    } else if (route === 'shop' && current.status === 'recovery') {
      renderShopRecoveryPanel(shopPanel, () => { presentationRoot.shopReload(); draw(); });
    } else shopPanel.replaceChildren();
  };
  draw();
} else if (shopPanel !== null && navigationPanel !== null && pagePanel !== null) {
  shopPanel.hidden = true;
  if (gamePanel !== null) gamePanel.hidden = true;
  let route: PublicPage = 'recovery';
  const drawUnavailable = () => renderNavigationPages(navigationPanel, pagePanel, route, null, null, null, {
    navigate(next) { route = next === 'feedback' ? 'feedback' : 'recovery'; drawUnavailable(); },
    selectLevel() {}, confirmReplacement() {}, cancelReplacement() {}, retryReplacement() {},
    leaveForShop() {}, setSetting() {}, reload() { window.location.reload(); },
  });
  drawUnavailable();
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
