import { describe, expect, it } from 'vitest';
import {
  createBoard,
  createCellState,
  createCoordinate,
  getCellAt,
  type BoardState,
  type CellState,
} from '../../../src/core/board';
import { moveCharacter, type MoveCharacterResult } from '../../../src/core/movement';
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

function movedState(result: MoveCharacterResult): RunState {
  if (result.outcome !== 'moved') throw new Error('Expected a successful movement.');
  return result.state;
}

describe('run position invariants', () => {
  it('represents the initial position as waiting without a fake coordinate', () => {
    const run = createWaitingRunState(boardOf(safe()));

    expect(run.characterPosition).toEqual({ kind: 'waiting' });
    expect('coordinate' in run.characterPosition).toBe(false);
  });

  it('rejects an on-board position outside the board', () => {
    expect(() =>
      createRunState(boardOf(safe(true)), createOnBoardPosition(createCoordinate(1, 0))),
    ).toThrow('An on-board character position must be inside the board.');
  });

  it.each([
    ['unexplored safe cell', safe()],
    ['hidden mine', mine()],
    ['revealed mine', mine(true)],
    ['obstacle', obstacle()],
  ])('rejects constructing an on-board position on a %s', (_description, cell) => {
    expect(() =>
      createRunState(boardOf(cell), createOnBoardPosition(createCoordinate(0, 0))),
    ).toThrow('An on-board character position must reference an explored safe cell.');
  });
});

