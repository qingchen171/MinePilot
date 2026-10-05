import { PRODUCTION_LEVEL_CATALOG } from '../../core/level-catalog';
import type { ValidatedShopCatalog } from '../../core/shop';
import {
  executeDormantStage4Mutation,
  type DormantMutationIntent,
  type DormantMutationResult,
} from './dormant-stage4-mutation';
import { commitCandidateWithWriterLeaseV3 } from './guarded-persistence-v3';
import { loadProductionPersistedSave } from './persistence-coordinator';
import type { StringKeyValueStorage } from './key-value-storage';
import { acquireWriterLease, type Clock, type WriterIdentity } from './writer-lease';

/** The single production read surface: committed Stage 2 snapshot, then strict Stage 4 reconstruction. */
export function loadProductionStage4Runtime(storage: StringKeyValueStorage) {
  return loadProductionPersistedSave(storage);
}

/** The single production mutation surface. No candidate is returned on any failed commit. */
export function executeProductionStage4Mutation(
  storage: StringKeyValueStorage,
  identity: WriterIdentity,
  clock: Clock,
  intent: DormantMutationIntent,
  shopCatalog: ValidatedShopCatalog | null = null,
): DormantMutationResult {
  return executeDormantStage4Mutation(storage, intent, {
    commit(document, expectedRevision) {
      const result = commitCandidateWithWriterLeaseV3(
        storage, identity, clock, expectedRevision, document,
      );
      return result.status === 'committed'
        ? { status: 'committed' }
        : { status: 'rejected', reason: result.status };
    },
  }, PRODUCTION_LEVEL_CATALOG, shopCatalog);
}

/** Browser composition root: one published Runtime, replaced only after a committed v3 mutation. */
export function createProductionStage4Session(
  storage: StringKeyValueStorage,
  identity: WriterIdentity,
  clock: Clock,
  shopCatalog: ValidatedShopCatalog | null = null,
) {
  let authority = loadProductionStage4Runtime(storage);
  return {
    read: () => authority,
    reload() {
      authority = loadProductionStage4Runtime(storage);
      return authority;
    },
    execute(intent: DormantMutationIntent): DormantMutationResult {
      if (authority.status !== 'fresh' && authority.status !== 'loaded') {
        return { status: 'rejected', reason: authority.status };
      }
      // A disabled Shop never acquires writer authority or touches persistence metadata.
      if (intent.kind === 'purchase' && shopCatalog === null) {
        return { status: 'rejected', reason: 'invalid-request' };
      }
      const lease = acquireWriterLease(storage, identity, clock);
      if (lease.status !== 'acquired' && lease.status !== 'renewed') {
        return { status: 'rejected', reason: lease.status };
      }
      const result = executeProductionStage4Mutation(storage, identity, clock, intent, shopCatalog);
      if (result.status === 'committed') {
        // The candidate becomes visible only after the guarded snapshot commit succeeds.
        authority = {
          status: 'loaded',
          persistence: { kind: 'committed', revision: result.revision, source: 'head', sourceSaveVersion: 3 },
          runtime: result.runtime,
        };
      }
      return result;
    },
  };
}
