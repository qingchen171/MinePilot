import type { SanitizedPublicFacts } from './public-facts';
import type { RewardReceiptProof } from './reward-receipt';

/** Detached, operation-local presentation evidence; never a saved event or gameplay intent. */
export interface CommittedEffectHandoff {
  readonly operationId: string;
  readonly kind: string;
  readonly target: { readonly x: number; readonly y: number } | null;
  readonly before: SanitizedPublicFacts;
  readonly after: SanitizedPublicFacts;
  readonly rewardReceipt: RewardReceiptProof;
  readonly firstLucky: boolean;
}

export function committedEffectHandoff(operationId: string, kind: string,
  target: { readonly x: number; readonly y: number } | null,
  before: SanitizedPublicFacts, after: SanitizedPublicFacts,
  rewardReceipt: RewardReceiptProof, firstLucky: boolean): CommittedEffectHandoff {
  return Object.freeze({ operationId, kind,
    target: target === null ? null : Object.freeze({ x: target.x, y: target.y }),
    before, after, rewardReceipt, firstLucky });
}
