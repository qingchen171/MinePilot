import {
  createBoard,
  createCellState,
  type BoardState,
  type CellFacts,
  type CellState,
} from './board';

export type BoardValidationIssueCode =
  | 'invalid-input'
  | 'invalid-dimensions'
  | 'invalid-cell-count'
  | 'invalid-cell'
  | 'invalid-cell-state';

export interface BoardValidationIssue {
  readonly code: BoardValidationIssueCode;
  readonly field?: string;
  readonly cellIndex?: number;
}

export type ValidateBoardInputResult =
  | { readonly status: 'valid'; readonly board: BoardState }
  | { readonly status: 'invalid'; readonly issues: readonly BoardValidationIssue[] };

const CELL_FACT_FIELDS = Object.freeze([
  'terrain',
  'containsMine',
  'explored',
  'mineRevealed',
  'flagged',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function hasExactCellFactFields(cell: Record<string, unknown>): boolean {
  const keys = Object.keys(cell);
  return (
    keys.length === CELL_FACT_FIELDS.length &&
    CELL_FACT_FIELDS.every((field) => Object.hasOwn(cell, field))
  );
}

function parseCellFacts(cell: unknown, cellIndex: number): CellFacts | BoardValidationIssue {
  if (!isRecord(cell) || !hasExactCellFactFields(cell)) {
    return { code: 'invalid-cell', cellIndex };
  }

  if (cell.terrain !== 'playable' && cell.terrain !== 'obstacle') {
    return { code: 'invalid-cell', cellIndex, field: 'terrain' };
  }

  const { containsMine, explored, mineRevealed, flagged } = cell;
  if (typeof containsMine !== 'boolean') {
    return { code: 'invalid-cell', cellIndex, field: 'containsMine' };
  }
  if (typeof explored !== 'boolean') {
    return { code: 'invalid-cell', cellIndex, field: 'explored' };
  }
  if (typeof mineRevealed !== 'boolean') {
    return { code: 'invalid-cell', cellIndex, field: 'mineRevealed' };
  }
  if (typeof flagged !== 'boolean') {
    return { code: 'invalid-cell', cellIndex, field: 'flagged' };
  }

  return {
    terrain: cell.terrain,
    containsMine,
    explored,
    mineRevealed,
    flagged,
  };
}

export function validateBoardInput(input: unknown): ValidateBoardInputResult {
  if (!isRecord(input) || !isRecord(input.dimensions) || !Array.isArray(input.cells)) {
    return { status: 'invalid', issues: [{ code: 'invalid-input' }] };
  }

  const issues: BoardValidationIssue[] = [];
  const { width, height } = input.dimensions;
  const widthIsValid = isPositiveSafeInteger(width);
  const heightIsValid = isPositiveSafeInteger(height);
  if (!widthIsValid) {
    issues.push({ code: 'invalid-dimensions', field: 'width' });
  }
  if (!heightIsValid) {
    issues.push({ code: 'invalid-dimensions', field: 'height' });
  }
  if (!widthIsValid || !heightIsValid) {
    return { status: 'invalid', issues: Object.freeze(issues) };
  }

  const cellCount = width * height;
  if (!Number.isSafeInteger(cellCount)) {
    return {
      status: 'invalid',
      issues: [{ code: 'invalid-dimensions', field: 'dimensions' }],
    };
  }
  if (input.cells.length !== cellCount) {
    return { status: 'invalid', issues: [{ code: 'invalid-cell-count' }] };
  }

  const cells: CellState[] = [];
  for (const [cellIndex, inputCell] of input.cells.entries()) {
    const facts = parseCellFacts(inputCell, cellIndex);
    if ('code' in facts) {
      issues.push(facts);
      continue;
    }

    try {
      cells.push(createCellState(facts));
    } catch {
      issues.push({ code: 'invalid-cell-state', cellIndex });
    }
  }

  if (issues.length > 0) return { status: 'invalid', issues: Object.freeze(issues) };

  return {
    status: 'valid',
    board: createBoard({ width, height }, cells),
  };
}
