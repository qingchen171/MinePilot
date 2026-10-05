import { createPresentationAdapter } from './systems/presentation/adapter';
import type { DormantMutationIntent } from './systems/persistence/dormant-stage4-mutation';
import type { PresentationSessionPort, SessionIntent, TechnicalFactsSource } from './systems/presentation/session-port';
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
export function createPresentationRoot(session: PresentationSessionPort, technical: TechnicalFactsSource) {
  const adapter = createPresentationAdapter(session, technical);
  return Object.freeze({
    read: () => project(adapter.read()),
    reload: () => project(adapter.reload()),
    submit: (choice: Parameters<typeof adapter.submit>[0]) => {
      const result = adapter.submit(choice);
      return result.status === 'committed'
        ? { status: 'committed' as const, snapshot: project(result.snapshot), copyKey: result.copyKey }
        : result;
    },
    retryRetained: () => {
      const result = adapter.retryRetained();
      return result.status === 'committed'
        ? { status: 'committed' as const, snapshot: project(result.snapshot), copyKey: result.copyKey }
        : result;
    },
    cancelRetained: () => adapter.cancelRetained(),
  });
}
