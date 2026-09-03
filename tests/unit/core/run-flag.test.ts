import { describe, expect, it } from 'vitest';
import {
  createBoard,
  createCellState,
  createCoordinate,
  getCellAt,
  type BoardState,
  type CellState,
} from '../../../src/core/board';
import { settleMineEncounterAsFailure } from '../../../src/core/encounter';
import { moveCharacter } from '../../../src/core/movement';
import { setRunFlagged, type RunFlagTransitionResult } from '../../../src/core/run-flag';
import {
  createOnBoardPosition,
  createRunState,
  createWaitingRunState,
  type RunState,
} from '../../../src/core/run';

const obstacle = () =>
  createCellState({
    terrain: 'obstacle',
    containsMine: false,
    explored: false,
    mineRevealed: false,
    flagged: false,
  });

const safe = (explored = false, flagged = false) =>
  createCellState({
    terrain: 'playable',
    containsMine: false,
    explored,
    mineRevealed: false,
    flagged,
  });

const mine = (revealed = false, flagged = false) =>
  createCellState({
    terrain: 'playable',
    containsMine: true,
    explored: false,
    mineRevealed: revealed,
    flagged,
  });

const boardOf = (...cells: CellState[]): BoardState =>
  createBoard({ width: cells.length, height: 1 }, cells);

function changedState(result: RunFlagTransitionResult): RunState {
  if (result.outcome !== 'changed') throw new Error('Expected a changed Run flag transition.');
  return result.state;
}

function pendingRun(): RunState {
  const result = moveCharacter(
    createWaitingRunState(boardOf(safe(), mine())),
    createCoordinate(1, 0),
  );
  if (result.outcome !== 'requires-resolution') throw new Error('Expected a pending encounter.');
  return result.state;
}

function failedRun(): RunState {
  const result = settleMineEncounterAsFailure(pendingRun());
  if (result.outcome !== 'failed') throw new Error('Expected a failed Run.');
  return result.state;
}

function wonRun(): RunState {
  const board = boardOf(safe(true), mine());
  return createRunState(board, createOnBoardPosition(createCoordinate(0, 0)), {
    hasTakenStep: true,
    phase: { kind: 'won' },
  });
}

describe('Run-level normal Flag command', () => {
  it.each([
    ['unexplored Safe', safe(), { kind: 'safe', exploration: 'unexplored', flagged: true }],
    ['Hidden Mine', mine(), { kind: 'mine', revelation: 'hidden', flagged: true }],
  ])('places a Flag on an active %s through the Board primitive', (_description, cell, expected) => {
    const run = createWaitingRunState(boardOf(cell));
    const result = setRunFlagged(run, createCoordinate(0, 0), true);

    expect(result).toMatchObject({ outcome: 'changed', change: 'placed' });
    expect(getCellAt(changedState(result).board, createCoordinate(0, 0))).toEqual(expected);
  });

  it.each([
    ['wrongly flagged Safe', safe(false, true), { kind: 'safe', exploration: 'unexplored', flagged: false }],
    ['correctly flagged Mine', mine(false, true), { kind: 'mine', revelation: 'hidden', flagged: false }],
  ])('removes a Flag from an active %s through the Board primitive', (_description, cell, expected) => {
    const result = setRunFlagged(createWaitingRunState(boardOf(cell)), createCoordinate(0, 0), false);

    expect(result).toMatchObject({ outcome: 'changed', change: 'removed' });
    expect(getCellAt(changedState(result).board, createCoordinate(0, 0))).toEqual(expected);
  });

  it.each([
    ['explored Safe', safe(true)],
    ['Obstacle', obstacle()],
    ['Revealed Mine', mine(true)],
  ])('preserves the Board-level not-flaggable rejection for an active %s', (_description, cell) => {
    const run = createWaitingRunState(boardOf(cell));
    const result = setRunFlagged(run, createCoordinate(0, 0), true);

    expect(result).toEqual({ outcome: 'rejected', reason: 'not-flaggable' });
    expect('state' in result).toBe(false);
    expect(run.board.cells[0]).toBe(cell);
  });

  it('preserves the Board-level out-of-bounds rejection', () => {
    const run = createWaitingRunState(boardOf(safe()));
    const result = setRunFlagged(run, createCoordinate(1, 0), true);

    expect(result).toEqual({ outcome: 'rejected', reason: 'out-of-bounds' });
    expect('state' in result).toBe(false);
  });

  it.each([
    ['already flagged', safe(false, true), true, 'already-flagged'],
    ['already unflagged', safe(), false, 'already-unflagged'],
  ] as const)('returns unchanged when the target is %s', (_description, cell, desired, reason) => {
    const run = createWaitingRunState(boardOf(cell));
    const result = setRunFlagged(run, createCoordinate(0, 0), desired);

    expect(result).toEqual({ outcome: 'unchanged', reason });
    expect('state' in result).toBe(false);
    expect(run.board.cells[0]).toBe(cell);
  });

  it.each([
    ['pending-mine-encounter', pendingRun(), 'pending-mine-encounter'],
    ['failed', failedRun(), 'run-failed'],
    ['won', wonRun(), 'run-won'],
  ] as const)('rejects a %s Run before any Board transition', (_description, run, reason) => {
    const board = run.board;
    const cells = run.board.cells;
    const result = setRunFlagged(run, createCoordinate(0, 0), true);

    expect(result).toEqual({ outcome: 'rejected', reason });
    expect('state' in result).toBe(false);
    expect(run.board).toBe(board);
    expect(run.board.cells).toBe(cells);
  });

  it('rebuilds only a genuinely changed active Run and preserves Run facts', () => {
    const current = safe(true);
    const target = safe();
    const untouched = mine();
    const board = boardOf(current, target, untouched);
    const run = createRunState(board, createOnBoardPosition(createCoordinate(0, 0)), {
      hasTakenStep: true,
    });
    const result = setRunFlagged(run, createCoordinate(1, 0), true);
    const next = changedState(result);

    expect(next).not.toBe(run);
    expect(next.board).not.toBe(board);
    expect(next.characterPosition).toEqual(run.characterPosition);
    expect(next.hasTakenStep).toBe(true);
    expect(next.phase).toEqual({ kind: 'active' });
    expect(getCellAt(next.board, createCoordinate(0, 0))).toBe(current);
    expect(getCellAt(next.board, createCoordinate(1, 0))).not.toBe(target);
    expect(getCellAt(next.board, createCoordinate(2, 0))).toBe(untouched);
    expect(run.board).toBe(board);
    expect(run.characterPosition).toEqual({ kind: 'on-board', coordinate: { x: 0, y: 0 } });
    expect(target).toEqual({ kind: 'safe', exploration: 'unexplored', flagged: false });
  });

  it('does not count Flag placement as a step while waiting', () => {
    const run = createWaitingRunState(boardOf(safe(), mine()));
    const next = changedState(setRunFlagged(run, createCoordinate(1, 0), true));

    expect(next.hasTakenStep).toBe(false);
    expect(next.characterPosition).toEqual({ kind: 'waiting' });
    expect(next.phase).toEqual({ kind: 'active' });
  });

  it('does not trigger Victory or a Mine encounter when a Flag changes', () => {
    const board = boardOf(safe(true), mine());
    const run = createRunState(board, createOnBoardPosition(createCoordinate(0, 0)), {
      hasTakenStep: true,
    });
    const next = changedState(setRunFlagged(run, createCoordinate(1, 0), true));

    expect(next.phase).toEqual({ kind: 'active' });
    expect(next.characterPosition).toEqual(run.characterPosition);
  });
});
