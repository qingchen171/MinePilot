import { createInitialStage4GameState, type Stage4GameState } from '../../core/stage4-game-state';
import {
  migrateOldSaveDocumentToV3,
  validateSaveDocumentV3,
  type SaveV3ValidationIssue,
} from '../../core/persistence/save-v3';
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
      };
      readonly runtime: Stage4GameState;
    }
  | { readonly status: 'invalid-json' }
  | { readonly status: 'invalid-save'; readonly issues: readonly SaveV3ValidationIssue[] }
  | { readonly status: 'revision-mismatch' }
  | { readonly status: 'unavailable-snapshot'; readonly reason: 'corrupt' | 'storage-failure' };

function versionOf(value: unknown): unknown {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>).saveVersion
    : undefined;
}

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
  const version = versionOf(input);
  let runtime: Stage4GameState;
  let revision: number;
  if (version === 3) {
    const validated = validateSaveDocumentV3(input);
    if (validated.status === 'invalid') return { status: 'invalid-save', issues: validated.issues };
    revision = validated.document.revision;
    runtime = reconstructStage4RuntimeFromValidatedV3(validated);
  } else {
    const migrated = migrateOldSaveDocumentToV3(input);
    if (migrated.status === 'invalid') return { status: 'invalid-save', issues: migrated.issues };
    revision = migrated.document.revision;
    runtime = reconstructStage4RuntimeFromTrustedMigration(migrated);
  }
  if (revision !== selected.revision) return { status: 'revision-mismatch' };
  return {
    status: 'loaded',
    persistence: { kind: 'committed', revision: selected.revision, source: selected.source },
    runtime,
  };
}
