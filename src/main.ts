import Phaser from 'phaser';
import { presentationCopy } from './config/presentation-copy';
import { SHOP_PRICES } from './config/shop-prices';
import { validateShopCatalog } from './core/shop';
import { createPresentationRoot } from './presentation-root';
import { BoardScene } from './scenes/board-scene';
import { boardLayout } from './ui/board-layout';
import { createBoardPresentation } from './ui/board-presentation';
import { createGamePresentation, type GameMilestone } from './ui/game-presentation';
import { renderShopPanel, renderShopRecoveryPanel } from './ui/shop-presentation';
import { renderNavigationPages, type PublicPage } from './ui/navigation-pages';
import type { PresentationCopyKey } from './config/presentation-copy';
import type { RewardReceiptProof } from './systems/presentation/reward-receipt';
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

const status = document.querySelector<HTMLElement>('#status');
const navigationPanel = document.querySelector<HTMLElement>('#navigation');
const pagePanel = document.querySelector<HTMLElement>('#page');
const gamePanel = document.querySelector<HTMLElement>('#game');
const gameStage = document.querySelector<HTMLElement>('#game-stage');
const gameControls = document.querySelector<HTMLElement>('#game-controls');
const shopPanel = document.querySelector<HTMLElement>('#shop');
const boardScene = new BoardScene();
let phaserGame: Phaser.Game | null = null;
document.title = presentationCopy('app.title');
if (status !== null) status.textContent = presentationCopy('status.loading');
navigationPanel?.setAttribute('aria-label', presentationCopy('nav.main-label'));
gamePanel?.setAttribute('aria-label', presentationCopy('game.region-label'));
if (shopPanel !== null && navigationPanel !== null && pagePanel !== null &&
    gamePanel !== null && gameStage !== null && gameControls !== null && presentationRoot !== null) {
  let shopTutorialCompanionPending = false;
  shopPanel.addEventListener('click', (event) => {
    if (shopTutorialCompanionPending && event.detail > 1) {
      event.preventDefault(); event.stopImmediatePropagation(); shopTutorialCompanionPending = false;
    } else if (event.detail <= 1) shopTutorialCompanionPending = false;
  }, true);
  const resultMessage = (result: { readonly status: string; readonly reason?: string;
    readonly priorCommit?: boolean;
    readonly outcome?: { readonly status: string; readonly copyKey: PresentationCopyKey } }): PresentationCopyKey | null => {
    if (result.status === 'committed') return 'status.committed';
    if (result.priorCommit) return 'nav.two-step-gap';
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
  const detail = document.createElement('div');
  detail.className = 'game-detail';
  gameControls.append(detail);
  let visibleReceipt: RewardReceiptProof | null = null;
  let visibleMilestone: GameMilestone | null = null;
  let gameReloadRequired = false;
  const board = createBoardPresentation(gameStage, gameControls, (action) => {
    const before = presentationRoot.read();
    const outcome = presentationRoot.submit(action.kind === 'move'
      ? { kind: 'move', coordinate: action.coordinate }
      : { kind: 'flag', coordinate: action.coordinate, flagged: action.flagged === true });
    const leftNumber = action.kind === 'move' && before.status !== 'recovery' &&
      before.view.attempt?.levelId === 'level-002' && before.view.currentNumberDisplay.kind !== 'hidden';
    afterGameOutcome(outcome, outcome.status === 'committed' && outcome.firstLucky ? 'first-lucky' :
      leftNumber && outcome.status === 'committed' ? 'l2-number-hides-on-leave' : null);
  }, () => pagePanel.querySelector<HTMLElement>('h2')?.focus(), () => drawGameControls());
  const gamePresentation = createGamePresentation(detail, {
    airplaneTargetAvailable: () => board.selectedTarget() !== null,
    submit(action, milestoneId) {
      if (action === 'reload') { presentationRoot.reload(); gameReloadRequired = false; draw(); return; }
      if (action === 'retry-retained') {
        const outcome = presentationRoot.gameRetry();
        if (outcome) afterGameOutcome(outcome);
        return;
      }
      if (action === 'defer-benben' || action === 'confirm-restart' || action === 'toggle-help') return;
      if (action === 'airplane') {
        const selected = board.selectedTarget();
        if (selected === null || !board.selectionIsCurrent(selected.epoch)) return;
        afterGameOutcome(presentationRoot.submit({ kind: 'airplane', coordinate: selected.coordinate }));
        return;
      }
      if (action === 'acknowledge-tutorial') {
        if (milestoneId) afterGameOutcome(presentationRoot.submit({ kind: action, milestoneId }));
        return;
      }
      const outcome = presentationRoot.submit({ kind: action });
      if (action === 'dismiss' && outcome.status === 'committed') presentationRoot.navigation.navigate('home');
      afterGameOutcome(outcome);
    },
  });
  presentationRoot.onAuthorityReload(() => {
    board.invalidateAuthority();
    gamePresentation.clear();
    visibleReceipt = null;
    visibleMilestone = null;
  });
  const drawGameControls = () => {
    const current = presentationRoot.read();
    const route = presentationRoot.navigation.route();
    if (current.status === 'recovery' || route !== 'game') { gamePresentation.clear(); return; }
    gamePresentation.render(current.view, visibleReceipt, presentationRoot.gameRetryAvailable(),
      gameReloadRequired, visibleMilestone);
  };
  const afterGameOutcome = (outcome: ReturnType<typeof presentationRoot.submit> |
    NonNullable<ReturnType<typeof presentationRoot.gameRetry>>, eventMilestone: GameMilestone | null = null) => {
    if (outcome.status === 'committed') { board.afterCommittedMutation(); gamePresentation.afterCommit(); }
    gameReloadRequired = outcome.status === 'rejected' ? outcome.policy.reloadRequired && !outcome.policy.retainEnvelope :
      outcome.status === 'unavailable' && outcome.reason === 'reload-required';
    if (gameReloadRequired) { board.invalidateAuthority(); gamePresentation.clear(); }
    visibleReceipt = outcome.status === 'committed' ? outcome.rewardReceipt ?? null : null;
    visibleMilestone = outcome.status === 'committed' && outcome.snapshot.status !== 'recovery' &&
      outcome.snapshot.view.attempt?.levelId === 'level-004' &&
      outcome.rewardReceipt?.status === 'proven' && outcome.rewardReceipt.entries.some((entry) =>
        entry.oneTime && entry.payload.kind === 'coins')
      ? 'l4-one-time-coin-reward' : eventMilestone;
    draw(outcome.status === 'committed' ? outcome.copyKey : outcome.copyKey,
      outcome.status === 'committed' ? outcome.snapshot : null);
  };
  const drawBoard = (current = presentationRoot.read()) => {
    const route = presentationRoot.navigation.route();
    const attempt = current.status === 'recovery' || route !== 'game' ? null : current.view.attempt;
    const layout = attempt === null ? null : boardLayout(gameStage.clientWidth, gameStage.clientHeight,
      attempt.board.width, attempt.board.height);
    if (layout !== null) phaserGame?.scale.resize(layout.width, layout.height);
    board.render(attempt, current.status === 'recovery' ? { kind: 'hidden', value: null } :
      current.view.currentNumberDisplay, layout, !gameReloadRequired);
    boardScene.present(attempt, layout);
  };
  const draw = (message: PresentationCopyKey | null = null,
    committedSnapshot: ReturnType<typeof presentationRoot.read> | null = null) => {
    const current = committedSnapshot ?? presentationRoot.read();
    const route = presentationRoot.navigation.route() as PublicPage;
    gamePanel.hidden = route !== 'game' || current.status === 'recovery';
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
      const tutorialBlocked = presentationRoot.shopTutorialRetryAvailable() ||
        presentationRoot.shopTutorialNeedsReload();
      renderShopPanel(shopPanel, current.view, tutorialBlocked ? 'submitting' : presentationRoot.shopState(), {
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
      if (!current.view.tutorialProgress.acknowledgedMilestoneIds.includes('first-shop')) {
        const prompt = document.createElement('p');
        prompt.textContent = presentationCopy('game.tutorial.first-shop');
        const acknowledge = document.createElement('button');
        const retryTutorial = presentationRoot.shopTutorialRetryAvailable();
        const reloadTutorial = presentationRoot.shopTutorialNeedsReload();
        acknowledge.type = 'button';
        acknowledge.dataset.action = retryTutorial ? 'tutorial-first-shop-retry' :
          reloadTutorial ? 'tutorial-first-shop-reload' : 'tutorial-first-shop';
        acknowledge.textContent = presentationCopy(retryTutorial ? 'action.retry' :
          reloadTutorial ? 'action.reload' : 'game.tutorial.acknowledge');
        acknowledge.addEventListener('keydown', (event) => { if (event.repeat) event.preventDefault(); });
        acknowledge.addEventListener('click', (event) => {
          if (event.detail > 1) return;
          shopTutorialCompanionPending = true;
          if (reloadTutorial) { presentationRoot.shopReload(); draw(); return; }
          const outcome = retryTutorial ? presentationRoot.shopTutorialRetry() :
            presentationRoot.submit({ kind: 'acknowledge-tutorial', milestoneId: 'first-shop' });
          if (outcome === null) return;
          draw(outcome.status === 'committed' ? outcome.copyKey : outcome.copyKey,
            outcome.status === 'committed' ? outcome.snapshot : null);
        });
        shopPanel.append(prompt, acknowledge);
      }
    } else if (route === 'shop' && current.status === 'recovery') {
      renderShopRecoveryPanel(shopPanel, () => { presentationRoot.shopReload(); draw(); });
    } else shopPanel.replaceChildren();
    drawBoard(current);
    if (route === 'game' && current.status !== 'recovery') {
      gamePresentation.render(current.view, visibleReceipt, presentationRoot.gameRetryAvailable(),
        gameReloadRequired, visibleMilestone);
      visibleMilestone = null;
    } else { gamePresentation.clear(); visibleReceipt = null; visibleMilestone = null; gameReloadRequired = false; }
  };
  draw();
  new ResizeObserver(() => drawBoard()).observe(gameStage);
  window.addEventListener('resize', () => drawBoard());
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

phaserGame = new Phaser.Game({
  type: Phaser.AUTO,
  width: 640,
  height: 360,
  backgroundColor: '#dff3ff',
  parent: 'game-stage',
  scene: boardScene,
  callbacks: {
    postBoot: () => {
      document.documentElement.dataset.phaserReady = 'true';
      document.documentElement.dataset.phaserVersion = Phaser.VERSION;
      if (status) {
        status.textContent = presentationRoot === null
          ? presentationCopy('status.unavailable') : presentationCopy('game.ready');
      }
    },
  },
});
