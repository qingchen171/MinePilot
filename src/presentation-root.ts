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

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false;
type Compatible<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
/** Both separately owned nested public contracts must remain structurally exact. */
const exactProjectionShape: Equal<SanitizedPublicFacts, PublicProjectionInput> = true;
const compatibleCommandShape: Compatible<SessionIntent, DormantMutationIntent> = true;
const exactLevelShape: Equal<PublicLevelEntry, LevelListProjectionInput> = true;
void exactProjectionShape;
void compatibleCommandShape;
void exactLevelShape;

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
  const adapter = createPresentationAdapter(session, technical, shopCatalog);
  const shop = createShopControl(adapter);
  let beforeReload: (() => void) | null = null;
  const navigation = createNavigationControl(adapter, catalog, () => {
    adapter.cancelRetainedKind('purchase');
    shop.afterExit();
  });
  const reloadAndReconcile = () => {
    beforeReload?.();
    const snapshot = adapter.reload();
    navigation.reconcileReloaded(snapshot);
    shop.afterReload(snapshot);
    return project(snapshot);
  };
  return Object.freeze({
    /** One bootstrap-owned board invalidation hook; not a gameplay event bus. */
    onAuthorityReload(callback: () => void) { beforeReload = callback; },
    navigation: Object.freeze({
      route: navigation.route,
      pendingSelection: () => {
        const pending = navigation.pendingSelection();
        return pending === null ? null : Object.freeze({ target: pending.target, phase: pending.phase });
      },
      navigate: navigation.navigate,
      levels: () => {
        const entries = navigation.levelList();
        return entries === null ? null : projectLevelListView(entries);
      },
      selectLevel: navigation.selectLevel,
      confirmReplacement: navigation.confirmReplacement,
      cancelSelection: navigation.cancelSelection,
      retryReplacement: navigation.retryReplacement,
      leaveAttemptForShop: navigation.leaveAttemptForShop,
    }),
    read: () => project(adapter.read()),
    reload: reloadAndReconcile,
    submit: (choice: Exclude<SemanticIntent, { readonly kind: 'purchase' }>) => {
      const result = adapter.submit(choice);
      return result.status === 'committed'
        ? { status: 'committed' as const, snapshot: project(result.snapshot), copyKey: result.copyKey }
        : result.status === 'rejected' &&
          (result.reason === 'settings-unchanged' || result.reason === 'tutorial-already-acknowledged')
          ? { ...result, snapshot: project(adapter.read()) }
        : result;
    },
    retryRetained: () => {
      const retained = adapter.retainedKind();
      const result = adapter.retryRetained();
      if (retained === 'purchase') shop.afterRetainedRetry(result);
      navigation.reconcileReloaded(adapter.read());
      return result.status === 'committed'
        ? { status: 'committed' as const, snapshot: project(result.snapshot), copyKey: result.copyKey }
        : result;
    },
    cancelRetained: () => adapter.cancelRetained(),
    shopState: () => shop.state(),
    shopLast: () => shop.last(),
    shopCanRearm: () => shop.canRearm(),
    shopActions: () => shop.actions(),
    shopPurchase: (item: Parameters<typeof shop.purchase>[0]) => {
      const result = shop.purchase(item);
      return result?.status === 'committed'
        ? { status: 'committed' as const, snapshot: project(result.snapshot), copyKey: result.copyKey }
        : result;
    },
    shopBuyAgain: () => shop.buyAgain(),
    shopReload: reloadAndReconcile,
    shopRetryRetained: () => {
      const result = adapter.retryRetained();
      shop.afterRetainedRetry(result);
      navigation.reconcileReloaded(adapter.read());
      return result.status === 'committed'
        ? { status: 'committed' as const, snapshot: project(result.snapshot), copyKey: result.copyKey }
        : result;
    },
  });
}
