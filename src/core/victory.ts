import type { BoardState } from './board';

export function areAllRequiredSafeCellsExplored(board: BoardState): boolean {
  return board.cells.every(
    (cell) => cell.kind !== 'safe' || cell.exploration === 'explored',
  );
}
