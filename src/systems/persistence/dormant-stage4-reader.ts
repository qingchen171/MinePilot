import { createInitialStage4GameState, type Stage4GameState } from '../../core/stage4-game-state';
import { loadSaveDocument } from '../../core/persistence/save-dispatcher';
import type { SaveV3ValidationIssue } from '../../core/persistence/save-v3';
import {
  reconstructStage4RuntimeFromTrustedMigration,
  reconstructStage4RuntimeFromValidatedV3,
} from '../../core/persistence/stage4-runtime-mapping';
import type { LoadCommittedSnapshotResult } from './crash-safe-snapshot-store';

export type DormantStage4LoadResult =
  | {
      readonly status: 'fresh';
      readonly persistence: { readonly kind: 'no-save' };
      readonly runtime: Stage4GameState;
    }
  | {
      readonly status: 'loaded';
      readonly persistence: {
        readonly kind: 'committed';
        readonly revision: number;
        readonly source: 'head' | 'head-backup';
        readonly sourceSaveVersion: 1 | 2 | 3;
      };
      readonly runtime: Stage4GameState;
    }
  | { readonly status: 'invalid-json' }
  | { readonly status: 'invalid-save'; readonly issues: readonly SaveV3ValidationIssue[] }
  | { readonly status: 'revision-mismatch' }
  | { readonly status: 'unavailable-snapshot'; readonly reason: 'corrupt' | 'storage-failure' };

/** Consumes only the snapshot already selected by Stage 2 authority. Never reads storage. */
export function readDormantStage4Runtime(
  selected: LoadCommittedSnapshotResult,
): DormantStage4LoadResult {
  if (selected.status === 'no-save') {
    return {
      status: 'fresh',
      persistence: { kind: 'no-save' },
      runtime: createInitialStage4GameState(),
    };
  }
  if (selected.status === 'corrupt' || selected.status === 'storage-failure') {
    return { status: 'unavailable-snapshot', reason: selected.status };
  }
  let input: unknown;
  try {
    input = JSON.parse(selected.serializedPayload);
  } catch {
    return { status: 'invalid-json' };
  }
  const dispatched = loadSaveDocument(input);
  if (dispatched.status !== 'loaded') {
    return { status: 'invalid-save', issues: 'issues' in dispatched
      ? dispatched.issues : [{ code: 'invalid-save-version', path: '$.saveVersion' }] };
  }
  const revision = dispatched.document.revision;
  const runtime = dispatched.sourceSaveVersion === 3
    ? reconstructStage4RuntimeFromValidatedV3(dispatched.validation)
    : reconstructStage4RuntimeFromTrustedMigration(dispatched.migration);
  if (revision !== selected.revision) return { status: 'revision-mismatch' };
  return {
    status: 'loaded',
    persistence: { kind: 'committed', revision: selected.revision, source: selected.source, sourceSaveVersion: dispatched.sourceSaveVersion },
    runtime,
  };
}
