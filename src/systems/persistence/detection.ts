import { createDetectionCandidate, type DetectionRejectionReason } from '../../core/detection';
import type { Coordinate } from '../../core/board';
import type { ActiveRunPersistenceInputV2 } from '../../core/persistence/save-v2';
import { commitCandidateWithWriterLease, type GuardedCommitResult } from './guarded-persistence';
import type { StringKeyValueStorage } from './key-value-storage';
import type { Clock, WriterIdentity } from './writer-lease';

export interface DetectionRequest {
  readonly currentAttempt: ActiveRunPersistenceInputV2;
  readonly currentRevision: number;
  readonly initializeSeed?: () => number;
}

export type UseDetectionResult =
  | (Extract<GuardedCommitResult, { status: 'committed' }> & { readonly target: Coordinate })
  | { readonly status: 'rejected'; readonly reason: DetectionRejectionReason }
  | { readonly status: 'commit-rejected'; readonly failure: Exclude<GuardedCommitResult, { status: 'committed' }> };

function initializeDetectionSeed(): number {
  // Independent entropy only for a missing Detection seed; never touches generation RNG.
  return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
}

export function useDetection(
  storage: StringKeyValueStorage,
  identity: WriterIdentity,
  clock: Clock,
  request: DetectionRequest,
): UseDetectionResult {
  const result = createDetectionCandidate(
    request.currentAttempt.gameState,
    request.initializeSeed ?? initializeDetectionSeed,
  );
  if (result.status === 'rejected') return result;
  const committed = commitCandidateWithWriterLease(storage, identity, clock, request.currentRevision, {
    revision: request.currentRevision + 1,
    activeRun: { ...request.currentAttempt, gameState: result.candidate },
  });
  // An uncommitted seed/target exists only in a discarded candidate. Old authority is untouched.
  return committed.status === 'committed'
    ? { ...committed, target: result.details.target }
    : { status: 'commit-rejected', failure: committed };
}
