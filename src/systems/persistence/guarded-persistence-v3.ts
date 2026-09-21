import type { SaveDocumentV3 } from '../../core/persistence/save-v3';
import type { StringKeyValueStorage } from './key-value-storage';
import {
  commitCandidateSaveV3,
  loadProductionPersistedSave,
  type CommitCandidateSaveV3Result,
} from './persistence-coordinator';
import { checkWriterOwnership, type OwnershipFailure } from './writer-ownership';
import type { Clock, WriterIdentity } from './writer-lease';

export type GuardedCommitV3Result =
  | { readonly status: 'committed'; readonly revision: number; readonly slot: 'A' | 'B';
      readonly backupUpdate: 'updated' | 'failed';
      readonly backupFailure?: Extract<CommitCandidateSaveV3Result, { readonly status: 'committed' }>['backupFailure'];
      readonly previousAuthority: 'no-save' | 'head' | 'head-backup' }
  | OwnershipFailure
  | { readonly status: 'revision-conflict'; readonly expectedRevision: number | null; readonly actualRevision: number | null }
  | { readonly status: 'invalid-next-revision'; readonly candidateRevision: number; readonly requiredRevision: number }
  | { readonly status: 'persistence-load-failure'; readonly reason: string }
  | { readonly status: 'commit-outcome-uncertain'; readonly observedRevision: number | null }
  | { readonly status: 'persistence-commit-failure'; readonly failure: Exclude<CommitCandidateSaveV3Result, { readonly status: 'committed' }> };

/** Stage 2 lease/revision protocol with the sole active v3 read/write path. */
export function commitCandidateWithWriterLeaseV3(
  storage: StringKeyValueStorage,
  identity: WriterIdentity,
  clock: Clock,
  expectedRevision: number | null,
  candidate: SaveDocumentV3,
): GuardedCommitV3Result {
  const firstOwnership = checkWriterOwnership(storage, identity, clock);
  if (firstOwnership !== undefined) return firstOwnership;
  const current = loadProductionPersistedSave(storage);
  if (current.status !== 'fresh' && current.status !== 'loaded') {
    return { status: 'persistence-load-failure', reason: current.status };
  }
  const actualRevision = current.status === 'fresh' ? null : current.persistence.revision;
  if ((expectedRevision !== null && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)) ||
      expectedRevision !== actualRevision) {
    return { status: 'revision-conflict', expectedRevision, actualRevision };
  }
  const requiredRevision = actualRevision === null ? 0 : actualRevision + 1;
  if (!Number.isSafeInteger(requiredRevision) || candidate.revision !== requiredRevision) {
    return { status: 'invalid-next-revision', candidateRevision: candidate.revision, requiredRevision };
  }
  const secondOwnership = checkWriterOwnership(storage, identity, clock);
  if (secondOwnership !== undefined) return secondOwnership;
  const committed = commitCandidateSaveV3(storage, candidate);
  if (committed.status !== 'committed') {
    if (committed.status === 'persistence-failure' && committed.failure.status === 'storage-failure' &&
        committed.failure.stage === 'new-head-write') {
      // A storage adapter can report failure after the head write. Never claim rollback.
      const observed = loadProductionPersistedSave(storage);
      return { status: 'commit-outcome-uncertain', observedRevision: observed.status === 'loaded'
        ? observed.persistence.revision : null };
    }
    return { status: 'persistence-commit-failure', failure: committed };
  }
  return { status: 'committed', revision: committed.revision, slot: committed.slot,
    backupUpdate: committed.backupUpdate,
    ...(committed.backupFailure === undefined ? {} : { backupFailure: committed.backupFailure }),
    previousAuthority: current.status === 'fresh' ? 'no-save' : current.persistence.source };
}
