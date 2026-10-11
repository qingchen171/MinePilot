/** Independently owned pure public input; bootstrap proves exact structural compatibility. */
export type PublicCellAppearance = 'unknown' | 'flagged' | 'explored' | 'obstacle' | 'revealed-mine';
export interface PublicProjectionInput {
  readonly settings: { readonly musicEnabled: boolean; readonly soundEffectsEnabled: boolean };
  readonly tutorialProgress: { readonly acknowledgedMilestoneIds: readonly string[] };
  readonly tutorialAcknowledgmentAllowed: boolean;
  readonly shop: {
    readonly status: 'available' | 'account-only' | 'unavailable';
    readonly offers: readonly { readonly item: 'lucky' | 'detection' | 'revive' | 'airplane'; readonly price: number; readonly affordable: boolean; readonly owned: number }[];
  };
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
    readonly items: {
      readonly detection: PublicItemOffer; readonly airplane: PublicItemOffer; readonly revive: PublicItemOffer;
      readonly automaticLuckyAvailable: boolean;
    };
    readonly benben: { readonly entitlement: 'unavailable' | 'available' | 'used'; readonly claimOffered: boolean;
      readonly temporaryCard: null | { readonly item: 'lucky' | 'detection' | 'revive' | 'airplane'; readonly consumed: boolean } };
    readonly terminal: { readonly failure: boolean; readonly retry: boolean; readonly replay: boolean;
      readonly next: boolean; readonly dismiss: boolean; readonly restart: boolean };
    readonly claimedRewards: readonly PublicClaimedReward[];
  };
}

interface PublicItemOffer { readonly offered: boolean; readonly resource: 'temporary' | 'account' | 'none';
  readonly usesRemaining: number }
interface PublicClaimedReward { readonly coordinate: { readonly x: number; readonly y: number };
  readonly payload: { readonly kind: 'coins'; readonly amount: number } |
    { readonly kind: 'item'; readonly item: 'lucky' | 'detection' | 'revive' | 'airplane'; readonly quantity: number };
  readonly oneTime: boolean }

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
    items: Object.freeze({
      detection: Object.freeze({ ...facts.attempt.items.detection }),
      airplane: Object.freeze({ ...facts.attempt.items.airplane }),
      revive: Object.freeze({ ...facts.attempt.items.revive }),
      automaticLuckyAvailable: facts.attempt.items.automaticLuckyAvailable,
    }),
    benben: Object.freeze({ entitlement: facts.attempt.benben.entitlement,
      claimOffered: facts.attempt.benben.claimOffered,
      temporaryCard: facts.attempt.benben.temporaryCard === null ? null :
        Object.freeze({ ...facts.attempt.benben.temporaryCard }) }),
    terminal: Object.freeze({ ...facts.attempt.terminal }),
    claimedRewards: Object.freeze(facts.attempt.claimedRewards.map((reward) => Object.freeze({
      coordinate: Object.freeze({ ...reward.coordinate }),
      payload: Object.freeze({ ...reward.payload }), oneTime: reward.oneTime,
    }))),
  });
  const shop = Object.freeze({
    status: facts.shop.status,
    offers: Object.freeze(facts.shop.offers.map((offer) => Object.freeze({ ...offer }))),
  });
  const settings = Object.freeze({ musicEnabled: facts.settings.musicEnabled,
    soundEffectsEnabled: facts.settings.soundEffectsEnabled });
  const tutorialProgress = Object.freeze({ acknowledgedMilestoneIds:
    Object.freeze([...facts.tutorialProgress.acknowledgedMilestoneIds]) });
  return Object.freeze({ account, attempt, shop, settings, tutorialProgress,
    tutorialAcknowledgmentAllowed: facts.tutorialAcknowledgmentAllowed, currentNumberDisplay });
}
