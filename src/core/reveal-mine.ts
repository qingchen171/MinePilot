import { createCellState, getCellAt, replaceCellAt, type BoardState, type Coordinate } from './board';

export type RevealMineResult =
  | { readonly outcome: 'changed'; readonly board: BoardState }
  | { readonly outcome: 'unchanged'; readonly reason: 'already-revealed' }
  | { readonly outcome: 'rejected'; readonly reason: 'out-of-bounds' | 'not-mine' };

/** Pure Board primitive; callers must compose and persist the complete gameplay candidate. */
export function revealMine(board: BoardState, target: Coordinate): RevealMineResult {
  const cell = getCellAt(board, target);
  if (cell === undefined) return { outcome: 'rejected', reason: 'out-of-bounds' };
  if (cell.kind !== 'mine') return { outcome: 'rejected', reason: 'not-mine' };
  if (cell.revelation === 'revealed') {
    return { outcome: 'unchanged', reason: 'already-revealed' };
  }
  const nextBoard = replaceCellAt(board, target, createCellState({
    terrain: 'playable', containsMine: true, explored: false, mineRevealed: true, flagged: false,
  }));
  if (nextBoard === undefined) return { outcome: 'rejected', reason: 'out-of-bounds' };
  return { outcome: 'changed', board: nextBoard };
}
