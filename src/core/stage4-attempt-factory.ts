import { createCoordinate, type Coordinate } from './board';
import { createAttemptState, type AttemptState, type GenerationProvenance } from './attempt-state';
import { createInitialBoard } from './initial-board';
import type { LevelDefinition } from './level-catalog';
import { selectMineCoordinates } from './mine-placement';
import { createSeededRandomSource } from './random';
import { generateRewards } from './reward-generation';
import { createInitialRunItemState } from './run-item-state';
import { createWaitingRunState } from './run';

export type CreateCompleteAttemptResult =
  | { readonly status: 'created'; readonly attempt: AttemptState }
  | { readonly status: 'invalid-level' | 'invalid-placement' | 'invalid-rewards' };

export function createCompleteAttempt(input: {
  readonly level: LevelDefinition;
  readonly runId: string;
  readonly generationProvenance: GenerationProvenance;
}): CreateCompleteAttemptResult {
  const obstacles = new Set(input.level.board.obstacleCoordinates.map(({ x, y }) => `${x},${y}`));
  const candidates: Coordinate[] = [];
  for (let y = 0; y < input.level.board.dimensions.height; y += 1) {
    for (let x = 0; x < input.level.board.dimensions.width; x += 1) {
      if (!obstacles.has(`${x},${y}`)) candidates.push(createCoordinate(x, y));
    }
  }
  const placement = selectMineCoordinates(
    candidates,
    input.level.board.mineCount,
    createSeededRandomSource(input.generationProvenance.seed),
  );
  if (placement.status !== 'selected') return { status: 'invalid-placement' };
  const board = createInitialBoard({
    dimensions: input.level.board.dimensions,
    obstacleCoordinates: input.level.board.obstacleCoordinates,
    mineCoordinates: placement.coordinates,
  });
  if (board.status !== 'created') return { status: 'invalid-level' };
  const rewards = generateRewards({
    board: board.board,
    generationSeed: input.generationProvenance.seed,
    config: input.level.rewards,
  });
  if (rewards.status !== 'generated') return { status: 'invalid-rewards' };
  return {
    status: 'created',
    attempt: createAttemptState({
      runId: input.runId,
      levelId: input.level.levelId,
      generationProvenance: input.generationProvenance,
      run: createWaitingRunState(board.board),
      runItems: createInitialRunItemState(null),
      rewards: rewards.rewards,
      temporaryBenbenCard: null,
      terminalDisposition: 'not-applicable',
    }),
  };
}
