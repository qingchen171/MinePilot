import { describe, expect, it, vi } from 'vitest';
import { createReviveCandidate } from '../../../src/core/revive';
import * as encounter from '../../../src/core/encounter';
import * as random from '../../../src/core/random';
import { getCurrentCellMineCount } from '../../../src/core/current-cell-mine-count';
import { moveCharacter } from '../../../src/core/movement';
import { createGameState } from '../../../src/core/game-state';
import { reviveGame } from '../../helpers/revive';

describe('Revive candidate', () => {
  it.each([true, false])('atomically survives first-step=%s without changing other facts', (first) => {
    const game = reviveGame({ first, lucky: first ? 0 : 3 });
    const before = JSON.stringify(game);
    const survival = vi.spyOn(encounter, 'resolvePendingMineEncounterAsSurvived');
    const rng = vi.spyOn(random, 'createSeededRandomSource');
    try {
      const result = createReviveCandidate(game);
      expect(result.status).toBe('candidate');
      if (result.status !== 'candidate') throw new Error('Expected candidate');
      expect(survival).toHaveBeenCalledExactlyOnceWith(game.run);
      expect(rng).not.toHaveBeenCalled();
      const next = result.candidate;
      expect(next).not.toBe(game);
      expect(next.run.board.cells[1]).toEqual({ kind: 'mine', revelation: 'revealed', flagged: false });
      for (const index of [0, 2, 3]) expect(next.run.board.cells[index]).toBe(game.run.board.cells[index]);
      expect(next.run.characterPosition).toEqual({ kind: 'revealed-mine-occupancy', coordinate: { x: 1, y: 0 } });
      expect(next.run.phase).toEqual({ kind: 'active' });
      expect(next.run.hasTakenStep).toBe(true);
      expect(next.account.inventory).toEqual({ ...game.account.inventory, revive: 1 });
      expect(next.runItems).toEqual({ ...game.runItems, successfulReviveUses: 1 });
      expect(getCurrentCellMineCount(next.run)).toEqual({ status: 'unavailable' });
      expect(JSON.stringify(game)).toBe(before);
      expect(Object.isFrozen(next)).toBe(true);
      expect(createReviveCandidate(next)).toEqual({ status: 'rejected', reason: 'no-pending-mine-encounter' });
    } finally { vi.restoreAllMocks(); }
  });

  it.each([
    ['lucky-priority', { first: true, lucky: 1 }],
    ['insufficient-inventory', { inventory: 0 }],
    ['usage-limit-reached', { uses: 1 }],
  ] as const)('rejects %s without invoking survival', (reason, options) => {
    const game = reviveGame(options);
    const before = JSON.stringify(game);
    const survival = vi.spyOn(encounter, 'resolvePendingMineEncounterAsSurvived');
    try {
      expect(createReviveCandidate(game)).toEqual({ status: 'rejected', reason });
      expect(survival).not.toHaveBeenCalled();
      expect(JSON.stringify(game)).toBe(before);
    } finally { vi.restoreAllMocks(); }
  });

  it.each(['active', 'failed', 'won'] as const)('rejects %s rather than reopening a completed attempt', (kind) => {
    const game = reviveGame({ allSafeExplored: true, phase: kind === 'failed'
      ? { kind, encounter: { target: { x: 1, y: 0 }, occurredOnFirstStep: false } } : { kind } });
    const before = JSON.stringify(game);
    expect(createReviveCandidate(game)).toEqual({ status: 'rejected', reason: 'no-pending-mine-encounter' });
    expect(JSON.stringify(game)).toBe(before);
  });

  it('does not evaluate victory even if every Safe was already explored', () => {
    const result = createReviveCandidate(reviveGame({ allSafeExplored: true }));
    if (result.status !== 'candidate') throw new Error('Expected candidate');
    expect(result.candidate.run.phase.kind).toBe('active');
  });

  it('has no caller target parameter and always resolves current encounter', () => {
    expect(createReviveCandidate.length).toBe(1);
    const result = createReviveCandidate(reviveGame());
    if (result.status !== 'candidate') throw new Error('Expected candidate');
    expect(result.candidate.run.board.cells[3]).toEqual({ kind: 'mine', revelation: 'hidden', flagged: false });
    expect(result.candidate.run.characterPosition).toMatchObject({ coordinate: { x: 1, y: 0 } });
  });

  it('leaves occupancy but cannot return, and a later encounter cannot revive again', () => {
    const result = createReviveCandidate(reviveGame());
    if (result.status !== 'candidate') throw new Error('Expected candidate');
    const moved = moveCharacter(result.candidate.run, { x: 0, y: 0 });
    if (moved.outcome !== 'moved') throw new Error('Expected move');
    expect(moved.state.characterPosition.kind).toBe('on-board');
    expect(moveCharacter(moved.state, { x: 1, y: 0 })).toEqual({ outcome: 'rejected', reason: 'revealed-mine' });
    const hit = moveCharacter(moved.state, { x: 3, y: 0 });
    if (hit.outcome !== 'requires-resolution') throw new Error('Expected encounter');
    expect(createReviveCandidate(createGameState({ ...result.candidate, run: hit.state })))
      .toEqual({ status: 'rejected', reason: 'usage-limit-reached' });
  });
});
