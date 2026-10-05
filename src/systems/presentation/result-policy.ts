/** Exact current production-session reason whitelist. Unknown reasons never inherit a prefix. */
export const REASONS = Object.freeze({
  domain: [
    'attempt-already-exists', 'no-attempt', 'invalid-phase', 'replay-not-entitled',
    'level-not-found', 'level-locked', 'next-unavailable', 'no-alternative-mine-layout',
    'generation-search-exhausted', 'pending-mine-encounter', 'run-failed', 'run-won',
    'out-of-bounds', 'not-flaggable', 'already-flagged', 'already-unflagged',
    'already-at-target', 'flagged', 'obstacle', 'revealed-mine', 'waiting',
    'insufficient-inventory', 'usage-limit-reached', 'no-hidden-mine',
    'no-pending-mine-encounter', 'lucky-priority', 'not-waiting', 'wrong-level',
    'no-matching-entitlement', 'entitlement-unavailable', 'entitlement-used',
    'card-already-exists', 'step-already-taken',
    'shop-requires-account-only', 'invalid-shop-item', 'insufficient-coins',
  ],
  stale: [
    'revision-conflict', 'run-id-conflict', 'owned-by-another-session',
    'commit-revision-conflict', 'commit-writer-not-owner', 'commit-lease-expired',
  ],
  retainablePreCommit: ['storage-failure', 'verification-failure', 'commit-lease-storage-failure'],
  /** Not promoted: underlying pre-head sources need exhaustive S5-02 proof. */
  conservativePreCommit: ['commit-persistence-commit-failure'],
  uncertain: ['commit-commit-outcome-uncertain'],
  recovery: [
    'invalid-json', 'invalid-save', 'revision-mismatch', 'unavailable-snapshot',
    'commit-persistence-load-failure', 'invalid-lease',
  ],
  technical: [
    'invalid-request', 'invalid-creation-facts', 'invalid-level', 'invalid-placement',
    'invalid-rewards', 'generation-configuration-mismatch', 'invalid-game-state',
    'invalid-encounter-target', 'invalid-detection-seed', 'seed-unavailable',
    'invalid-card-derivation', 'invalid-authority', 'reward-invalid-board-transition',
    'reward-invalid-authority', 'reward-asset-overflow', 'terminal-not-applicable',
    'terminal-rejected', 'invalid-candidate', 'revision-overflow', 'invalid-runtime',
    'not-writable', 'commit-invalid-next-revision',
    'inventory-overflow',
  ],
} as const);

export type ResultCategory = 'domain' | 'stale' | 'pre-commit-retainable' |
  'pre-commit-discard' | 'uncertain' | 'recovery' | 'technical' | 'unknown';

export interface ResultPolicy {
  readonly category: ResultCategory;
  readonly committedByThisSubmission: false | 'uncertain';
  readonly retainEnvelope: boolean;
  readonly retryUseful: boolean;
  readonly reloadRequired: boolean;
}

const policies: Record<ResultCategory, ResultPolicy> = {
  domain: { category: 'domain', committedByThisSubmission: false, retainEnvelope: false, retryUseful: false, reloadRequired: false },
  stale: { category: 'stale', committedByThisSubmission: false, retainEnvelope: false, retryUseful: false, reloadRequired: true },
  'pre-commit-retainable': { category: 'pre-commit-retainable', committedByThisSubmission: false, retainEnvelope: true, retryUseful: true, reloadRequired: true },
  'pre-commit-discard': { category: 'pre-commit-discard', committedByThisSubmission: false, retainEnvelope: false, retryUseful: false, reloadRequired: true },
  uncertain: { category: 'uncertain', committedByThisSubmission: 'uncertain', retainEnvelope: false, retryUseful: false, reloadRequired: true },
  recovery: { category: 'recovery', committedByThisSubmission: false, retainEnvelope: false, retryUseful: false, reloadRequired: true },
  technical: { category: 'technical', committedByThisSubmission: false, retainEnvelope: false, retryUseful: false, reloadRequired: false },
  unknown: { category: 'unknown', committedByThisSubmission: 'uncertain', retainEnvelope: false, retryUseful: false, reloadRequired: true },
};

const reasonCategory = new Map<string, ResultCategory>();
for (const reason of REASONS.domain) reasonCategory.set(reason, 'domain');
for (const reason of REASONS.stale) reasonCategory.set(reason, 'stale');
for (const reason of REASONS.retainablePreCommit) reasonCategory.set(reason, 'pre-commit-retainable');
for (const reason of REASONS.conservativePreCommit) reasonCategory.set(reason, 'pre-commit-discard');
for (const reason of REASONS.uncertain) reasonCategory.set(reason, 'uncertain');
for (const reason of REASONS.recovery) reasonCategory.set(reason, 'recovery');
for (const reason of REASONS.technical) reasonCategory.set(reason, 'technical');

export function classifyProductionReason(reason: string): ResultPolicy {
  return policies[reasonCategory.get(reason) ?? 'unknown'];
}