describe('ordinary movement transitions', () => {
  it('moves from waiting to an unexplored safe cell and explores it atomically', () => {
    const run = createWaitingRunState(boardOf(safe()));
    const result = moveCharacter(run, createCoordinate(0, 0));
    const next = movedState(result);

    expect(next.characterPosition).toEqual({ kind: 'on-board', coordinate: { x: 0, y: 0 } });
    expect(getCellAt(next.board, createCoordinate(0, 0))).toEqual({
      kind: 'safe',
      exploration: 'explored',
      flagged: false,
    });
  });

  it('moves to an already explored safe cell without replacing the board', () => {
    const board = boardOf(safe(true));
    const next = movedState(moveCharacter(createWaitingRunState(board), createCoordinate(0, 0)));

    expect(next.board).toBe(board);
    expect(next.characterPosition).toEqual({ kind: 'on-board', coordinate: { x: 0, y: 0 } });
  });

  it('allows a distant safe target without adjacency or path checks', () => {
    const board = boardOf(safe(true), obstacle(), mine(), safe());
    const run = createRunState(board, createOnBoardPosition(createCoordinate(0, 0)));
    const next = movedState(moveCharacter(run, createCoordinate(3, 0)));

    expect(next.characterPosition).toEqual({ kind: 'on-board', coordinate: { x: 3, y: 0 } });
    expect(getCellAt(next.board, createCoordinate(3, 0))).toMatchObject({ exploration: 'explored' });
  });

  it.each([
    ['wrongly flagged safe cell', safe(false, true)],
    ['correctly flagged hidden mine', mine(false, true)],
  ])('rejects a %s because every normal flag is a safety lock', (_description, cell) => {
    const run = createWaitingRunState(boardOf(cell));

    expect(moveCharacter(run, createCoordinate(0, 0))).toEqual({
      outcome: 'rejected',
      reason: 'flagged',
    });
    expect(run.characterPosition).toEqual({ kind: 'waiting' });
  });

  it('rejects an obstacle without treating it as a path concept', () => {
    expect(moveCharacter(createWaitingRunState(boardOf(obstacle())), createCoordinate(0, 0))).toEqual({
      outcome: 'rejected',
      reason: 'obstacle',
    });
  });

  it('returns requires-resolution for an unflagged hidden mine', () => {
    expect(moveCharacter(createWaitingRunState(boardOf(mine())), createCoordinate(0, 0))).toEqual({
      outcome: 'requires-resolution',
      encounter: 'hidden-mine',
    });
  });

  it('does not reveal a hidden mine or commit the character position', () => {
    const hiddenMine = mine();
    const run = createWaitingRunState(boardOf(hiddenMine));
    const result = moveCharacter(run, createCoordinate(0, 0));

    expect(result.outcome).toBe('requires-resolution');
    expect(getCellAt(run.board, createCoordinate(0, 0))).toBe(hiddenMine);
    expect(hiddenMine).toEqual({ kind: 'mine', revelation: 'hidden', flagged: false });
    expect(run.characterPosition).toEqual({ kind: 'waiting' });
    expect('state' in result).toBe(false);
  });

  it('rejects entering a revealed mine', () => {
    expect(moveCharacter(createWaitingRunState(boardOf(mine(true))), createCoordinate(0, 0))).toEqual({
      outcome: 'rejected',
      reason: 'revealed-mine',
    });
  });

  it('rejects an out-of-bounds target and preserves waiting', () => {
    const run = createWaitingRunState(boardOf(safe()));

    expect(moveCharacter(run, createCoordinate(1, 0))).toEqual({
      outcome: 'rejected',
      reason: 'out-of-bounds',
    });
    expect(run.characterPosition).toEqual({ kind: 'waiting' });
  });

  it('returns unchanged when an on-board character selects the current cell', () => {
    const board = boardOf(safe(true));
    const run = createRunState(board, createOnBoardPosition(createCoordinate(0, 0)));

    expect(moveCharacter(run, createCoordinate(0, 0))).toEqual({
      outcome: 'unchanged',
      reason: 'already-at-target',
    });
  });

  it('does not treat waiting as already at any board target', () => {
    const result = moveCharacter(createWaitingRunState(boardOf(safe(true))), createCoordinate(0, 0));

    expect(result.outcome).toBe('moved');
  });

  it('does not mutate the original run, board, position, or target cell after movement', () => {
    const target = safe();
    const board = boardOf(safe(true), target);
    const run = createRunState(board, createOnBoardPosition(createCoordinate(0, 0)));
    const originalPosition = run.characterPosition;
    const next = movedState(moveCharacter(run, createCoordinate(1, 0)));

    expect(next).not.toBe(run);
    expect(next.board).not.toBe(board);
    expect(run.characterPosition).toBe(originalPosition);
    expect(run.characterPosition).toEqual({ kind: 'on-board', coordinate: { x: 0, y: 0 } });
    expect(getCellAt(board, createCoordinate(1, 0))).toBe(target);
    expect(target).toEqual({ kind: 'safe', exploration: 'unexplored', flagged: false });
  });

  it('changes only the target cell when first exploring a safe destination', () => {
    const cells = [safe(true), obstacle(), safe()];
    const board = boardOf(...cells);
    const run = createRunState(board, createOnBoardPosition(createCoordinate(0, 0)));
    const next = movedState(moveCharacter(run, createCoordinate(2, 0)));

    expect(getCellAt(next.board, createCoordinate(0, 0))).toBe(cells[0]);
    expect(getCellAt(next.board, createCoordinate(1, 0))).toBe(cells[1]);
    expect(getCellAt(next.board, createCoordinate(2, 0))).not.toBe(cells[2]);
  });

  it.each([
    [createWaitingRunState(boardOf(obstacle())), createCoordinate(0, 0)],
    [createWaitingRunState(boardOf(safe())), createCoordinate(1, 0)],
  ])('returns no replacement state for rejected movement %#', (run, target) => {
    const result = moveCharacter(run, target);

    expect(result.outcome).toBe('rejected');
    expect('state' in result).toBe(false);
  });

  it('returns no replacement state for unchanged movement', () => {
    const board = boardOf(safe(true));
    const run = createRunState(board, createOnBoardPosition(createCoordinate(0, 0)));
    const result = moveCharacter(run, createCoordinate(0, 0));

    expect(result.outcome).toBe('unchanged');
    expect('state' in result).toBe(false);
  });
});
