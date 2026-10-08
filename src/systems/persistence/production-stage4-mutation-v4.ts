import { PRODUCTION_LEVEL_CATALOG, type LevelCatalog } from '../../core/level-catalog';
import { mapStage4RuntimeToSaveV4 } from '../../core/persistence/stage4-runtime-mapping-v4';
import type { SaveDocumentV4 } from '../../core/persistence/save-v4';
import type { ValidatedShopCatalog } from '../../core/shop';
import { composeStage4MutationCandidate, type DormantMutationIntent,
  type DormantMutationResult } from './dormant-stage4-mutation';
import type { StringKeyValueStorage } from './key-value-storage';
import { loadProductionPersistedSave } from './persistence-coordinator';

export interface V4CommitBoundary {
  commit(document: SaveDocumentV4, expectedRevision: number | null):
    | { readonly status: 'committed' }
    | { readonly status: 'rejected'; readonly reason: string };
}

/** The production reread/guard path; domain composition is shared with the historical regressions. */
export function executeStage4MutationV4(
  storage: StringKeyValueStorage,
  intent: DormantMutationIntent,
  commit: V4CommitBoundary,
  catalog: LevelCatalog = PRODUCTION_LEVEL_CATALOG,
  shopCatalog: ValidatedShopCatalog | null = null,
): DormantMutationResult {
  const loaded = loadProductionPersistedSave(storage);
  if (loaded.status !== 'fresh' && loaded.status !== 'loaded') return { status: 'rejected', reason: loaded.status };
  const actualRevision = loaded.status === 'fresh' ? null : loaded.persistence.revision;
  if (intent.expectedRevision !== actualRevision) return { status: 'rejected', reason: 'revision-conflict' };
  if (intent.expectedRunId !== loaded.runtime.currentAttempt?.runId &&
      !(intent.expectedRunId === null && loaded.runtime.currentAttempt === null)) {
    return { status: 'rejected', reason: 'run-id-conflict' };
  }
  let composed: ReturnType<typeof composeStage4MutationCandidate>;
  try { composed = composeStage4MutationCandidate(loaded.runtime, intent, catalog, shopCatalog); }
  catch { return { status: 'rejected', reason: 'invalid-candidate' }; }
  if (composed.status === 'rejected') return composed;
  const revision = actualRevision === null ? 0 : actualRevision + 1;
  if (!Number.isSafeInteger(revision)) return { status: 'rejected', reason: 'revision-overflow' };
  const mapped = mapStage4RuntimeToSaveV4(composed.runtime, revision);
  if (mapped.status !== 'mapped') return { status: 'rejected', reason: mapped.status };
  const result = commit.commit(mapped.document, actualRevision);
  return result.status === 'committed'
    ? { status: 'committed', runtime: composed.runtime, revision }
    : { status: 'rejected', reason: `commit-${result.reason}` };
}
