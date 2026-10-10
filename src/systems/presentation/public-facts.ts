import type { CellState } from '../../core/board';
import { getCurrentCellMineCount } from '../../core/current-cell-mine-count';
import type { Stage4GameState } from '../../core/stage4-game-state';
import { getShopOffers, type ShopItem, type ValidatedShopCatalog } from '../../core/shop';
import { inspectItemResource } from '../../core/item-resource';
import { getLevelAccess, PRODUCTION_LEVEL_CATALOG, type LevelCatalog } from '../../core/level-catalog';

export type PublicCellAppearance = 'unknown' | 'flagged' | 'explored' | 'obstacle' | 'revealed-mine';
export interface SanitizedPublicFacts {
  readonly settings: { readonly musicEnabled: boolean; readonly soundEffectsEnabled: boolean };
  readonly tutorialProgress: { readonly acknowledgedMilestoneIds: readonly string[] };
  readonly tutorialAcknowledgmentAllowed: boolean;
  readonly shop: {
    readonly status: 'available' | 'account-only' | 'unavailable';
    readonly offers: readonly { readonly item: ShopItem; readonly price: number; readonly affordable: boolean; readonly owned: number }[];
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
      readonly temporaryCard: null | { readonly item: ShopItem; readonly consumed: boolean } };
    readonly terminal: { readonly failure: boolean; readonly retry: boolean; readonly replay: boolean;
      readonly next: boolean; readonly dismiss: boolean; readonly restart: boolean };
    readonly claimedRewards: readonly PublicClaimedReward[];
  };
}

export interface PublicItemOffer {
  readonly offered: boolean;
  readonly resource: 'temporary' | 'account' | 'none';
  readonly usesRemaining: number;
}

export interface PublicClaimedReward {
  readonly coordinate: { readonly x: number; readonly y: number };
  readonly payload: { readonly kind: 'coins'; readonly amount: number } |
    { readonly kind: 'item'; readonly item: ShopItem; readonly quantity: number };
  readonly oneTime: boolean;
}

function publicCell(cell: CellState): PublicCellAppearance {
  if (cell.kind === 'obstacle') return 'obstacle';
  if (cell.kind === 'mine' && cell.revelation === 'revealed') return 'revealed-mine';
  if (cell.kind === 'safe' && cell.exploration === 'explored') return 'explored';
  return cell.flagged ? 'flagged' : 'unknown';
}

