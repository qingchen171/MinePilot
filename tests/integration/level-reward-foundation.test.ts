import { describe, expect, it } from 'vitest';
import { createCoordinate } from '../../src/core/board';
import { createInitialBoard } from '../../src/core/initial-board';
import { PRODUCTION_LEVEL_CATALOG } from '../../src/core/level-catalog';
import { selectMineCoordinates } from '../../src/core/mine-placement';
import { createSeededRandomSource } from '../../src/core/random';
import { generateRewards } from '../../src/core/reward-generation';

describe('Stage 1 Board to deterministic Reward foundation composition', () => {
  it('uses an authoritative initial Board without changing Mine generation', () => {
    const level = PRODUCTION_LEVEL_CATALOG.levels[0]!;
    const candidates = Array.from({ length: 81 }, (_, index) =>
      createCoordinate(index % 9, Math.floor(index / 9)));
    const mines = selectMineCoordinates(candidates, level.board.mineCount, createSeededRandomSource(321));
    expect(mines.status).toBe('selected');
    if (mines.status !== 'selected') return;
    const assembled = createInitialBoard({
      dimensions: level.board.dimensions,
      obstacleCoordinates: level.board.obstacleCoordinates,
      mineCoordinates: mines.coordinates,
    });
    expect(assembled.status).toBe('created');
    if (assembled.status !== 'created') return;

    const rewards = generateRewards({ board: assembled.board, generationSeed: 321, config: level.rewards });
    expect(rewards).toEqual({
      status: 'generated',
      randomSeed: 387893393,
      rewards: [
        { coordinate: { x: 4, y: 4 }, payload: { kind: 'coins', amount: 1 }, claimed: false, oneTimeClaimId: null },
        { coordinate: { x: 5, y: 7 }, payload: { kind: 'item', item: 'detection', quantity: 1 }, claimed: false, oneTimeClaimId: null },
      ],
    });
    if (rewards.status !== 'generated') return;
    const mineKeys = new Set(mines.coordinates.map(({ x, y }) => `${x},${y}`));
    expect(rewards.rewards.every(({ coordinate }) => !mineKeys.has(`${coordinate.x},${coordinate.y}`))).toBe(true);

    const repeatedMines = selectMineCoordinates(candidates, level.board.mineCount, createSeededRandomSource(321));
    expect(repeatedMines).toEqual(mines);
    expect(generateRewards({ board: assembled.board, generationSeed: 321, config: level.rewards })).toEqual(rewards);
  });
});
