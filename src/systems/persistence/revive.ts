import { createReviveCandidate, type ReviveRejectionReason } from '../../core/revive';
import type { ActiveRunPersistenceInputV2 } from '../../core/persistence/save-v2';
import { commitCandidateWithWriterLease, type GuardedCommitResult } from './guarded-persistence';
import type { StringKeyValueStorage } from './key-value-storage';
import type { Clock, WriterIdentity } from './writer-lease';

export interface ReviveRequest {
  readonly currentAttempt: ActiveRunPersistenceInputV2;
  readonly currentRevision: number;
}

export type UseReviveResult =
  | Extract<GuardedCommitResult, { status: 'committed' }>
  | { readonly status: 'rejected'; readonly reason: ReviveRejectionReason }
  | { readonly status: 'commit-rejected'; readonly failure: Exclude<GuardedCommitResult, { status: 'committed' }> };

export function useRevive(
  storage: StringKeyValueStorage,
  identity: WriterIdentity,
  clock: Clock,
  request: ReviveRequest,
): UseReviveResult {
  const result = createReviveCandidate(request.currentAttempt.gameState);
  if (result.status === 'rejected') return result;
  const committed = commitCandidateWithWriterLease(storage, identity, clock, request.currentRevision, {
    revision: request.currentRevision + 1,
    activeRun: { ...request.currentAttempt, gameState: result.candidate },
  });
  return committed.status === 'committed'
    ? committed
    : { status: 'commit-rejected', failure: committed };
}
