import { describe, expect, it } from 'vitest';
import { getCellAt } from '../../../src/core/board';
import { createLevelCatalog } from '../../../src/core/level-catalog';
import { createCompleteAttempt } from '../../../src/core/stage4-attempt-factory';
import { PRODUCTION_LEVEL_CATALOG } from '../../../src/core/level-catalog';

function level() {
  const result = createLevelCatalog([{
    levelId: ' level-001 ',
    board: { dimensions: { width: 3, height: 3 }, mineCount: 2, obstacleCoordinates: [{ x: 1, y: 1 }] },
    rewards: { rewardCount: 2, oneTimeClaimId: null, payloads: [{ weight: 100, payload: { kind: 'coins', amount: 1 } }] },
  }]);
  if (result.status !== 'created') throw new Error('fixture');
  return result.catalog.levels[0]!;
}

describe('complete dormant Attempt factory', () => {
  it('builds canonical Board, Run, items, Rewards, card and terminal facts', () => {
    const result = createCompleteAttempt({
      level: level(), runId: ' run-001 ',
      generationProvenance: { seed: 123456789, rngVersion: 'rng-v1', generationVersion: 'generation-v1' },
    });
    expect(result.status).toBe('created');
    if (result.status !== 'created') return;
    const { attempt } = result;
    expect(attempt.runId).toBe(' run-001 ');
    expect(attempt.levelId).toBe(' level-001 ');
    expect(attempt.run.characterPosition.kind).toBe('waiting');
    expect(attempt.run.phase.kind).toBe('active');
    expect(attempt.run.hasTakenStep).toBe(false);
    expect(attempt.runItems).toEqual({ successfulDetectionUses: 0, successfulAirplaneUses: 0, successfulReviveUses: 0, detectionRandomSeed: null });
    expect(attempt.rewards).toHaveLength(2);
    expect(attempt.rewards.every((reward) => getCellAt(attempt.run.board, reward.coordinate)?.kind === 'safe')).toBe(true);
    expect(attempt.temporaryBenbenCard).toBeNull();
    expect(attempt.terminalDisposition).toBe('not-applicable');
  });

  it('is deterministic for the adopted seed and does not mutate inputs', () => {
    const definition = level();
    const provenance = { seed: 7, rngVersion: 'rng-v1', generationVersion: 'generation-v1' };
    const first = createCompleteAttempt({ level: definition, runId: 'run-a', generationProvenance: provenance });
    const second = createCompleteAttempt({ level: definition, runId: 'run-a', generationProvenance: provenance });
    expect(first).toEqual(second);
    expect(provenance.seed).toBe(7);
  });

  it('uses the same adopted generation seed for the established Reward generator output', () => {
    const result = createCompleteAttempt({ level: level(), runId: 'run-a', generationProvenance: { seed: 9, rngVersion: 'rng-v1', generationVersion: 'generation-v1' } });
    expect(result.status).toBe('created');
    if (result.status !== 'created') return;
    expect(result.attempt.rewards.map((reward) => reward.coordinate)).toMatchInlineSnapshot(`
      [
        {
          "x": 1,
          "y": 0,
        },
        {
          "x": 0,
          "y": 2,
        },
      ]
    `);
  });

  it('builds the real production level-001 as 9x9, 10 mines, zero obstacles and two Rewards', () => {
    const result = createCompleteAttempt({
      level: PRODUCTION_LEVEL_CATALOG.levels[0]!, runId: 'production-run-001',
      generationProvenance: { seed: 123456789, rngVersion: 'rng-v1', generationVersion: 'generation-v1' },
    });
    expect(result.status).toBe('created');
    if (result.status !== 'created') return;
    expect(result.attempt.run.board.dimensions).toEqual({ width: 9, height: 9 });
    expect(result.attempt.run.board.cells.filter((cell) => cell.kind === 'mine')).toHaveLength(10);
    expect(result.attempt.run.board.cells.filter((cell) => cell.kind === 'obstacle')).toHaveLength(0);
    expect(result.attempt.rewards).toHaveLength(2);
  });
});
