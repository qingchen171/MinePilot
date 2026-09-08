import { describe, expect, it, vi } from 'vitest';
import { createAirplaneCandidate } from '../../../src/core/airplane';
import * as reveal from '../../../src/core/reveal-mine';
import * as run from '../../../src/core/run';
import * as movement from '../../../src/core/movement';
import * as random from '../../../src/core/random';
import { airplaneGame } from '../../helpers/airplane';

describe('Airplane candidate', () => {
  it.each([
    { kind: 'waiting' },
    { kind: 'on-board', coordinate: { x: 3, y: 3 } },
    { kind: 'revealed-mine-occupancy', coordinate: { x: 0, y: 0 } },
  ] as const)('preserves active position $kind and all other item facts', (position) => {
    const game = airplaneGame(['RHOS', 'WFSH', 'SSSS', 'SSSE'], { position });
    const before = JSON.stringify(game);
    const result = createAirplaneCandidate(game, { x: 1, y: 1 });
    if (result.status !== 'candidate') throw new Error('Expected candidate');
    const next = result.candidate;
    expect(next.run.characterPosition).toEqual(position);
    expect(next.run.hasTakenStep).toBe(game.run.hasTakenStep);
    expect(next.run.phase.kind).toBe('active');
    expect(next.account.inventory).toEqual({ ...game.account.inventory, airplane: 1 });
    expect(next.runItems).toEqual({ ...game.runItems, successfulAirplaneUses: 1 });
    expect(next.run.board.cells[0]).toBe(game.run.board.cells[0]);
    expect(next.run.board.cells[2]).toBe(game.run.board.cells[2]);
    expect(next.run.board.cells[1]).toEqual({ kind: 'mine', revelation: 'revealed', flagged: false });
    expect(next.run.board.cells[5]).toEqual({ kind: 'mine', revelation: 'revealed', flagged: false });
    expect(next.run.board.cells[4]).toEqual({ kind: 'safe', exploration: 'explored', flagged: false });
    for (const index of [3, 7, 11, 12, 13, 14, 15]) expect(next.run.board.cells[index]).toBe(game.run.board.cells[index]);
    expect(JSON.stringify(game)).toBe(before);
    expect(Object.isFrozen(next)).toBe(true);
  });

  it.each([
    [{ x: 1, y: 1 }, [0, 1, 2, 4, 5, 6, 8, 9, 10]],
    [{ x: 1, y: 0 }, [0, 1, 2, 4, 5, 6]],
    [{ x: 0, y: 0 }, [0, 1, 4, 5]],
  ] as const)('clips without shifting for %j', (target, indices) => {
    const result = createAirplaneCandidate(airplaneGame(), target);
    if (result.status !== 'candidate') throw new Error('Expected candidate');
    const explored = result.candidate.run.board.cells.flatMap((cell, index) => cell.kind === 'safe' && cell.exploration === 'explored' ? [index] : []);
    expect(explored).toEqual(indices);
  });

  it.each(['S', 'H', 'R', 'O', 'F', 'W'])('accepts 1x1 center %s and still consumes', (symbol) => {
    const result = createAirplaneCandidate(airplaneGame([symbol]), { x: 0, y: 0 });
    if (result.status !== 'candidate') throw new Error('Expected candidate');
    expect(result.candidate.account.inventory.airplane).toBe(1);
    expect(result.candidate.runItems.successfulAirplaneUses).toBe(1);
    expect(result.candidate.run.phase.kind).toBe('won');
    expect(result.candidate.run.characterPosition.kind).toBe('waiting');
    expect(result.candidate.run.hasTakenStep).toBe(false);
  });

  it.each([['SS'], ['S', 'S'], ['SS', 'SS']])('small board %j can win from waiting atomically', (...rows) => {
    const result = createAirplaneCandidate(airplaneGame(rows), { x: 0, y: 0 });
    if (result.status !== 'candidate') throw new Error('Expected candidate');
    expect(result.candidate.run.phase.kind).toBe('won');
    expect(result.candidate.run.board.cells.every((cell) => cell.kind === 'safe' && cell.exploration === 'explored')).toBe(true);
  });

  it('no-benefit area still consumes without changing Board', () => {
    const game = airplaneGame(['OESS']);
    const result = createAirplaneCandidate(game, { x: 0, y: 0 });
    if (result.status !== 'candidate') throw new Error('Expected candidate');
    expect(result.candidate.run.board).toBe(game.run.board);
    expect(result.candidate.run.phase.kind).toBe('active');
    expect(result.candidate.account.inventory.airplane).toBe(1);
    expect(result.candidate.runItems.successfulAirplaneUses).toBe(1);
  });

  it('reveals center exactly once, delegates victory, never moves or uses RNG', () => {
    const revealSpy = vi.spyOn(reveal, 'revealMine');
    const victory = vi.spyOn(run, 'settleRunAsWon');
    const move = vi.spyOn(movement, 'moveCharacter');
    const rng = vi.spyOn(random, 'createSeededRandomSource');
    try {
      createAirplaneCandidate(airplaneGame(['HHH', 'HHH', 'HHH']), { x: 1, y: 1 });
      expect(revealSpy).toHaveBeenCalledTimes(9);
      expect(revealSpy.mock.calls.filter(([, coordinate]) => coordinate.x === 1 && coordinate.y === 1)).toHaveLength(1);
      expect(victory).toHaveBeenCalledTimes(1);
      expect(move).not.toHaveBeenCalled();
      expect(rng).not.toHaveBeenCalled();
    } finally { vi.restoreAllMocks(); }
  });

  it.each(['pending-mine-encounter', 'failed', 'won'] as const)('rejects phase %s', (kind) => {
    const phase = kind === 'won' ? { kind } : { kind, encounter: { target: { x: 0, y: 0 }, occurredOnFirstStep: true } };
    const game = airplaneGame(['HE'], { phase });
    const before = JSON.stringify(game);
    expect(createAirplaneCandidate(game, { x: 0, y: 0 })).toEqual({ status: 'rejected', reason: kind === 'failed' ? 'run-failed' : kind === 'won' ? 'run-won' : kind });
    expect(JSON.stringify(game)).toBe(before);
  });
  it.each([[{ inventory: 0 }, 'insufficient-inventory'], [{ uses: 1 }, 'usage-limit-reached']] as const)('rejects resource %j', (options, reason) => {
    expect(createAirplaneCandidate(airplaneGame(undefined, options), { x: 0, y: 0 })).toEqual({ status: 'rejected', reason });
  });
  it.each([{ x: -1, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 4 }, { x: 0.5, y: 0 }, { x: NaN, y: 0 }, { x: 0, y: Infinity }])('rejects invalid target %j', (target) => {
    const game = airplaneGame();
    const before = JSON.stringify(game);
    expect(createAirplaneCandidate(game, target)).toEqual({ status: 'rejected', reason: 'out-of-bounds' });
    expect(JSON.stringify(game)).toBe(before);
  });
});
