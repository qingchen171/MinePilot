import { describe, expect, it, vi } from 'vitest';
import { createDetectionCandidate } from '../../../src/core/detection';
import { createCoordinate, getCellAt } from '../../../src/core/board';
import { createGameState } from '../../../src/core/game-state';
import { createPendingMineEncounterRunState } from '../../../src/core/run';
import { settleMineEncounterAsFailure } from '../../../src/core/encounter';
import { detectionGame } from '../../helpers/detection';

describe('Detection pure candidate', () => {
  it('golden: fixed seed selects exact target and advances next-use seed', () => {
    const game = detectionGame();
    const initializer = vi.fn(() => 99);
    const before = JSON.stringify(game);
    const result = createDetectionCandidate(game, initializer);
    if (result.status !== 'candidate') throw new Error('Expected candidate');
    // Frozen Mulberry32 first output modulo four is 2 for seed 123456789.
    expect(result.details.target).toEqual({ x: 0, y: 2 });
    expect(result.candidate.runItems.detectionRandomSeed).toBe(123456790);
    expect(result.candidate.runItems.successfulDetectionUses).toBe(1);
    expect(result.candidate.account.inventory).toEqual({ ...game.account.inventory, detection: 2 });
    expect(result.candidate.run.characterPosition).toEqual(game.run.characterPosition);
    expect(result.candidate.run.phase).toEqual(game.run.phase);
    expect(result.candidate.run.hasTakenStep).toBe(game.run.hasTakenStep);
    game.run.board.cells.forEach((cell, index) => {
      if (index !== 6) expect(result.candidate.run.board.cells[index]).toBe(cell);
    });
    expect(getCellAt(result.candidate.run.board, result.details.target)).toEqual({ kind: 'mine', revelation: 'revealed', flagged: false });
    expect(JSON.stringify(game)).toBe(before);
    expect(initializer).not.toHaveBeenCalled();
    expect(createDetectionCandidate(game, initializer)).toEqual(result);
  });
  it('permits revealed-mine occupancy and excludes its center', () => {
    const game = detectionGame(['SSS', 'SRH', 'SSS'], { position: { kind: 'revealed-mine-occupancy', coordinate: createCoordinate(1, 1) } });
    const result = createDetectionCandidate(game, () => 0);
    if (result.status !== 'candidate') throw new Error('Expected candidate');
    expect(result.details.target).toEqual({ x: 2, y: 1 });
    expect(result.candidate.run.board.cells[4]).toBe(game.run.board.cells[4]);
    expect(result.candidate.run.characterPosition).toEqual(game.run.characterPosition);
  });
  it.each([
    ['FHF', 'FEF', 'FFF'],
    ['RWH', 'OES', 'SSS'],
  ])('prioritizes only unflagged hidden mines: %j', (...rows) => {
    const result = createDetectionCandidate(detectionGame(rows), () => 0);
    if (result.status !== 'candidate') throw new Error('Expected candidate');
    expect(getCellAt(detectionGame(rows).run.board, result.details.target)).toEqual({ kind: 'mine', revelation: 'hidden', flagged: false });
  });
  it('falls back to flagged mine and removes only its flag', () => {
    const result = createDetectionCandidate(detectionGame(['RWF', 'OES', 'SSS']), () => 0);
    if (result.status !== 'candidate') throw new Error('Expected candidate');
    expect(result.details.target).toEqual({ x: 2, y: 0 });
    expect(result.candidate.run.board.cells[2]).toEqual({ kind: 'mine', revelation: 'revealed', flagged: false });
    expect(result.candidate.run.board.cells[1]).toEqual({ kind: 'safe', exploration: 'unexplored', flagged: true });
  });
  it.each([
    { rows: ['EHS', 'OSS', 'SSH'], position: { x: 0, y: 0 }, target: { x: 1, y: 0 } },
    { rows: ['HES', 'SOS', 'SSH'], position: { x: 1, y: 0 }, target: { x: 0, y: 0 } },
  ])('uses legal corner/edge neighbors only', ({ rows, position, target }) => {
    const result = createDetectionCandidate(detectionGame(rows, { position: { kind: 'on-board', coordinate: position } }), () => 0);
    if (result.status !== 'candidate') throw new Error('Expected candidate');
    expect(result.details.target).toEqual(target);
  });
  it.each(['waiting', 'pending', 'failed', 'won', 'inventory', 'cap', 'no-target'] as const)('rejects %s without initializing or changing state', (caseName) => {
    let game = detectionGame(undefined, { seed: null });
    let reason: string;
    if (caseName === 'waiting') {
      game = detectionGame(undefined, { seed: null, position: { kind: 'waiting' } }); reason = 'waiting';
    } else if (caseName === 'pending' || caseName === 'failed') {
      const pending = createPendingMineEncounterRunState(game.run, createCoordinate(0, 0));
      const failure = settleMineEncounterAsFailure(pending);
      if (failure.outcome !== 'failed') throw new Error('Expected failure');
      game = createGameState({ ...game, run: caseName === 'pending' ? pending : failure.state });
      reason = caseName === 'pending' ? 'pending-mine-encounter' : 'run-failed';
    } else if (caseName === 'won') {
      game = detectionGame(['HEH', 'EEE', 'HEH'], { seed: null, phase: { kind: 'won' } }); reason = 'run-won';
    } else if (caseName === 'inventory') {
      game = detectionGame(undefined, { seed: null, inventory: 0 }); reason = 'insufficient-inventory';
    } else if (caseName === 'cap') {
      game = detectionGame(undefined, { seed: null, uses: 2 }); reason = 'usage-limit-reached';
    } else {
      game = detectionGame(['RWS', 'OES', 'SSS'], { seed: null }); reason = 'no-hidden-mine';
    }
    const snapshot = JSON.stringify(game);
    const source = vi.fn(() => 5);
    expect(createDetectionCandidate(game, source)).toEqual({ status: 'rejected', reason });
    expect(source).not.toHaveBeenCalled();
    expect(JSON.stringify(game)).toBe(snapshot);
  });
  it('null seed is initialized in candidate only; uint32 progression wraps', () => {
    const game = detectionGame(undefined, { seed: null });
    const source = vi.fn(() => 0xffff_ffff);
    const result = createDetectionCandidate(game, source);
    if (result.status !== 'candidate') throw new Error('Expected candidate');
    expect(source).toHaveBeenCalledTimes(1);
    expect(result.candidate.runItems.detectionRandomSeed).toBe(0);
    expect(game.runItems.detectionRandomSeed).toBeNull();
  });
  it.each([-1, 0x1_0000_0000, NaN, Infinity, 0.5])('rejects invalid initializer value %s', (seed) => {
    expect(createDetectionCandidate(detectionGame(undefined, { seed: null }), () => seed)).toEqual({ status: 'rejected', reason: 'invalid-detection-seed' });
  });
  it('handles entropy failure without candidate', () => {
    expect(createDetectionCandidate(detectionGame(undefined, { seed: null }), () => { throw new Error('offline'); })).toEqual({ status: 'rejected', reason: 'seed-unavailable' });
  });
  it('second use cannot reveal the same mine; third use is rejected', () => {
    const first = createDetectionCandidate(detectionGame(), () => 0);
    if (first.status !== 'candidate') throw new Error('Expected first');
    const second = createDetectionCandidate(first.candidate, () => 0);
    if (second.status !== 'candidate') throw new Error('Expected second');
    expect(second.details.target).not.toEqual(first.details.target);
    expect(createDetectionCandidate(second.candidate, () => 0)).toEqual({ status: 'rejected', reason: 'usage-limit-reached' });
  });
});
