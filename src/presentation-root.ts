import { createPresentationAdapter } from './systems/presentation/adapter';
import { createShopControl } from './systems/presentation/shop-control';
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
void exactProjectionShape;
void compatibleCommandShape;

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
  shopCatalog: ValidatedShopCatalog | null = null) {
  const adapter = createPresentationAdapter(session, technical, shopCatalog);
  const shop = createShopControl(adapter);
  return Object.freeze({
    read: () => project(adapter.read()),
    reload: () => project(adapter.reload()),
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
      const result = adapter.retryRetained();
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
    shopReload: () => {
      const snapshot = adapter.reload();
      shop.afterReload(snapshot);
      return project(snapshot);
    },
    shopRetryRetained: () => {
      const result = adapter.retryRetained();
      shop.afterRetainedRetry(result);
      return result.status === 'committed'
        ? { status: 'committed' as const, snapshot: project(result.snapshot), copyKey: result.copyKey }
        : result;
    },
  });
}
