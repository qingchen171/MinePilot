import Phaser from 'phaser';
import { presentationCopy } from './config/presentation-copy';
import { SHOP_PRICES } from './config/shop-prices';
import { validateShopCatalog } from './core/shop';
import { createPresentationRoot } from './presentation-root';
import { BoardScene } from './scenes/board-scene';
import { decorativeBoardLayout, desktopBoardFrame } from './ui/desktop-board-layout';
import { createEffectEpoch } from './ui/effect-epoch';
import { createPageAudio, createBrowserSoundFactory } from './audio/page-audio';
import { createBoardPresentation } from './ui/board-presentation';
import { semanticCopy } from './ui/semantic-copy';
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
const effectEpoch = createEffectEpoch();
const audio = createPageAudio(createBrowserSoundFactory());
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
  let lastRoute: PublicPage | null = null;
  const invalidateEffects = () => { effectEpoch.invalidate(); boardScene.cancelEffect(); };
  const announce = (key: PresentationCopyKey) => { if (status) status.textContent = presentationCopy(key); };
  const afterCommittedPresentation = (outcome: { readonly status: string; readonly copyKey: PresentationCopyKey;
    readonly effectHandoff?: Parameters<typeof presentationRoot.takeEffect>[0]['effectHandoff'];
    readonly rewardReceipt?: RewardReceiptProof },
    snapshot: ReturnType<typeof presentationRoot.read> | null, message: PresentationCopyKey) => {
    invalidateEffects();
    draw(message, snapshot);
    if (snapshot?.status !== 'recovery') {
      audio.setAuthorityClean(!presentationRoot.authorityIsDirty());
      audio.setRecovery(false);
      if (snapshot) audio.adoptSettings(snapshot.view.settings);
    }
    const cue = presentationRoot.takeEffect(outcome);
    if (status) {
      if (cue?.kind === 'reward') status.textContent = semanticCopy(cue.rewardCount === 1
        ? 'status.reward-single' : 'status.reward-plural', { count: cue.rewardCount });
      else if (outcome.rewardReceipt?.status === 'insufficient-proof')
        status.textContent = presentationCopy('game.rewards.diagnostic');
      else {
        const cueKeys = { move: 'status.effect.move', flag: 'status.effect.flag',
          detection: 'status.effect.detection', airplane: 'status.effect.airplane',
          revive: 'status.effect.revive', lucky: 'game.lucky.saved', benben: 'game.benben.used',
          pending: 'game.phase.pending-mine-encounter', failure: 'game.phase.failed',
          victory: 'game.phase.won', item: 'status.committed', saved: message } as const;
        status.textContent = presentationCopy(cue === null ? message : cueKeys[cue.kind]);
      }
    }
    if (cue === null || presentationRoot.authorityIsDirty()) return;
    const epoch = effectEpoch.current();
    if (presentationRoot.navigation.route() === 'game' &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      boardScene.playEffect(cue, epoch, effectEpoch.valid);
    audio.playCue(cue.kind);
  };
  const afterNavigation = (result: { readonly status: string; readonly reason?: string;
    readonly priorCommit?: boolean; readonly outcome?: { readonly status: string;
      readonly copyKey: PresentationCopyKey;
      readonly effectHandoff?: Parameters<typeof presentationRoot.takeEffect>[0]['effectHandoff'] } }) => {
    const message = resultMessage(result);
    if (result.status === 'committed' && result.outcome && message) {
      afterCommittedPresentation(result.outcome, null, message);
    } else { invalidateEffects(); draw(message); if (message) announce(message); }
  };
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
      if (action === 'reload') { invalidateEffects(); const snapshot = presentationRoot.reload();
        gameReloadRequired = false; audio.setAuthorityClean(snapshot.status !== 'recovery');
        audio.setRecovery(snapshot.status === 'recovery');
        if (snapshot.status !== 'recovery') audio.adoptSettings(snapshot.view.settings);
        draw(); return; }
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
    invalidateEffects();
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
      gameReloadRequired, visibleMilestone, presentationRoot.authorityIsDirty());
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
    if (outcome.status === 'committed')
      afterCommittedPresentation(outcome, outcome.snapshot, outcome.copyKey);
    else { invalidateEffects(); draw(outcome.copyKey); announce(outcome.copyKey); }
  };
  const drawBoard = (current = presentationRoot.read()) => {
    const route = presentationRoot.navigation.route();
    const attempt = current.status === 'recovery' || route !== 'game' ? null : current.view.attempt;
    const frame = desktopBoardFrame(gamePanel.parentElement?.clientWidth ?? document.documentElement.clientWidth);
    document.documentElement.style.setProperty('--board-center', `${frame.left+frame.side/2}px`);
    gameStage.style.width = `${frame.side + 2*frame.lateral}px`;
    gameStage.style.height = `${frame.side + frame.gutter}px`;
    gameStage.style.left = `${frame.left-frame.lateral}px`;
    gameStage.style.top = `${frame.top}px`;
    gameControls.style.left = `${frame.railLeft}px`;
    gameControls.style.top = `${frame.railTop}px`;
    gameControls.style.width = `${frame.railWidth}px`;
    gameControls.style.maxHeight = `${frame.railHeight}px`;
    gamePanel.style.minHeight = `${Math.max(frame.top + frame.gutter + frame.side,
      frame.railTop+frame.railHeight)+20}px`;
    const layout = attempt === null ? null : decorativeBoardLayout(frame.side,
      attempt.board.width, attempt.board.height);
    if (layout !== null) phaserGame?.scale.resize(layout.width, layout.height);
    board.render(attempt, current.status === 'recovery' ? { kind: 'hidden', value: null } :
      current.view.currentNumberDisplay, layout, !gameReloadRequired && !presentationRoot.authorityIsDirty());
    boardScene.present(attempt, layout);
  };
  const draw = (message: PresentationCopyKey | null = null,
    committedSnapshot: ReturnType<typeof presentationRoot.read> | null = null) => {
    const current = committedSnapshot ?? presentationRoot.read();
    const route = presentationRoot.navigation.route() as PublicPage;
    document.documentElement.dataset.page = route;
    if (lastRoute !== null && route !== lastRoute) {
      invalidateEffects();
      if (message === null && status) status.textContent = presentationCopy('game.ready');
    }
    lastRoute = route;
    if (current.status === 'recovery') { invalidateEffects(); audio.setRecovery(true); }
    gamePanel.hidden = route !== 'game' || current.status === 'recovery';
    shopPanel.hidden = route !== 'shop' || current.status === 'recovery';
    renderNavigationPages(navigationPanel, pagePanel, route,
      current.status === 'recovery' ? null : current.view,
      presentationRoot.navigation.levels(), presentationRoot.navigation.pendingSelection(), {
        navigate(next) { afterNavigation(presentationRoot.navigation.navigate(next)); },
        selectLevel(id) { afterNavigation(presentationRoot.navigation.selectLevel(id)); },
        confirmReplacement() { afterNavigation(presentationRoot.navigation.confirmReplacement()); },
        cancelReplacement() { presentationRoot.navigation.cancelSelection(); invalidateEffects(); draw(); },
        retryReplacement() { afterNavigation(presentationRoot.navigation.retryReplacement()); },
        leaveForShop() { afterNavigation(presentationRoot.navigation.leaveAttemptForShop()); },
        setSetting(key, enabled) {
          const outcome = presentationRoot.submit({ kind: 'set-setting', key, enabled });
          if (outcome.status === 'committed') afterCommittedPresentation(outcome, outcome.snapshot, 'settings.saved');
          else { invalidateEffects(); draw(outcome.copyKey); announce(outcome.copyKey); }
        },
        reload() { invalidateEffects(); const snapshot = presentationRoot.reload();
          audio.setAuthorityClean(snapshot.status !== 'recovery'); audio.setRecovery(snapshot.status === 'recovery');
          if (snapshot.status !== 'recovery') audio.adoptSettings(snapshot.view.settings);
          draw(); },
      }, message);
    if (route === 'shop' && current.status !== 'recovery') {
      const tutorialBlocked = presentationRoot.shopTutorialRetryAvailable() ||
        presentationRoot.shopTutorialNeedsReload();
      const shopDirty = presentationRoot.authorityIsDirty();
      renderShopPanel(shopPanel, current.view, shopDirty ? 'receipt-disarmed' :
        tutorialBlocked ? 'submitting' : presentationRoot.shopState(), {
        purchase(item) {
          const outcome = presentationRoot.shopPurchase(item);
          if (outcome?.status === 'committed') afterCommittedPresentation(outcome, outcome.snapshot, 'shop.receipt');
          else if (outcome) { invalidateEffects(); draw(outcome.copyKey); announce(outcome.copyKey); }
        },
        buyAgain() { if (presentationRoot.shopBuyAgain()) draw(); },
        retry() {
          const outcome = presentationRoot.shopRetryRetained();
          if (outcome.status === 'committed') afterCommittedPresentation(outcome, outcome.snapshot, 'shop.receipt');
          else { invalidateEffects(); draw(outcome.copyKey); announce(outcome.copyKey); }
        },
        reload() {
          invalidateEffects();
          const snapshot = presentationRoot.shopReload();
          audio.setAuthorityClean(snapshot.status !== 'recovery'); audio.setRecovery(snapshot.status === 'recovery');
          if (snapshot.status !== 'recovery') audio.adoptSettings(snapshot.view.settings);
          draw(snapshot.status === 'recovery' ? 'error.recovery' : null);
        },
      }, message, shopDirty && !presentationRoot.shopActions().retry
        ? { buyAgain: false, retry: false, reload: true } : presentationRoot.shopActions());
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
          if (reloadTutorial) { invalidateEffects(); const snapshot = presentationRoot.shopReload();
            audio.setAuthorityClean(snapshot.status !== 'recovery'); draw(); return; }
          const outcome = retryTutorial ? presentationRoot.shopTutorialRetry() :
            presentationRoot.submit({ kind: 'acknowledge-tutorial', milestoneId: 'first-shop' });
          if (outcome === null) return;
          if (outcome.status === 'committed') afterCommittedPresentation(outcome, outcome.snapshot, outcome.copyKey);
          else { invalidateEffects(); draw(outcome.copyKey); announce(outcome.copyKey); }
        });
        shopPanel.append(prompt, acknowledge);
      }
    } else if (route === 'shop' && current.status === 'recovery') {
      renderShopRecoveryPanel(shopPanel, () => { presentationRoot.shopReload(); draw(); });
    } else shopPanel.replaceChildren();
    drawBoard(current);
    if (route === 'game' && current.status !== 'recovery') {
      gamePresentation.render(current.view, visibleReceipt, presentationRoot.gameRetryAvailable(),
        gameReloadRequired, visibleMilestone, presentationRoot.authorityIsDirty());
      visibleMilestone = null;
    } else { gamePresentation.clear(); visibleReceipt = null; visibleMilestone = null; gameReloadRequired = false; }
  };
  draw();
  const first = presentationRoot.read();
  if (first.status !== 'recovery') audio.adoptSettings(first.view.settings);
  else audio.setRecovery(true);
  const invalidateLayout = () => { invalidateEffects(); drawBoard(); };
  const pageListeners = new AbortController();
  const resizeObserver = new ResizeObserver(invalidateLayout);
  resizeObserver.observe(gameStage);
  window.addEventListener('resize', invalidateLayout, { signal: pageListeners.signal });
  window.addEventListener('pointerdown', () => audio.gesture(), { capture: true, signal: pageListeners.signal });
  window.addEventListener('keydown', () => audio.gesture(), { capture: true, signal: pageListeners.signal });
  document.addEventListener('visibilitychange', () => audio.setVisible(!document.hidden), { signal: pageListeners.signal });
  const dirty = () => {
    presentationRoot.markAuthorityDirty(); invalidateEffects(); audio.setAuthorityClean(false);
    board.invalidateAuthority(); visibleReceipt = null; visibleMilestone = null;
    announce('nav.authority-changed'); draw();
  };
  window.addEventListener('storage', (event) => {
    if (event.key === null || event.key.startsWith('minepilot:persistence:')) dirty();
  }, { signal: pageListeners.signal });
  let lostWindowFocus = false;
  window.addEventListener('blur', () => { lostWindowFocus = true; }, { signal: pageListeners.signal });
  window.addEventListener('focus', () => { if (lostWindowFocus) { lostWindowFocus = false; dirty(); } },
    { signal: pageListeners.signal });
  window.addEventListener('pagehide', () => {
    invalidateEffects(); effectEpoch.dispose(); audio.dispose();
    resizeObserver.disconnect(); pageListeners.abort();
    // A BFCache restore must rebuild the disposed page rather than reuse its old session.
    window.addEventListener('pageshow', (event) => { if (event.persisted) window.location.reload(); },
      { once: true });
  }, { signal: pageListeners.signal });
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
  transparent: true,
  parent: 'game-stage',
  scene: boardScene,
  callbacks: {
    postBoot: () => {
      document.documentElement.dataset.phaserReady = 'true';
      document.documentElement.dataset.phaserVersion = Phaser.VERSION;
      if (status) {
        if (status.textContent === presentationCopy('status.loading')) status.textContent = presentationRoot === null
          ? presentationCopy('status.unavailable') : presentationCopy('game.ready');
      }
    },
  },
});
