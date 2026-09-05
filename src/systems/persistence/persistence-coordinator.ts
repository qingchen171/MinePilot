import {
  loadSaveDocument,
  type LoadSaveDocumentResult,
} from '../../core/persistence/save-dispatcher';
import {
  serializeSaveDocumentV1,
  type SaveDocumentPersistenceInputV1,
  type SaveV1ValidationIssue,
} from '../../core/persistence/save-v1';
import {
  commitSnapshot,
  loadCommittedSnapshot,
  type CommitSnapshotResult,
  type LoadCommittedSnapshotResult,
  type SnapshotSlot,
} from './crash-safe-snapshot-store';
import { type StringKeyValueStorage } from './key-value-storage';

export type CandidateSaveV1 = SaveDocumentPersistenceInputV1;

type CommitFailure = Exclude<CommitSnapshotResult, { readonly status: 'committed' }>;

export type CommitCandidateSaveV1Result =
  | {
      readonly status: 'committed';
      readonly candidate: CandidateSaveV1;
      readonly slot: SnapshotSlot;
      readonly revision: number;
      readonly backupUpdate: 'updated' | 'failed';
      readonly backupFailure?: Extract<
        CommitSnapshotResult,
        { readonly status: 'committed' }
      >['backupFailure'];
    }
  | {
      readonly status: 'serialization-failure';
      readonly stage: 'save-document';
      readonly issues?: readonly SaveV1ValidationIssue[];
      readonly cause?: unknown;
    }
  | {
      readonly status: 'serialization-failure';
      readonly stage: 'json';
      readonly cause: unknown;
    }
  | { readonly status: 'persistence-failure'; readonly failure: CommitFailure };

type SnapshotSource = {
  readonly source: 'head' | 'head-backup';
  readonly slot: SnapshotSlot;
  readonly revision: number;
};

type VersionLoadFailure = Exclude<LoadSaveDocumentResult, { readonly status: 'loaded' }>;

export type LoadPersistedSaveResult =
  | { readonly status: 'no-save' }
  | Extract<LoadCommittedSnapshotResult, { readonly status: 'storage-failure' | 'corrupt' }>
  | (SnapshotSource & { readonly status: 'malformed-json'; readonly cause: unknown })
  | (SnapshotSource & VersionLoadFailure)
  | (SnapshotSource & {
      readonly status: 'revision-mismatch';
      readonly documentRevision: number;
    })
  | (SnapshotSource & {
      readonly status: 'loaded' | 'recovered-from-backup';
      readonly save: Extract<LoadSaveDocumentResult, { readonly status: 'loaded' }>;
    });

export function commitCandidateSaveV1(
  storage: StringKeyValueStorage,
  candidate: CandidateSaveV1,
): CommitCandidateSaveV1Result {
  let serializedDocument: ReturnType<typeof serializeSaveDocumentV1>;
  try {
    serializedDocument = serializeSaveDocumentV1(candidate);
  } catch (cause) {
    return { status: 'serialization-failure', stage: 'save-document', cause };
  }
  if (serializedDocument.status === 'invalid') {
    return {
      status: 'serialization-failure',
      stage: 'save-document',
      issues: serializedDocument.issues,
    };
  }

  let serializedPayload: string;
  try {
    serializedPayload = JSON.stringify(serializedDocument.document);
  } catch (cause) {
    return { status: 'serialization-failure', stage: 'json', cause };
  }

  const committed = commitSnapshot(storage, serializedPayload, candidate.revision);
  if (committed.status !== 'committed') {
    return { status: 'persistence-failure', failure: committed };
  }
  return {
    status: 'committed',
    candidate,
    slot: committed.slot,
    revision: committed.revision,
    backupUpdate: committed.backupUpdate,
    ...(committed.backupFailure === undefined
      ? {}
      : { backupFailure: committed.backupFailure }),
  };
}

export function loadPersistedSave(storage: StringKeyValueStorage): LoadPersistedSaveResult {
  const snapshot = loadCommittedSnapshot(storage);
  if (
    snapshot.status === 'no-save' ||
    snapshot.status === 'storage-failure' ||
    snapshot.status === 'corrupt'
  ) {
    return snapshot;
  }

  const source: SnapshotSource = {
    source: snapshot.source,
    slot: snapshot.slot,
    revision: snapshot.revision,
  };
  let parsed: unknown;
  try {
    parsed = JSON.parse(snapshot.serializedPayload);
  } catch (cause) {
    return { status: 'malformed-json', ...source, cause };
  }

  const loaded = loadSaveDocument(parsed);
  if (loaded.status !== 'loaded') return { ...source, ...loaded };
  if (loaded.document.revision !== snapshot.revision) {
    return {
      status: 'revision-mismatch',
      ...source,
      documentRevision: loaded.document.revision,
    };
  }
  return {
    status: snapshot.status,
    ...source,
    save: loaded,
  };
}
