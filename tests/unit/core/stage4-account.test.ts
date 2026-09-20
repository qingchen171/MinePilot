import { describe, expect, it } from 'vitest';
import {
  createInitialStage4AccountState,
  createStage4AccountState,
  replaceStage4Inventory,
} from '../../../src/core/stage4-account';

describe('dormant Stage 4 Account', () => {
  it('creates the exact fresh Account without aliases', () => {
    const first = createInitialStage4AccountState();
    const second = createInitialStage4AccountState();
    expect(first).toEqual({
      inventory: { lucky: 1, detection: 2, airplane: 1, revive: 1 },
      coins: 0, completedLevelIds: [], oneTimeClaimIds: [], benbenByLevel: [],
    });
    expect(first).not.toBe(second);
    expect(first.inventory).not.toBe(second.inventory);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it('preserves padded stable IDs and freezes copied facts', () => {
    const completed = [' level-001 '];
    const account = createStage4AccountState({
      inventory: { lucky: 3, detection: 4, airplane: 5, revive: 6 },
      coins: 7,
      completedLevelIds: completed,
      oneTimeClaimIds: [' claim-001 '],
      benbenByLevel: [{ levelId: ' level-002 ', failureStreak: 2, status: 'unavailable' }],
    });
    completed[0] = 'changed';
    expect(account.completedLevelIds).toEqual([' level-001 ']);
    expect(account.benbenByLevel[0]?.levelId).toBe(' level-002 ');
  });

  it('replaces only inventory', () => {
    const account = createStage4AccountState({
      inventory: { lucky: 1, detection: 1, airplane: 1, revive: 1 }, coins: 9,
      completedLevelIds: ['level-a'], oneTimeClaimIds: ['claim-a'],
      benbenByLevel: [{ levelId: 'level-a', failureStreak: 0, status: 'used' }],
    });
    const next = replaceStage4Inventory(account, { lucky: 0, detection: 2, airplane: 0, revive: 0 });
    expect(next).toEqual({ ...account, inventory: { lucky: 0, detection: 2, airplane: 0, revive: 0 } });
    expect(account.inventory.lucky).toBe(1);
  });

  it.each([
    [{ coins: -1 }, 'coins'],
    [{ completedLevelIds: ['x', 'x'] }, 'duplicate completed ID'],
    [{ oneTimeClaimIds: ['x', 'x'] }, 'duplicate claim ID'],
    [{ benbenByLevel: [{ levelId: 'x', failureStreak: 0, status: 'used' }, { levelId: 'x', failureStreak: 0, status: 'used' }] }, 'duplicate Benben'],
    [{ benbenByLevel: [{ levelId: 'x', failureStreak: 3, status: 'unavailable' }] }, 'failure streak'],
  ])('rejects invalid %s (%s)', (override, _label) => {
    expect(() => createStage4AccountState({
      inventory: { lucky: 0, detection: 0, airplane: 0, revive: 0 }, coins: 0,
      completedLevelIds: [], oneTimeClaimIds: [], benbenByLevel: [], ...override,
    } as never)).toThrow();
  });
});
