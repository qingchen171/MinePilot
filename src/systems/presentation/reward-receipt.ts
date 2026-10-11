import type { Stage4GameState } from '../../core/stage4-game-state';
import type { PublicClaimedReward } from './public-facts';

export type RewardReceiptProof =
  | { readonly status: 'proven'; readonly entries: readonly PublicClaimedReward[] }
  | { readonly status: 'insufficient-proof' };

const key = (x: number, y: number) => `${x},${y}`;

/** Only the pre-dispatch authority and this same operation's committed result may establish a receipt. */
export function proveCommittedRewardReceipt(pre: Stage4GameState, post: Stage4GameState,
  kind: string, expectedRunId: string | null, expectedRevision: number | null,
  committedRevision: number): RewardReceiptProof {
  const empty = Object.freeze({ status: 'proven' as const, entries: Object.freeze([]) });
  if (kind !== 'move' && kind !== 'airplane') return empty;
  const old = pre.currentAttempt;
  const next = post.currentAttempt;
  if (old === null || next === null || expectedRunId !== old.runId || old.runId !== next.runId ||
      old.levelId !== next.levelId ||
      committedRevision !== (expectedRevision === null ? 0 : expectedRevision + 1) ||
      !Number.isSafeInteger(committedRevision) ||
      old.run.board.dimensions.width !== next.run.board.dimensions.width ||
      old.run.board.dimensions.height !== next.run.board.dimensions.height ||
      old.rewards.length !== next.rewards.length) return { status: 'insufficient-proof' };
  const oldCoordinates = new Set(old.rewards.map((reward) => key(reward.coordinate.x, reward.coordinate.y)));
  if (oldCoordinates.size !== old.rewards.length) return { status: 'insufficient-proof' };
  const nextByCoordinate = new Map(next.rewards.map((reward) => [key(reward.coordinate.x, reward.coordinate.y), reward]));
  if (nextByCoordinate.size !== next.rewards.length) return { status: 'insufficient-proof' };
  const priorClaims = new Set(pre.account.oneTimeClaimIds);
  const afterClaims = new Set(post.account.oneTimeClaimIds);
  if (afterClaims.size !== post.account.oneTimeClaimIds.length ||
      [...priorClaims].some((id) => !afterClaims.has(id))) return { status: 'insufficient-proof' };
  const entries: PublicClaimedReward[] = [];
  for (const reward of old.rewards) {
    const changed = nextByCoordinate.get(key(reward.coordinate.x, reward.coordinate.y));
    if (changed === undefined || changed.oneTimeClaimId !== reward.oneTimeClaimId ||
        changed.payload.kind !== reward.payload.kind ||
        (reward.payload.kind === 'coins' && (changed.payload.kind !== 'coins' || changed.payload.amount !== reward.payload.amount)) ||
        (reward.payload.kind === 'item' && (changed.payload.kind !== 'item' ||
          changed.payload.item !== reward.payload.item || changed.payload.quantity !== reward.payload.quantity)) ||
        (reward.claimed && !changed.claimed)) return { status: 'insufficient-proof' };
    if (reward.oneTimeClaimId !== null &&
        (reward.claimed !== priorClaims.has(reward.oneTimeClaimId) ||
         changed.claimed !== afterClaims.has(reward.oneTimeClaimId))) return { status: 'insufficient-proof' };
    if (reward.claimed || !changed.claimed) continue;
    const index = reward.coordinate.y * old.run.board.dimensions.width + reward.coordinate.x;
    const oldCell = old.run.board.cells[index];
    const newCell = next.run.board.cells[index];
    if (oldCell?.kind !== 'safe' || oldCell.exploration !== 'unexplored' ||
        newCell?.kind !== 'safe' || newCell.exploration !== 'explored' ||
        (reward.oneTimeClaimId !== null && priorClaims.has(reward.oneTimeClaimId))) {
      return { status: 'insufficient-proof' };
    }
    entries.push(Object.freeze({ coordinate: Object.freeze({ x: reward.coordinate.x, y: reward.coordinate.y }),
      payload: reward.payload.kind === 'coins'
        ? Object.freeze({ kind: 'coins' as const, amount: reward.payload.amount })
        : Object.freeze({ kind: 'item' as const, item: reward.payload.item, quantity: reward.payload.quantity }),
      oneTime: reward.oneTimeClaimId !== null }));
  }
  const allowedNewClaims = new Set(old.rewards.filter((reward) => !reward.claimed &&
    nextByCoordinate.get(key(reward.coordinate.x, reward.coordinate.y))?.claimed && reward.oneTimeClaimId !== null)
    .map((reward) => reward.oneTimeClaimId!));
  if ([...afterClaims].some((id) => !priorClaims.has(id) && !allowedNewClaims.has(id))) {
    return { status: 'insufficient-proof' };
  }
  entries.sort((a, b) => a.coordinate.y - b.coordinate.y || a.coordinate.x - b.coordinate.x);
  return Object.freeze({ status: 'proven', entries: Object.freeze(entries) });
}
