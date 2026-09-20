import { describe, expect, it } from 'vitest';
import {
  createLevelCatalog,
  findLevel,
  getLevelAccess,
  PRODUCTION_LEVEL_CATALOG,
  type LevelDefinitionInput,
} from '../../../src/core/level-catalog';

const rewards = () => ({
  rewardCount: 2,
  oneTimeClaimId: null,
  payloads: [
    { weight: 50, payload: { kind: 'coins' as const, amount: 1 } },
    { weight: 20, payload: { kind: 'item' as const, item: 'detection', quantity: 1 } },
    { weight: 15, payload: { kind: 'item' as const, item: 'revive', quantity: 1 } },
    { weight: 10, payload: { kind: 'item' as const, item: 'lucky', quantity: 1 } },
    { weight: 5, payload: { kind: 'item' as const, item: 'airplane', quantity: 1 } },
  ],
});

const level = (levelId: string): LevelDefinitionInput => ({
  levelId,
  board: { dimensions: { width: 3, height: 2 }, mineCount: 1, obstacleCoordinates: [] },
  rewards: rewards(),
});

function catalog(...inputs: readonly LevelDefinitionInput[]) {
  const result = createLevelCatalog(inputs);
  if (result.status !== 'created') throw new Error('Expected valid catalog.');
  return result.catalog;
}

describe('production level catalog and access authority', () => {
  it('freezes the exact level-001 board and ordinary Reward configuration', () => {
    expect(PRODUCTION_LEVEL_CATALOG.levels).toEqual([{
      levelId: 'level-001',
      board: { dimensions: { width: 9, height: 9 }, mineCount: 10, obstacleCoordinates: [] },
      rewards: rewards(),
    }]);
    expect(Object.isFrozen(PRODUCTION_LEVEL_CATALOG)).toBe(true);
    expect(Object.isFrozen(PRODUCTION_LEVEL_CATALOG.levels)).toBe(true);
    expect(Object.isFrozen(PRODUCTION_LEVEL_CATALOG.levels[0]?.board)).toBe(true);
    expect(Object.isFrozen(PRODUCTION_LEVEL_CATALOG.levels[0]?.rewards)).toBe(true);
  });

  it('uses exact stable IDs for lookup and duplicate detection', () => {
    const source = catalog(level('level-001'), level(' level-001 '));
    expect(findLevel(source, 'level-001').status).toBe('found');
    expect(findLevel(source, ' level-001 ').status).toBe('found');
    expect(findLevel(source, 'LEVEL-001')).toEqual({ status: 'not-found' });
    expect(findLevel(source, 'level-001 ')).toEqual({ status: 'not-found' });
    expect(createLevelCatalog([level('same'), level('same')])).toEqual({
      status: 'invalid', reason: 'duplicate-level-id', levelIndex: 1,
    });
    expect(createLevelCatalog([level('   ')])).toEqual({
      status: 'invalid', reason: 'invalid-level-id', levelIndex: 0,
    });
  });

  it('rejects empty and invalid board/reward catalogs', () => {
    expect(createLevelCatalog([])).toEqual({ status: 'invalid', reason: 'empty-catalog' });
    expect(createLevelCatalog([{ ...level('bad-board'), board: { ...level('x').board, mineCount: 7 } }]))
      .toEqual({ status: 'invalid', reason: 'invalid-board-config', levelIndex: 0 });
    expect(createLevelCatalog([{ ...level('bad-reward'), rewards: { ...rewards(), rewardCount: -1 } }]))
      .toEqual({ status: 'invalid', reason: 'invalid-reward-config', levelIndex: 0 });
  });

  it('derives first-level access, replay, next, and later unlock solely from catalog order and exact completions', () => {
    const source = catalog(level('level-001'), level('level-002'));
    expect(getLevelAccess(source, 'level-001', [])).toMatchObject({
      status: 'found', unlocked: true, replay: false, nextLevelId: 'level-002',
    });
    expect(getLevelAccess(source, 'level-002', [])).toMatchObject({
      status: 'found', unlocked: false, replay: false, nextLevelId: null,
    });
    expect(getLevelAccess(source, 'level-002', ['level-001'])).toMatchObject({
      status: 'found', unlocked: true, replay: false,
    });
    expect(getLevelAccess(source, 'level-002', ['level-002'])).toMatchObject({
      status: 'found', unlocked: true, replay: true,
    });
    expect(getLevelAccess(source, 'level-002', ['unknown', ' level-001 '])).toMatchObject({
      status: 'found', unlocked: false, replay: false,
    });
    expect(getLevelAccess(source, 'unknown', ['level-001'])).toEqual({ status: 'not-found' });
  });

  it('derives current final status from catalog order instead of hardcoding level-001', () => {
    expect(getLevelAccess(PRODUCTION_LEVEL_CATALOG, 'level-001', [])).toMatchObject({
      status: 'found', unlocked: true, nextLevelId: null,
    });
    expect(getLevelAccess(catalog(level('level-001'), level('level-002')), 'level-001', []))
      .toMatchObject({ nextLevelId: 'level-002' });
  });

  it('copies inputs and never mutates completion history', () => {
    const obstacle = { x: 1, y: 1 };
    const input = {
      levelId: 'copy',
      board: { dimensions: { width: 3, height: 2 }, mineCount: 1, obstacleCoordinates: [obstacle] },
      rewards: rewards(),
    };
    const source = catalog(input);
    const completed = ['copy'];
    const access = getLevelAccess(source, 'copy', completed);
    obstacle.x = 2;
    input.rewards.payloads[0]!.weight = 1;
    completed.push('later');
    expect(source.levels[0]?.board.obstacleCoordinates).toEqual([{ x: 1, y: 1 }]);
    expect(source.levels[0]?.rewards.payloads[0]?.weight).toBe(50);
    expect(access).toMatchObject({ unlocked: true, replay: true });
  });
});
