import { createAirplaneCandidate, type AirplaneRejectionReason } from '../../core/airplane';
import type { Coordinate } from '../../core/board';
import type { ActiveRunPersistenceInputV2 } from '../../core/persistence/save-v2';
import { commitCandidateWithWriterLease, type GuardedCommitResult } from './guarded-persistence';
import type { StringKeyValueStorage } from './key-value-storage';
import type { Clock, WriterIdentity } from './writer-lease';

export interface AirplaneRequest {
  readonly currentAttempt: ActiveRunPersistenceInputV2;
  readonly currentRevision: number;
  readonly target: Coordinate;
}
export type UseAirplaneResult =
  | Extract<GuardedCommitResult, { status: 'committed' }>
  | { readonly status: 'rejected'; readonly reason: AirplaneRejectionReason }
  | { readonly status: 'commit-rejected'; readonly failure: Exclude<GuardedCommitResult, { status: 'committed' }> };

export function useAirplane(storage: StringKeyValueStorage, identity: WriterIdentity, clock: Clock, request: AirplaneRequest): UseAirplaneResult {
  const result = createAirplaneCandidate(request.currentAttempt.gameState, request.target);
  if (result.status === 'rejected') return result;
  const committed = commitCandidateWithWriterLease(storage, identity, clock, request.currentRevision, {
    revision: request.currentRevision + 1,
    activeRun: { ...request.currentAttempt, gameState: result.candidate },
  });
  return committed.status === 'committed' ? committed : { status: 'commit-rejected', failure: committed };
}
