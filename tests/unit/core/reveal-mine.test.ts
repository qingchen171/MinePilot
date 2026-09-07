import { describe, expect, it } from 'vitest';
import { createBoard, createCellState, createCoordinate, getCellAt } from '../../../src/core/board';
import { revealMine } from '../../../src/core/reveal-mine';

const safe = createCellState({ terrain: 'playable', containsMine: false, explored: true, mineRevealed: false, flagged: false });
const obstacle = createCellState({ terrain: 'obstacle', containsMine: false, explored: false, mineRevealed: false, flagged: false });
const mine = (flagged = false, mineRevealed = false) => createCellState({ terrain: 'playable', containsMine: true, explored: false, mineRevealed, flagged });

describe('revealMine', () => {
  it.each([false, true])('reveals hidden mine (flagged=%s) without changing other facts', (flagged) => {
    const original = mine(flagged);
    const board = createBoard({ width: 3, height: 1 }, [safe, original, obstacle]);
    const result = revealMine(board, createCoordinate(1, 0));
    expect(result.outcome).toBe('changed');
    if (result.outcome !== 'changed') throw new Error('Expected changed');
    expect(result.board).not.toBe(board);
    expect(getCellAt(result.board, createCoordinate(1, 0))).toEqual({ kind: 'mine', revelation: 'revealed', flagged: false });
    expect(result.board.cells[0]).toBe(safe);
    expect(result.board.cells[2]).toBe(obstacle);
    expect(board.cells[1]).toBe(original);
    expect(original).toEqual({ kind: 'mine', revelation: 'hidden', flagged });
    expect(Object.isFrozen(result.board)).toBe(true);
    expect(Object.isFrozen(result.board.cells[1])).toBe(true);
  });
  it('already revealed returns unchanged without a replacement Board', () => {
    const board = createBoard({ width: 1, height: 1 }, [mine(false, true)]);
    expect(revealMine(board, createCoordinate(0, 0))).toEqual({ outcome: 'unchanged', reason: 'already-revealed' });
  });
  it.each([safe, obstacle])('rejects non-mine %j', (cell) => {
    const board = createBoard({ width: 1, height: 1 }, [cell]);
    expect(revealMine(board, createCoordinate(0, 0))).toEqual({ outcome: 'rejected', reason: 'not-mine' });
    expect(board.cells[0]).toBe(cell);
  });
  it.each([{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0.5, y: 0 }])('rejects invalid/outside target %j', (target) => {
    const board = createBoard({ width: 1, height: 1 }, [mine()]);
    expect(revealMine(board, target)).toEqual({ outcome: 'rejected', reason: 'out-of-bounds' });
    expect(board.cells[0]).toEqual(mine());
  });
});
