/** Independently owned pure public input; bootstrap proves exact structural compatibility. */
export type PublicCellAppearance = 'unknown' | 'flagged' | 'explored' | 'obstacle' | 'revealed-mine';
export interface PublicProjectionInput {
  readonly account: {
    readonly coins: number;
    readonly inventory: { readonly lucky: number; readonly detection: number; readonly airplane: number; readonly revive: number };
    readonly completedLevelIds: readonly string[];
  };
  readonly attempt: null | {
    readonly levelId: string;
    readonly phase: 'active' | 'pending-mine-encounter' | 'failed' | 'won';
    readonly hasTakenStep: boolean;
    readonly position: { readonly kind: 'waiting' } | {
      readonly kind: 'on-board' | 'revealed-mine-occupancy'; readonly x: number; readonly y: number;
    };
    readonly board: { readonly width: number; readonly height: number; readonly cells: readonly PublicCellAppearance[] };
    readonly currentMineCount: number | null;
    readonly itemUses: { readonly detection: number; readonly airplane: number; readonly revive: number };
  };
}

export interface PresentationViewModel extends PublicProjectionInput {
  readonly currentNumberDisplay: { readonly kind: 'hidden' | 'zero-feedback' | 'number'; readonly value: number | null };
}

export function projectPublicFacts(facts: PublicProjectionInput): PresentationViewModel {
  const count = facts.attempt?.currentMineCount ?? null;
  const currentNumberDisplay = Object.freeze(count === null
    ? { kind: 'hidden' as const, value: null }
    : count === 0
      ? { kind: 'zero-feedback' as const, value: null }
      : { kind: 'number' as const, value: count });
  const account = Object.freeze({
    coins: facts.account.coins,
    inventory: Object.freeze({ ...facts.account.inventory }),
    completedLevelIds: Object.freeze([...facts.account.completedLevelIds]),
  });
  const attempt = facts.attempt === null ? null : Object.freeze({
    levelId: facts.attempt.levelId, phase: facts.attempt.phase, hasTakenStep: facts.attempt.hasTakenStep,
    position: Object.freeze({ ...facts.attempt.position }),
    board: Object.freeze({
      width: facts.attempt.board.width, height: facts.attempt.board.height,
      cells: Object.freeze([...facts.attempt.board.cells]),
    }),
    currentMineCount: facts.attempt.currentMineCount,
    itemUses: Object.freeze({ ...facts.attempt.itemUses }),
  });
  return Object.freeze({ account, attempt, currentNumberDisplay });
}
