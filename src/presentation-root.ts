import { createPresentationAdapter } from './systems/presentation/adapter';
import { createShopControl } from './systems/presentation/shop-control';
import { PRODUCTION_LEVEL_CATALOG, type LevelCatalog } from './core/level-catalog';
import { createNavigationControl } from './systems/presentation/navigation-control';
import type { PublicLevelEntry } from './systems/presentation/level-list';
import { projectLevelListView, type LevelListProjectionInput } from './ui/level-list-projection';
import type { ValidatedShopCatalog } from './core/shop';
import type { DormantMutationIntent } from './systems/persistence/dormant-stage4-mutation';
import type { PresentationSessionPort, SemanticIntent, SessionIntent, TechnicalFactsSource } from './systems/presentation/session-port';
import type { SanitizedPublicFacts } from './systems/presentation/public-facts';
import { projectPublicFacts, type PresentationViewModel, type PublicProjectionInput } from './ui/presentation-projection';
import { projectEffectCue, type PublicEffectInput } from './ui/effect-cues';
import type { CommittedEffectHandoff } from './systems/presentation/effect-handoff';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false;
type Compatible<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
/** Both separately owned nested public contracts must remain structurally exact. */
const exactProjectionShape: Equal<SanitizedPublicFacts, PublicProjectionInput> = true;
const compatibleCommandShape: Compatible<SessionIntent, DormantMutationIntent> = true;
const exactLevelShape: Equal<PublicLevelEntry, LevelListProjectionInput> = true;
const exactEffectShape: Equal<CommittedEffectHandoff, PublicEffectInput> = true;
void exactProjectionShape;
void compatibleCommandShape;
void exactLevelShape;
void exactEffectShape;

function project(snapshot: ReturnType<ReturnType<typeof createPresentationAdapter>['read']>):
  | { readonly status: 'fresh' | 'loaded'; readonly view: PresentationViewModel }
  | { readonly status: 'recovery'; readonly reason: string } {
  return snapshot.status === 'recovery' ? snapshot : {
    status: snapshot.status,
    view: projectPublicFacts(snapshot.facts),
  };
}

