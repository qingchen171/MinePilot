import { getCellAt } from './board';
import { countAdjacentMines } from './neighborhood';
import type { RunState } from './run';

export type CurrentCellMineCountResult =
  | { readonly status: 'available'; readonly mineCount: number }
  | { readonly status: 'unavailable' };

export function getCurrentCellMineCount(run: RunState): CurrentCellMineCountResult {
  if (run.characterPosition.kind === 'waiting') return { status: 'unavailable' };

  const coordinate = run.characterPosition.coordinate;
  const currentCell = getCellAt(run.board, coordinate);
  if (currentCell?.kind !== 'safe' || currentCell.exploration !== 'explored') {
    return { status: 'unavailable' };
  }

  return {
    status: 'available',
    mineCount: countAdjacentMines(run.board, coordinate),
  };
}
