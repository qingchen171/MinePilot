import { describe, expect, it } from 'vitest';
import { getCellAt, type CellFacts } from '../../../src/core/board';
import {
  validateBoardInput,
  type BoardValidationIssueCode,
  type ValidateBoardInputResult,
} from '../../../src/core/board-validator';

const obstacle = (): CellFacts => ({
  terrain: 'obstacle',
  containsMine: false,
  explored: false,
  mineRevealed: false,
  flagged: false,
});

const safe = (explored = false, flagged = false): CellFacts => ({
  terrain: 'playable',
  containsMine: false,
  explored,
  mineRevealed: false,
  flagged,
});

const mine = (mineRevealed = false, flagged = false): CellFacts => ({
  terrain: 'playable',
  containsMine: true,
  explored: false,
  mineRevealed,
  flagged,
});

function boardInput(width: number, height: number, cells: readonly unknown[]) {
  return { dimensions: { width, height }, cells };
}

function expectOnlyIssue(result: ValidateBoardInputResult, code: BoardValidationIssueCode): void {
  expect(result.status).toBe('invalid');
  if (result.status !== 'invalid') throw new Error('Expected invalid Board input.');
  expect(result.issues).toHaveLength(1);
  expect(result.issues[0]?.code).toBe(code);
}

describe('Board input structure validation', () => {
  it('constructs an authoritative BoardState from valid Board-like input', () => {
    const result = validateBoardInput(boardInput(2, 2, [safe(), obstacle(), mine(), safe(true)]));

    expect(result.status).toBe('valid');
    if (result.status !== 'valid') throw new Error('Expected a valid Board.');
    expect(result.board.dimensions).toEqual({ width: 2, height: 2 });
    expect(result.board.cells).toEqual([
      { kind: 'safe', exploration: 'unexplored', flagged: false },
      { kind: 'obstacle' },
      { kind: 'mine', revelation: 'hidden', flagged: false },
      { kind: 'safe', exploration: 'explored', flagged: false },
    ]);
  });

  it.each([null, false, 42, 'board', [], {}, { dimensions: {}, cells: 'wrong' }])(
    'rejects an unrecognizable input: %j',
    (input) => {
      expectOnlyIssue(validateBoardInput(input), 'invalid-input');
    },
  );

  it.each([
    ['width', 0, 1],
    ['width', -1, 1],
    ['width', 1.5, 1],
    ['width', Number.MAX_SAFE_INTEGER + 1, 1],
    ['height', 1, 0],
    ['height', 1, -1],
    ['height', 1, Number.NaN],
    ['height', 1, Number.POSITIVE_INFINITY],
  ])('rejects an invalid %s dimension', (field, width, height) => {
    const result = validateBoardInput(boardInput(width, height, []));

    expect(result.status).toBe('invalid');
    if (result.status !== 'invalid') throw new Error('Expected invalid dimensions.');
    expect(result.issues).toContainEqual({ code: 'invalid-dimensions', field });
  });

  it('rejects dimensions whose product is not a safe integer', () => {
    expectOnlyIssue(
      validateBoardInput(boardInput(Number.MAX_SAFE_INTEGER, 2, [])),
      'invalid-dimensions',
    );
  });

  it('rejects a cell count different from width multiplied by height', () => {
    expectOnlyIssue(validateBoardInput(boardInput(2, 2, [safe(), safe(), safe()])), 'invalid-cell-count');
  });

  it.each([
    ['non-object', 'safe'],
    ['unknown terrain', { ...safe(), terrain: 'water' }],
    ['missing field', { terrain: 'playable', containsMine: false, explored: false, flagged: false }],
    ['unknown field', { ...safe(), displayNumber: 0 }],
    ['non-boolean field', { ...safe(), flagged: 1 }],
  ])('rejects an invalid Cell structure: %s', (_description, cell) => {
    const result = validateBoardInput(boardInput(1, 1, [cell]));

    expectOnlyIssue(result, 'invalid-cell');
    if (result.status !== 'invalid') throw new Error('Expected an invalid Cell.');
    expect(result.issues[0]).toMatchObject({ cellIndex: 0 });
  });
});

describe('central Cell invariant reuse', () => {
  it.each([
    ['obstacle containing a mine', { ...obstacle(), containsMine: true }],
    ['explored obstacle', { ...obstacle(), explored: true }],
    ['revealed obstacle', { ...obstacle(), mineRevealed: true }],
    ['flagged obstacle', { ...obstacle(), flagged: true }],
    ['explored safe with a flag', safe(true, true)],
    ['safe revealed as a mine', { ...safe(), mineRevealed: true }],
    ['mine marked explored', { ...mine(), explored: true }],
    ['revealed mine with a flag', mine(true, true)],
  ])('rejects an invalid state combination: %s', (_description, cell) => {
    const result = validateBoardInput(boardInput(1, 1, [cell]));

    expectOnlyIssue(result, 'invalid-cell-state');
    if (result.status !== 'invalid') throw new Error('Expected an invalid Cell state.');
    expect(result.issues[0]).toEqual({ code: 'invalid-cell-state', cellIndex: 0 });
  });

  it.each([
    ['flagged hidden mine', mine(false, true), { kind: 'mine', revelation: 'hidden', flagged: true }],
    ['flagged unexplored safe', safe(false, true), { kind: 'safe', exploration: 'unexplored', flagged: true }],
    ['revealed mine', mine(true), { kind: 'mine', revelation: 'revealed', flagged: false }],
    ['hidden mine', mine(), { kind: 'mine', revelation: 'hidden', flagged: false }],
  ])('accepts a legal %s', (_description, cell, expected) => {
    const result = validateBoardInput(boardInput(1, 1, [cell]));

    expect(result.status).toBe('valid');
    if (result.status !== 'valid') throw new Error('Expected a valid Cell state.');
    expect(result.board.cells[0]).toEqual(expected);
  });

  it('does not reject a Board containing only obstacles', () => {
    expect(validateBoardInput(boardInput(2, 1, [obstacle(), obstacle()])).status).toBe('valid');
  });

  it('does not apply mine density, obstacle ratio, or minimum safe count policy', () => {
    const extreme = boardInput(4, 1, [mine(), mine(), mine(), obstacle()]);

    expect(validateBoardInput(extreme).status).toBe('valid');
  });
});

describe('input isolation and authoritative immutability', () => {
  it('does not modify the external input during validation', () => {
    const input = boardInput(2, 1, [safe(), mine()]);
    const snapshot = structuredClone(input);

    validateBoardInput(input);

    expect(input).toEqual(snapshot);
  });

  it('does not let later external mutations contaminate a validated BoardState', () => {
    const firstCell = { ...safe() };
    const input = { dimensions: { width: 1, height: 1 }, cells: [firstCell] };
    const result = validateBoardInput(input);
    if (result.status !== 'valid') throw new Error('Expected a valid Board.');

    firstCell.containsMine = true;
    input.dimensions.width = 2;
    input.cells.push(mine());

    expect(result.board.dimensions).toEqual({ width: 1, height: 1 });
    expect(result.board.cells).toHaveLength(1);
    expect(getCellAt(result.board, { x: 0, y: 0 })).toEqual({
      kind: 'safe',
      exploration: 'unexplored',
      flagged: false,
    });
    expect(Object.isFrozen(result.board)).toBe(true);
    expect(Object.isFrozen(result.board.dimensions)).toBe(true);
    expect(Object.isFrozen(result.board.cells)).toBe(true);
    expect(Object.isFrozen(result.board.cells[0])).toBe(true);
  });
});
