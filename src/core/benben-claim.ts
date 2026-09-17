import { createBenbenLevelState, type BenbenLevelState } from './benben';
import { deriveBenbenCard } from './benben-random';
import type { RunPhase } from './run';
import { isStableId } from './stable-id';
import {
  createTemporaryBenbenCard,
  type TemporaryBenbenCard,
} from './temporary-benben-card';

export interface BenbenClaimInput {
  readonly attemptLevelId: unknown;
  readonly attemptRunId: unknown;
  readonly claimLevelId: unknown;
  readonly hasTakenStep: boolean;
  readonly phase: RunPhase;
  readonly benbenByLevel: readonly BenbenLevelState[];
  readonly temporaryBenbenCard: TemporaryBenbenCard | null;
}

export type BenbenClaimRejectionReason =
  | 'invalid-authority'
  | 'wrong-level'
  | 'no-matching-entitlement'
  | 'entitlement-unavailable'
  | 'entitlement-used'
  | 'card-already-exists'
  | 'step-already-taken'
  | 'pending-mine-encounter'
  | 'run-failed'
  | 'run-won'
  | 'invalid-card-derivation';

export type BenbenClaimResult =
  | {
      readonly status: 'claimed';
      readonly nextBenbenByLevel: readonly BenbenLevelState[];
      readonly temporaryBenbenCard: TemporaryBenbenCard;
    }
  | { readonly status: 'rejected'; readonly reason: BenbenClaimRejectionReason };

function copyBenbenRecords(input: readonly BenbenLevelState[]): readonly BenbenLevelState[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const copied: BenbenLevelState[] = [];
  const seen = new Set<string>();
  try {
    for (const entry of input) {
      const state = createBenbenLevelState(entry);
      if (seen.has(state.levelId)) return undefined;
      seen.add(state.levelId);
      copied.push(state);
    }
  } catch {
    return undefined;
  }
  return Object.freeze(copied);
}

/** Pure Claim transition. Production authority/provenance is composed later in S4-08. */
export function claimBenbenAssistance(input: BenbenClaimInput): BenbenClaimResult {
  if (
    !isStableId(input.attemptLevelId) ||
    !isStableId(input.attemptRunId) ||
    !isStableId(input.claimLevelId) ||
    typeof input.hasTakenStep !== 'boolean'
  ) return { status: 'rejected', reason: 'invalid-authority' };

  const records = copyBenbenRecords(input.benbenByLevel);
  if (records === undefined) return { status: 'rejected', reason: 'invalid-authority' };
  if (input.attemptLevelId !== input.claimLevelId) {
    return { status: 'rejected', reason: 'wrong-level' };
  }
  if (input.temporaryBenbenCard !== null) {
    try { createTemporaryBenbenCard(input.temporaryBenbenCard); }
    catch { return { status: 'rejected', reason: 'invalid-authority' }; }
    return { status: 'rejected', reason: 'card-already-exists' };
  }
  const index = records.findIndex((entry) => entry.levelId === input.claimLevelId);
  if (index < 0) return { status: 'rejected', reason: 'no-matching-entitlement' };
  const entitlement = records[index];
  if (entitlement === undefined) return { status: 'rejected', reason: 'invalid-authority' };
  if (entitlement.status === 'unavailable') {
    return { status: 'rejected', reason: 'entitlement-unavailable' };
  }
  if (entitlement.status === 'used') return { status: 'rejected', reason: 'entitlement-used' };
  if (input.hasTakenStep) return { status: 'rejected', reason: 'step-already-taken' };
  if (input.phase.kind === 'pending-mine-encounter') {
    return { status: 'rejected', reason: 'pending-mine-encounter' };
  }
  if (input.phase.kind === 'failed') return { status: 'rejected', reason: 'run-failed' };
  if (input.phase.kind === 'won') return { status: 'rejected', reason: 'run-won' };

  const derivation = deriveBenbenCard({
    levelId: input.attemptLevelId,
    runId: input.attemptRunId,
  });
  if (derivation.status !== 'derived') {
    return { status: 'rejected', reason: 'invalid-card-derivation' };
  }
  const next = records.map((entry, recordIndex) => recordIndex === index
    ? createBenbenLevelState({ ...entry, status: 'used', failureStreak: 0 })
    : createBenbenLevelState(entry));
  return Object.freeze({
    status: 'claimed',
    nextBenbenByLevel: Object.freeze(next),
    temporaryBenbenCard: createTemporaryBenbenCard({
      item: derivation.item,
      consumed: false,
    }),
  });
}