/** Explicit public whitelist. No Reward payload, Mine identity, seed or provenance crosses it. */
export function sanitizeStage4Runtime(runtime: Stage4GameState,
  shopCatalog: ValidatedShopCatalog | null = null,
  catalog: LevelCatalog = PRODUCTION_LEVEL_CATALOG): SanitizedPublicFacts {
  const { account, currentAttempt } = runtime;
  const tutorialAcknowledgmentAllowed = currentAttempt?.terminalDisposition !== 'legacy-excluded';
  const settings = Object.freeze({ musicEnabled: runtime.settings.musicEnabled,
    soundEffectsEnabled: runtime.settings.soundEffectsEnabled });
  const tutorialProgress = Object.freeze({ acknowledgedMilestoneIds:
    Object.freeze([...runtime.tutorialProgress.acknowledgedMilestoneIds]) });
  const inventory = Object.freeze({
    lucky: account.inventory.lucky, detection: account.inventory.detection,
    airplane: account.inventory.airplane, revive: account.inventory.revive,
  });
  const publicAccount = Object.freeze({
    coins: account.coins, inventory, completedLevelIds: Object.freeze([...account.completedLevelIds]),
  });
  const shop = Object.freeze(shopCatalog === null
    ? { status: 'unavailable' as const, offers: Object.freeze([]) }
    : currentAttempt !== null
      ? { status: 'account-only' as const, offers: Object.freeze([]) }
      : { status: 'available' as const, offers: getShopOffers(account, shopCatalog) });
  if (currentAttempt === null) return Object.freeze({ account: publicAccount, attempt: null, shop, settings, tutorialProgress,
    tutorialAcknowledgmentAllowed });
  const { run, runItems } = currentAttempt;
  const phase = run.phase.kind;
  const resource = (item: ShopItem) => inspectItemResource(item, account.inventory, currentAttempt.temporaryBenbenCard);
  const itemOffer = (item: 'detection' | 'airplane' | 'revive', cap: number, used: number,
    phaseEligible: boolean): PublicItemOffer => {
    const availability = resource(item);
    return Object.freeze({ offered: phaseEligible && used < cap && availability.status === 'available',
      resource: availability.status === 'available' ? availability.source : 'none',
      usesRemaining: Math.max(0, cap - used) });
  };
  const entitlement = account.benbenByLevel.find((entry) => entry.levelId === currentAttempt.levelId)?.status ?? 'unavailable';
  const card = currentAttempt.temporaryBenbenCard;
  const access = getLevelAccess(catalog, currentAttempt.levelId, account.completedLevelIds);
  const catalogHasCurrent = access.status === 'found';
  const claimedRewards: PublicClaimedReward[] = currentAttempt.rewards.filter((reward) => reward.claimed).map((reward) =>
    Object.freeze({ coordinate: Object.freeze({ x: reward.coordinate.x, y: reward.coordinate.y }),
      payload: reward.payload.kind === 'coins'
        ? Object.freeze({ kind: 'coins' as const, amount: reward.payload.amount })
        : Object.freeze({ kind: 'item' as const, item: reward.payload.item, quantity: reward.payload.quantity }),
      oneTime: reward.oneTimeClaimId !== null }));
  const position = run.characterPosition.kind === 'waiting'
    ? Object.freeze({ kind: 'waiting' as const })
    : Object.freeze({
        kind: run.characterPosition.kind,
        x: run.characterPosition.coordinate.x, y: run.characterPosition.coordinate.y,
      });
  const count = getCurrentCellMineCount(run);
  return Object.freeze({
    account: publicAccount,
    shop,
    settings,
    tutorialProgress,
    tutorialAcknowledgmentAllowed,
    attempt: Object.freeze({
      levelId: currentAttempt.levelId, phase: run.phase.kind, hasTakenStep: run.hasTakenStep,
      position,
      board: Object.freeze({
        width: run.board.dimensions.width, height: run.board.dimensions.height,
        cells: Object.freeze(run.board.cells.map(publicCell)),
      }),
      currentMineCount: count.status === 'available' ? count.mineCount : null,
      itemUses: Object.freeze({
        detection: runItems.successfulDetectionUses,
        airplane: runItems.successfulAirplaneUses,
        revive: runItems.successfulReviveUses,
      }),
      items: Object.freeze({
        detection: itemOffer('detection', 2, runItems.successfulDetectionUses,
          phase === 'active' && run.characterPosition.kind !== 'waiting'),
        airplane: itemOffer('airplane', 1, runItems.successfulAirplaneUses, phase === 'active'),
        revive: itemOffer('revive', 1, runItems.successfulReviveUses,
          phase === 'pending-mine-encounter' &&
          !(run.phase.kind === 'pending-mine-encounter' && run.phase.encounter.occurredOnFirstStep &&
            resource('lucky').status === 'available')),
        automaticLuckyAvailable: phase === 'active' && !run.hasTakenStep &&
          resource('lucky').status === 'available',
      }),
      benben: Object.freeze({ entitlement,
        claimOffered: entitlement === 'available' && phase === 'active' &&
          run.characterPosition.kind === 'waiting' && !run.hasTakenStep && card === null,
        temporaryCard: card === null ? null : Object.freeze({ item: card.item, consumed: card.consumed }),
      }),
      terminal: Object.freeze({
        failure: phase === 'pending-mine-encounter',
        retry: phase === 'failed' && catalogHasCurrent,
        replay: phase === 'won' && catalogHasCurrent && account.completedLevelIds.includes(currentAttempt.levelId),
        next: phase === 'won' && access.status === 'found' && access.nextLevelId !== null,
        dismiss: phase === 'failed' || phase === 'won',
        restart: phase === 'active' || phase === 'pending-mine-encounter',
      }),
      claimedRewards: Object.freeze(claimedRewards),
    }),
  });
}
