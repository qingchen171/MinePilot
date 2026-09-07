import { type SaveDocumentPersistenceInputV2 } from '../../core/persistence/save-v2';
import { type StringKeyValueStorage } from './key-value-storage';
import {
  commitCandidateSaveV2,
  loadPersistedSave,
  type CommitCandidateSaveV2Result,
  type LoadPersistedSaveResult,
} from './persistence-coordinator';
import {
  inspectWriterLease,
  type Clock,
  type WriterIdentity,
} from './writer-lease';

type SuccessfulLoad = Extract<
  LoadPersistedSaveResult,
  { readonly save: unknown }
>;

type LoadFailure = Exclude<
  LoadPersistedSaveResult,
  SuccessfulLoad | { readonly status: 'no-save' }
>;

type CommitFailure = Exclude<
  CommitCandidateSaveV2Result,
  { readonly status: 'committed' }
>;

export type GuardedCommitResult =
  | {
      readonly status: 'committed';
      readonly candidate: SaveDocumentPersistenceInputV2;
      readonly revision: number;
      readonly slot: 'A' | 'B';
      readonly backupUpdate: 'updated' | 'failed';
      readonly previousAuthority: 'no-save' | 'head' | 'head-backup';
      readonly backupFailure?: Extract<
        CommitCandidateSaveV2Result,
        { readonly status: 'committed' }
      >['backupFailure'];
    }
  | {
      readonly status: 'writer-not-owner';
      readonly reason: 'no-lease' | 'different-owner' | 'invalid-lease';
    }
  | { readonly status: 'lease-expired' }
  | { readonly status: 'lease-storage-failure'; readonly failure: unknown }
  | { readonly status: 'persistence-load-failure'; readonly failure: LoadFailure }
  | {
      readonly status: 'revision-conflict';
      readonly expectedRevision: number | null;
      readonly actualRevision: number | null;
    }
  | {
      readonly status: 'invalid-next-revision';
      readonly candidateRevision: number;
      readonly requiredRevision: number;
    }
  | { readonly status: 'persistence-commit-failure'; readonly failure: CommitFailure };

function checkOwnership(
  storage: StringKeyValueStorage,
  identity: WriterIdentity,
  clock: Clock,
): Exclude<GuardedCommitResult, { readonly status: 'committed' }> | undefined {
  const lease = inspectWriterLease(storage, clock);
  if (lease.status === 'storage-failure') {
    return { status: 'lease-storage-failure', failure: lease.failure };
  }
  if (lease.status === 'no-lease') {
    return { status: 'writer-not-owner', reason: 'no-lease' };
  }
  if (lease.status === 'invalid-lease') {
    return { status: 'writer-not-owner', reason: 'invalid-lease' };
  }
  if (lease.status === 'expired') return { status: 'lease-expired' };
  if (
    lease.lease.sessionId !== identity.sessionId ||
    lease.lease.leaseToken !== identity.leaseToken
  ) {
    return { status: 'writer-not-owner', reason: 'different-owner' };
  }
  return undefined;
}

function isExpectedRevision(value: number | null): boolean {
  return value === null || (Number.isSafeInteger(value) && value >= 0);
}

export function commitCandidateWithWriterLease(
  storage: StringKeyValueStorage,
  identity: WriterIdentity,
  clock: Clock,
  expectedRevision: number | null,
  candidate: SaveDocumentPersistenceInputV2,
): GuardedCommitResult {
  const firstOwnership = checkOwnership(storage, identity, clock);
  if (firstOwnership !== undefined) return firstOwnership;

  const current = loadPersistedSave(storage);
  let actualRevision: number | null;
  let previousAuthority: 'no-save' | 'head' | 'head-backup';
  if ('save' in current) {
    actualRevision = current.revision;
    previousAuthority = current.source;
  } else if (current.status === 'no-save') {
    actualRevision = null;
    previousAuthority = 'no-save';
  } else {
    return { status: 'persistence-load-failure', failure: current };
  }
  if (!isExpectedRevision(expectedRevision) || expectedRevision !== actualRevision) {
    return { status: 'revision-conflict', expectedRevision, actualRevision };
  }
  const requiredRevision = actualRevision === null ? 0 : actualRevision + 1;
  if (!Number.isSafeInteger(requiredRevision) || candidate.revision !== requiredRevision) {
    return {
      status: 'invalid-next-revision',
      candidateRevision: candidate.revision,
      requiredRevision,
    };
  }

  const secondOwnership = checkOwnership(storage, identity, clock);
  if (secondOwnership !== undefined) return secondOwnership;

  const committed = commitCandidateSaveV2(storage, candidate);
  if (committed.status !== 'committed') {
    return { status: 'persistence-commit-failure', failure: committed };
  }
  return {
    status: 'committed',
    candidate: committed.candidate,
    revision: committed.revision,
    slot: committed.slot,
    backupUpdate: committed.backupUpdate,
    previousAuthority,
    ...(committed.backupFailure === undefined
      ? {}
      : { backupFailure: committed.backupFailure }),
  };
}
