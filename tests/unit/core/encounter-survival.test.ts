import { describe, expect, it } from 'vitest';
import { createBoard, createCellState, createCoordinate, getCellAt } from '../../../src/core/board';
import { resolvePendingMineEncounterAsSurvived, settleMineEncounterAsFailure } from '../../../src/core/encounter';
import { createInitialBoard } from '../../../src/core/initial-board';
import { moveCharacter } from '../../../src/core/movement';
import { createPendingMineEncounterRunState, createRunState, createWaitingRunState, createRevealedMineOccupancyPosition, type RunState } from '../../../src/core/run';
import { getCurrentCellMineCount } from '../../../src/core/current-cell-mine-count';

function initial(): RunState {
  const result = createInitialBoard({ dimensions: { width: 3, height: 1 }, obstacleCoordinates: [], mineCoordinates: [createCoordinate(1, 0)] });
  if (result.status !== 'created') throw new Error('Expected board');
  return createWaitingRunState(result.board);
}
function pending(first: boolean): RunState {
  let run = initial();
  if (!first) {
    const moved = moveCharacter(run, createCoordinate(0, 0));
    if (moved.outcome !== 'moved') throw new Error('Expected moved');
    run = moved.state;
  }
  return createPendingMineEncounterRunState(run, createCoordinate(1, 0));
}

describe('pending encounter survival primitive', () => {
  it.each([true, false])('atomically resolves the recorded target (first-step=%s)', (first) => {
    const before = pending(first);
    const snapshot = JSON.stringify(before);
    const result = resolvePendingMineEncounterAsSurvived(before);
    expect(result.outcome).toBe('resolved');
    if (result.outcome !== 'resolved') throw new Error('Expected resolved');
    expect(result.state.phase).toEqual({ kind: 'active' });
    expect(result.state.characterPosition).toEqual({ kind: 'revealed-mine-occupancy', coordinate: { x: 1, y: 0 } });
    expect(result.state.hasTakenStep).toBe(true);
    expect(getCellAt(result.state.board, createCoordinate(1, 0))).toEqual({ kind: 'mine', revelation: 'revealed', flagged: false });
    expect(result.state.board.cells[0]).toBe(before.board.cells[0]);
    expect(result.state.board.cells[2]).toBe(before.board.cells[2]);
    expect(JSON.stringify(before)).toBe(snapshot);
    expect(getCurrentCellMineCount(result.state)).toEqual({ status: 'unavailable' });
    expect(resolvePendingMineEncounterAsSurvived(result.state)).toEqual({ outcome: 'rejected', reason: 'no-pending-mine-encounter' });
    const left = moveCharacter(result.state, createCoordinate(0, 0));
    if (left.outcome !== 'moved') throw new Error('Expected exit');
    expect(moveCharacter(left.state, createCoordinate(1, 0))).toEqual({ outcome: 'rejected', reason: 'revealed-mine' });
  });
  it('rejects active', () => {
    expect(resolvePendingMineEncounterAsSurvived(initial())).toEqual({ outcome: 'rejected', reason: 'no-pending-mine-encounter' });
  });
  it('rejects failed without changing the failed run', () => {
    const failed = settleMineEncounterAsFailure(pending(true));
    if (failed.outcome !== 'failed') throw new Error('Expected failure');
    expect(resolvePendingMineEncounterAsSurvived(failed.state)).toEqual({ outcome: 'rejected', reason: 'no-pending-mine-encounter' });
    expect(failed.state.phase.kind).toBe('failed');
  });
  it('rejects won', () => {
    const safe = createCellState({ terrain: 'playable', containsMine: false, explored: true, mineRevealed: false, flagged: false });
    const run = createRunState(createBoard({ width: 1, height: 1 }, [safe]), { kind: 'on-board', coordinate: createCoordinate(0, 0) }, { hasTakenStep: true, phase: { kind: 'won' } });
    expect(resolvePendingMineEncounterAsSurvived(run)).toEqual({ outcome: 'rejected', reason: 'no-pending-mine-encounter' });
  });
  it('can resolve a subsequent encounter originating from existing occupancy', () => {
    const revealed = createCellState({ terrain: 'playable', containsMine: true, explored: false, mineRevealed: true, flagged: false });
    const board = createBoard({ width: 3, height: 1 }, [revealed, ...initial().board.cells.slice(1)]);
    const run = createRunState(board, createRevealedMineOccupancyPosition(createCoordinate(0, 0)));
    const encounter = moveCharacter(run, createCoordinate(1, 0));
    if (encounter.outcome !== 'requires-resolution') throw new Error('Expected encounter');
    expect(encounter.encounter.occurredOnFirstStep).toBe(false);
    const result = resolvePendingMineEncounterAsSurvived(encounter.state);
    if (result.outcome !== 'resolved') throw new Error('Expected resolved');
    expect(result.state.characterPosition).toEqual({ kind: 'revealed-mine-occupancy', coordinate: { x: 1, y: 0 } });
    expect(result.state.board.cells[0]).toBe(revealed);
  });
  it.each(['flagged', 'revealed', 'safe', 'outside'] as const)('rejects an inconsistent pending target: %s', (kind) => {
    const valid = pending(true);
    const facts = { terrain: 'playable' as const, containsMine: kind !== 'safe', explored: false, mineRevealed: kind === 'revealed', flagged: kind === 'flagged' };
    const malformed: RunState = { ...valid, board: createBoard({ width: 1, height: 1 }, [createCellState(facts)]), phase: { kind: 'pending-mine-encounter', encounter: { target: createCoordinate(kind === 'outside' ? 1 : 0, 0), occurredOnFirstStep: true } } };
    expect(resolvePendingMineEncounterAsSurvived(malformed)).toEqual({ outcome: 'rejected', reason: 'invalid-encounter-target' });
  });
});
