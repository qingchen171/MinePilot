import { describe, expect, it, vi } from 'vitest';
import { createLuckyCandidate } from '../../../src/core/lucky';
import * as encounter from '../../../src/core/encounter';
import * as random from '../../../src/core/random';
import { getCurrentCellMineCount } from '../../../src/core/current-cell-mine-count';
import { reviveGame } from '../../helpers/revive';

describe('Lucky candidate', () => {
  it('uses the survival primitive and consumes only Lucky', () => {
    const game = reviveGame({ first: true, lucky: 2 });
    const before = JSON.stringify(game);
    const survival = vi.spyOn(encounter, 'resolvePendingMineEncounterAsSurvived');
    const rng = vi.spyOn(random, 'createSeededRandomSource');
    try {
      const result = createLuckyCandidate(game);
      if (result.status !== 'candidate') throw new Error('Expected candidate');
      expect(survival).toHaveBeenCalledTimes(1);
      expect(rng).not.toHaveBeenCalled();
      const next = result.candidate;
      expect(next.account.inventory).toEqual({ ...game.account.inventory, lucky: 1 });
      expect(next.runItems).toEqual(game.runItems);
      expect(next.run.phase).toEqual({ kind: 'active' });
      expect(next.run.hasTakenStep).toBe(true);
      expect(next.run.characterPosition).toEqual({ kind: 'revealed-mine-occupancy', coordinate: { x: 1, y: 0 } });
      expect(next.run.board.cells[1]).toEqual({ kind: 'mine', revelation: 'revealed', flagged: false });
      for (const index of [0, 2, 3]) expect(next.run.board.cells[index]).toBe(game.run.board.cells[index]);
      expect(getCurrentCellMineCount(next.run)).toEqual({ status: 'unavailable' });
      expect(JSON.stringify(game)).toBe(before);
      expect(createLuckyCandidate(next)).toEqual({ status: 'not-applicable', reason: 'no-pending-mine-encounter' });
    } finally { vi.restoreAllMocks(); }
  });
  it.each([
    [{ first: false, lucky: 2 }, 'not-first-step'],
    [{ first: true, lucky: 0 }, 'no-lucky'],
  ] as const)('does not consume for %s', (options, reason) => {
    const game = reviveGame(options);
    const before = JSON.stringify(game);
    expect(createLuckyCandidate(game)).toEqual({ status: 'not-applicable', reason });
    expect(JSON.stringify(game)).toBe(before);
  });
  it.each(['active', 'failed', 'won'] as const)('non-pending %s is not applicable', (kind) => {
    const phase = kind === 'failed' ? { kind, encounter: { target: { x: 1, y: 0 }, occurredOnFirstStep: false } } : { kind };
    expect(createLuckyCandidate(reviveGame({ phase, allSafeExplored: true, lucky: 2 })))
      .toEqual({ status: 'not-applicable', reason: 'no-pending-mine-encounter' });
  });
  it('invalid inventory is an error, not a Revive fallback', () => {
    const game = reviveGame({ first: true, lucky: 2 });
    expect(createLuckyCandidate({ ...game, account: { inventory: { ...game.account.inventory, lucky: -1 } } }))
      .toEqual({ status: 'rejected', reason: 'invalid-game-state' });
  });
});
