import type { CellState } from '../../core/board';
import { getCurrentCellMineCount } from '../../core/current-cell-mine-count';
import type { Stage4GameState } from '../../core/stage4-game-state';
import { getShopOffers, type ShopItem, type ValidatedShopCatalog } from '../../core/shop';

export type PublicCellAppearance = 'unknown' | 'flagged' | 'explored' | 'obstacle' | 'revealed-mine';
export interface SanitizedPublicFacts {
  readonly settings: { readonly musicEnabled: boolean; readonly soundEffectsEnabled: boolean };
  readonly tutorialProgress: { readonly acknowledgedMilestoneIds: readonly string[] };
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
  };
}

function publicCell(cell: CellState): PublicCellAppearance {
  if (cell.kind === 'obstacle') return 'obstacle';
  if (cell.kind === 'mine' && cell.revelation === 'revealed') return 'revealed-mine';
  if (cell.kind === 'safe' && cell.exploration === 'explored') return 'explored';
  return cell.flagged ? 'flagged' : 'unknown';
}

/** Explicit public whitelist. No Reward payload, Mine identity, seed or provenance crosses it. */
export function sanitizeStage4Runtime(runtime: Stage4GameState,
  shopCatalog: ValidatedShopCatalog | null = null): SanitizedPublicFacts {
  const { account, currentAttempt } = runtime;
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
  if (currentAttempt === null) return Object.freeze({ account: publicAccount, attempt: null, shop, settings, tutorialProgress });
  const { run, runItems } = currentAttempt;
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
    }),
  });
}
