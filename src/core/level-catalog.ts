import {
  createBoardDimensions,
  createCoordinate,
  isCoordinateInDimensions,
  type BoardDimensions,
  type Coordinate,
} from './board';
import {
  createRewardGenerationConfig,
  type RewardGenerationConfig,
  type RewardGenerationConfigInput,
} from './reward-generation';
import { createStableId } from './stable-id';

export interface LevelBoardConfigInput {
  readonly dimensions: BoardDimensions;
  readonly mineCount: number;
  readonly obstacleCoordinates: readonly Coordinate[];
}

export interface LevelBoardConfig {
  readonly dimensions: BoardDimensions;
  readonly mineCount: number;
  readonly obstacleCoordinates: readonly Coordinate[];
}

export interface LevelDefinitionInput {
  readonly levelId: unknown;
  readonly board: LevelBoardConfigInput;
  readonly rewards: RewardGenerationConfigInput;
}

export interface LevelDefinition {
  readonly levelId: string;
  readonly board: LevelBoardConfig;
  readonly rewards: RewardGenerationConfig;
}

export interface LevelCatalog {
  readonly levels: readonly LevelDefinition[];
}

export type CreateLevelCatalogResult =
  | { readonly status: 'created'; readonly catalog: LevelCatalog }
  | {
      readonly status: 'invalid';
      readonly reason:
        | 'empty-catalog'
        | 'invalid-level-id'
        | 'duplicate-level-id'
        | 'invalid-board-config'
        | 'invalid-reward-config';
      readonly levelIndex?: number;
    };

export type LevelLookupResult =
  | { readonly status: 'found'; readonly level: LevelDefinition }
  | { readonly status: 'not-found' };

export type LevelAccessResult =
  | { readonly status: 'not-found' }
  | {
      readonly status: 'found';
      readonly level: LevelDefinition;
      readonly unlocked: boolean;
      readonly replay: boolean;
      readonly nextLevelId: string | null;
    };

function createLevelBoardConfig(input: LevelBoardConfigInput): LevelBoardConfig | undefined {
  let dimensions: BoardDimensions;
  try {
    dimensions = createBoardDimensions(input.dimensions);
  } catch {
    return undefined;
  }
  if (!Number.isSafeInteger(input.mineCount) || input.mineCount < 0) return undefined;

  const obstacles: Coordinate[] = [];
  const keys = new Set<string>();
  for (const coordinate of input.obstacleCoordinates) {
    if (!isCoordinateInDimensions(dimensions, coordinate)) return undefined;
    const key = `${coordinate.x},${coordinate.y}`;
    if (keys.has(key)) return undefined;
    keys.add(key);
    obstacles.push(createCoordinate(coordinate.x, coordinate.y));
  }
  if (input.mineCount > dimensions.width * dimensions.height - obstacles.length) return undefined;
  return Object.freeze({ dimensions, mineCount: input.mineCount, obstacleCoordinates: Object.freeze(obstacles) });
}

export function createLevelCatalog(inputs: readonly LevelDefinitionInput[]): CreateLevelCatalogResult {
  if (inputs.length === 0) return { status: 'invalid', reason: 'empty-catalog' };
  const levels: LevelDefinition[] = [];
  const ids = new Set<string>();

  for (const [levelIndex, input] of inputs.entries()) {
    let levelId: string;
    try {
      levelId = createStableId(input.levelId, 'Level ID');
    } catch {
      return { status: 'invalid', reason: 'invalid-level-id', levelIndex };
    }
    if (ids.has(levelId)) return { status: 'invalid', reason: 'duplicate-level-id', levelIndex };
    ids.add(levelId);

    const board = createLevelBoardConfig(input.board);
    if (board === undefined) return { status: 'invalid', reason: 'invalid-board-config', levelIndex };
    const rewards = createRewardGenerationConfig(input.rewards);
    if (rewards.status !== 'created') {
      return { status: 'invalid', reason: 'invalid-reward-config', levelIndex };
    }
    levels.push(Object.freeze({ levelId, board, rewards: rewards.config }));
  }
  return { status: 'created', catalog: Object.freeze({ levels: Object.freeze(levels) }) };
}

export function findLevel(catalog: LevelCatalog, levelId: string): LevelLookupResult {
  const level = catalog.levels.find((candidate) => candidate.levelId === levelId);
  return level === undefined ? { status: 'not-found' } : { status: 'found', level };
}

export function getLevelAccess(
  catalog: LevelCatalog,
  levelId: string,
  completedLevelIds: readonly string[],
): LevelAccessResult {
  const index = catalog.levels.findIndex((candidate) => candidate.levelId === levelId);
  if (index < 0) return { status: 'not-found' };
  const completed = new Set(completedLevelIds);
  const replay = completed.has(levelId);
  const unlocked = index === 0 || replay || completed.has(catalog.levels[index - 1]!.levelId);
  return Object.freeze({
    status: 'found',
    level: catalog.levels[index]!,
    unlocked,
    replay,
    nextLevelId: catalog.levels[index + 1]?.levelId ?? null,
  });
}

const productionCatalog = createLevelCatalog([{
  levelId: 'level-001',
  board: { dimensions: { width: 9, height: 9 }, mineCount: 10, obstacleCoordinates: [] },
  rewards: {
    rewardCount: 2,
    oneTimeClaimId: null,
    payloads: [
      { weight: 50, payload: { kind: 'coins', amount: 1 } },
      { weight: 20, payload: { kind: 'item', item: 'detection', quantity: 1 } },
      { weight: 15, payload: { kind: 'item', item: 'revive', quantity: 1 } },
      { weight: 10, payload: { kind: 'item', item: 'lucky', quantity: 1 } },
      { weight: 5, payload: { kind: 'item', item: 'airplane', quantity: 1 } },
    ],
  },
}]);

if (productionCatalog.status !== 'created') throw new Error('Production level catalog is invalid.');
export const PRODUCTION_LEVEL_CATALOG = productionCatalog.catalog;
