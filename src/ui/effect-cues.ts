import type { PublicProjectionInput } from './presentation-projection';

/** UI-owned structural mirror of the trusted sanitized handoff. */
export interface PublicEffectInput {
  readonly operationId: string;
  readonly kind: string;
  readonly target: { readonly x: number; readonly y: number } | null;
  readonly before: PublicProjectionInput;
  readonly after: PublicProjectionInput;
  readonly rewardReceipt: { readonly status: 'proven'; readonly entries: readonly {
    readonly coordinate: { readonly x: number; readonly y: number };
    readonly payload: { readonly kind: 'coins'; readonly amount: number } |
      { readonly kind: 'item'; readonly item: 'lucky' | 'detection' | 'revive' | 'airplane'; readonly quantity: number };
    readonly oneTime: boolean;
  }[] } | { readonly status: 'insufficient-proof' };
  readonly firstLucky: boolean;
}

export type EffectCueKind = 'move' | 'flag' | 'detection' | 'airplane' | 'revive' | 'lucky' |
  'benben' | 'reward' | 'pending' | 'failure' | 'victory' | 'item' | 'saved';
export interface EffectCue {
  readonly operationId: string;
  readonly kind: EffectCueKind;
  readonly coordinate: { readonly x: number; readonly y: number } | null;
  readonly from: { readonly x: number; readonly y: number } | null;
  readonly rewardCount: number;
}

const samePosition = (a: NonNullable<PublicProjectionInput['attempt']>['position'],
  b: NonNullable<PublicProjectionInput['attempt']>['position']) => a.kind === b.kind &&
  (a.kind === 'waiting' || (b.kind !== 'waiting' && a.x === b.x && a.y === b.y));

/** An unproved special case falls back to a generic saved cue. */
export function projectEffectCue(input: PublicEffectInput): EffectCue {
  const before = input.before.attempt;
  const after = input.after.attempt;
  const sameAttempt = before !== null && after !== null && before.levelId === after.levelId;
  const target = input.target ?? (after?.position.kind === 'waiting' ? null : after?.position ?? null);
  const coordinate = target === null ? null : Object.freeze({ x: target.x, y: target.y });
  const prior = before?.position.kind === 'waiting' ? null : before?.position ?? null;
  const from = prior === null ? null : Object.freeze({ x: prior.x, y: prior.y });
  let kind: EffectCueKind = 'saved';
  if (input.rewardReceipt.status === 'proven' && input.rewardReceipt.entries.length > 0 &&
      (input.kind === 'move' || input.kind === 'airplane') && sameAttempt) kind = 'reward';
  else if (input.firstLucky && input.kind === 'move' && sameAttempt) kind = 'lucky';
  else if (sameAttempt && before.phase !== 'won' && after.phase === 'won') kind = 'victory';
  else if (input.kind === 'move' && sameAttempt && !samePosition(before.position, after.position)) kind = 'move';
  else if (input.kind === 'move' && sameAttempt && before.phase === 'active' &&
      after.phase === 'pending-mine-encounter') kind = 'pending';
  else if (input.kind === 'flag' && sameAttempt && before.board.cells.some((cell, index) =>
    cell !== after.board.cells[index])) kind = 'flag';
  else if (input.kind === 'detection' && sameAttempt && after.itemUses.detection === before.itemUses.detection + 1) kind = 'detection';
  else if (input.kind === 'airplane' && sameAttempt && after.itemUses.airplane === before.itemUses.airplane + 1) kind = 'airplane';
  else if (input.kind === 'revive' && sameAttempt && before.phase === 'pending-mine-encounter' &&
    after.phase === 'active' && after.itemUses.revive === before.itemUses.revive + 1) kind = 'revive';
  else if (input.kind === 'claim-benben' && sameAttempt && before.benben.entitlement === 'available' &&
    after.benben.entitlement === 'used' && after.benben.temporaryCard !== null) kind = 'benben';
  else if (input.kind === 'failure' && sameAttempt && before.phase === 'pending-mine-encounter' &&
    after.phase === 'failed') kind = 'failure';
  else if (['detection', 'airplane', 'revive'].includes(input.kind) && sameAttempt) kind = 'item';
  return Object.freeze({ operationId: input.operationId, kind, coordinate, from,
    rewardCount: input.rewardReceipt.status === 'proven' ? input.rewardReceipt.entries.length : 0 });
}