/** Composition only: the trusted adapter sanitizes, then ui projects detached public facts. */
export function createPresentationRoot(session: PresentationSessionPort, technical: TechnicalFactsSource,
  shopCatalog: ValidatedShopCatalog | null = null, catalog: LevelCatalog = PRODUCTION_LEVEL_CATALOG) {
  const adapter = createPresentationAdapter(session, technical, shopCatalog, catalog);
  const shop = createShopControl(adapter);
  let gameRetainedToken: ReturnType<typeof adapter.retainedToken> = null;
  let shopTutorialRetainedToken: ReturnType<typeof adapter.retainedToken> = null;
  let shopTutorialReloadRequired = false;
  let authorityDirty = false;
  const unavailableDirty = () => ({ status: 'unavailable' as const, reason: 'reload-required' as const,
    copyKey: 'error.recovery' as const });
  const projectCommitted = (result: Extract<ReturnType<typeof adapter.submit>, { readonly status: 'committed' }>) => ({
    status: 'committed' as const, snapshot: project(result.snapshot), copyKey: result.copyKey,
    rewardReceipt: result.rewardReceipt, firstLucky: result.firstLucky, effectHandoff: result.effectHandoff,
  });
  const gameKinds = new Set<SessionIntent['kind']>(['move', 'flag', 'detection', 'airplane', 'revive',
    'claim-benben', 'failure', 'retry', 'replay', 'next', 'dismiss', 'restart', 'acknowledge-tutorial']);
  const clearGameRetry = () => {
    if (gameRetainedToken !== null) adapter.cancelRetainedToken(gameRetainedToken);
    gameRetainedToken = null;
  };
  const clearShopTutorialRetry = () => {
    if (shopTutorialRetainedToken !== null) adapter.cancelRetainedToken(shopTutorialRetainedToken);
    shopTutorialRetainedToken = null;
    shopTutorialReloadRequired = false;
  };
  let beforeReload: (() => void) | null = null;
  const navigation = createNavigationControl(adapter, catalog, () => {
    clearShopTutorialRetry();
    adapter.cancelRetainedKind('purchase');
    shop.afterExit();
  });
  const reloadAndReconcile = () => {
    clearGameRetry();
    clearShopTutorialRetry();
    beforeReload?.();
    const snapshot = adapter.reload();
    authorityDirty = snapshot.status === 'recovery';
    navigation.reconcileReloaded(snapshot);
    shop.afterReload(snapshot);
    return project(snapshot);
  };
  return Object.freeze({
    markAuthorityDirty: () => { authorityDirty = true; },
    authorityIsDirty: () => authorityDirty,
    takeEffect: (outcome: { readonly status: string; readonly effectHandoff?: CommittedEffectHandoff }) => {
      const handoff = outcome.status === 'committed' ? outcome.effectHandoff : undefined;
      if (handoff === undefined || !adapter.consumeEffectHandoff(handoff)) return null;
      return projectEffectCue(handoff);
    },
    /** One bootstrap-owned board invalidation hook; not a gameplay event bus. */
    onAuthorityReload(callback: () => void) { beforeReload = callback; },
    navigation: Object.freeze({
      route: navigation.route,
      pendingSelection: () => {
        const pending = navigation.pendingSelection();
        return pending === null ? null : Object.freeze({ target: pending.target, phase: pending.phase });
      },
      navigate: (next: Parameters<typeof navigation.navigate>[0]) => {
        if (authorityDirty && (next === 'shop' || next === 'game')) {
          const current = adapter.read();
          return current.status === 'recovery'
            ? { status: 'recovery' as const, reason: current.reason }
            : { status: 'blocked' as const, reason: 'authority-changed' };
        }
        const result = navigation.navigate(next);
        if (navigation.route() !== 'game') clearGameRetry();
        return result;
      },
      levels: () => {
        const entries = navigation.levelList();
        return entries === null ? null : projectLevelListView(entries);
      },
      selectLevel: (target: string) => authorityDirty
        ? { status: 'blocked' as const, reason: 'authority-changed' } : navigation.selectLevel(target),
      confirmReplacement: () => authorityDirty
        ? { status: 'blocked' as const, reason: 'authority-changed' } : navigation.confirmReplacement(),
      cancelSelection: navigation.cancelSelection,
      retryReplacement: () => {
        const result = navigation.retryReplacement();
        if (result.status === 'committed') authorityDirty = false;
        return result;
      },
      leaveAttemptForShop: () => authorityDirty
        ? { status: 'blocked' as const, reason: 'authority-changed' } : navigation.leaveAttemptForShop(),
    }),
    read: () => project(adapter.read()),
    reload: reloadAndReconcile,
    submit: (choice: Exclude<SemanticIntent, { readonly kind: 'purchase' }>) => {
      if (authorityDirty) return unavailableDirty();
      const result = adapter.submit(choice);
      const shopTutorial = choice.kind === 'acknowledge-tutorial' && navigation.route() === 'shop';
      if (shopTutorial) {
        shopTutorialRetainedToken = result.status === 'rejected' && result.policy.retainEnvelope
          ? adapter.retainedToken() : null;
        shopTutorialReloadRequired = result.status === 'rejected'
          ? result.policy.reloadRequired && !result.policy.retainEnvelope
          : result.status === 'unavailable' && result.reason === 'reload-required';
      } else if (gameKinds.has(choice.kind) &&
          !(result.status === 'unavailable' && result.reason === 'operation-unresolved')) {
        gameRetainedToken = result.status === 'rejected' && result.policy.retainEnvelope
          ? adapter.retainedToken() : null;
      }
      return result.status === 'committed'
        ? projectCommitted(result)
        : result.status === 'rejected' &&
          (result.reason === 'settings-unchanged' || result.reason === 'tutorial-already-acknowledged')
          ? { ...result, snapshot: project(adapter.read()) }
        : result;
    },
    retryRetained: () => {
      const retained = adapter.retainedKind();
      const result = adapter.retryRetained();
      if (result.status === 'committed') authorityDirty = false;
      gameRetainedToken = null;
      if (retained === 'purchase') shop.afterRetainedRetry(result);
      navigation.reconcileReloaded(adapter.read());
      return result.status === 'committed'
        ? projectCommitted(result)
        : result;
    },
    gameRetryAvailable: () => gameRetainedToken !== null && adapter.retainedToken() === gameRetainedToken,
    gameRetry: () => {
      if (gameRetainedToken === null || adapter.retainedToken() !== gameRetainedToken) return null;
      const result = adapter.retryRetained();
      if (result.status === 'committed') authorityDirty = false;
      gameRetainedToken = result.status === 'rejected' && result.policy.retainEnvelope
        ? adapter.retainedToken() : null;
      return result.status === 'committed'
        ? projectCommitted(result) : result;
    },
    gameExit: clearGameRetry,
    shopTutorialRetryAvailable: () => shopTutorialRetainedToken !== null &&
      adapter.retainedToken() === shopTutorialRetainedToken,
    shopTutorialNeedsReload: () => shopTutorialReloadRequired,
    shopTutorialRetry: () => {
      if (shopTutorialRetainedToken === null || adapter.retainedToken() !== shopTutorialRetainedToken) return null;
      const result = adapter.retryRetained();
      if (result.status === 'committed') authorityDirty = false;
      shopTutorialRetainedToken = result.status === 'rejected' && result.policy.retainEnvelope
        ? adapter.retainedToken() : null;
      shopTutorialReloadRequired = result.status === 'rejected'
        ? result.policy.reloadRequired && !result.policy.retainEnvelope
        : result.status === 'unavailable' && result.reason === 'reload-required';
      navigation.reconcileReloaded(adapter.read());
      return result.status === 'committed'
        ? projectCommitted(result) : result;
    },
    cancelRetained: () => adapter.cancelRetained(),
    shopState: () => shop.state(),
    shopLast: () => shop.last(),
    shopCanRearm: () => shop.canRearm(),
    shopActions: () => shop.actions(),
    shopPurchase: (item: Parameters<typeof shop.purchase>[0]) => {
      if (authorityDirty) return unavailableDirty();
      const result = shop.purchase(item);
      return result?.status === 'committed'
        ? projectCommitted(result)
        : result;
    },
    shopBuyAgain: () => shop.buyAgain(),
    shopReload: reloadAndReconcile,
    shopRetryRetained: () => {
      const result = adapter.retryRetained();
      if (result.status === 'committed') authorityDirty = false;
      shop.afterRetainedRetry(result);
      navigation.reconcileReloaded(adapter.read());
      return result.status === 'committed'
        ? projectCommitted(result)
        : result;
    },
  });
}
