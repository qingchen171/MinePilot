import { describe, expect, it } from 'vitest';
import { semanticCopy } from '../../../src/ui/semantic-copy';

describe('S5-08 complete semantic copy', () => {
  it('formats complete visible and accessible sentences from public parameters', () => {
    expect(semanticCopy('board.cell', { row: 2, column: 3, appearance: 'unknown' }))
      .toBe('Row 2, column 3: Unknown cell.');
    expect(semanticCopy('board.cell-occupied', { row: 2, column: 3, appearance: 'explored' }))
      .toBe('Row 2, column 3: Explored cell. Character here.');
    expect(semanticCopy('board.mine-position', { row: 1, column: 4 }))
      .toBe('Character standing on a revealed mine at row 1, column 4.');
    expect(semanticCopy('game.item-status', { item: 'revive', resource: 'temporary', uses: 1 }))
      .toBe('Revive — Temporary card. Uses remaining: 1.');
  });
  it('keeps plural and one-time Reward grammar in resources', () => {
    expect(semanticCopy('shop.offer-single', { item: 'lucky', price: 1, owned: 2 }))
      .toBe('Lucky: 1 coin. Owned: 2.');
    expect(semanticCopy('reward.coins-plural-one-time', { row: 1, column: 1, amount: 4 }))
      .toBe('Row 1, column 1: 4 coins — One-time reward.');
    expect(semanticCopy('status.reward-plural', { count: 2 }))
      .toBe('Reward saved: 2 claimed rewards.');
  });
  it('rejects invalid public parameters without HTML or interpolation leakage', () => {
    expect(semanticCopy('board.selected', { row: -1, column: 1 })).toBe('That action could not be completed.');
    expect(semanticCopy('level.current', { levelId: '<img>' })).toBe('That action could not be completed.');
    expect(semanticCopy('game.temporary-card', { item: 'mine' as 'lucky' })).toBe('That action could not be completed.');
  });
});
