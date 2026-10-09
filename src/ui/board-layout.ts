/** One CSS-pixel layout shared by the DOM hit surface and the Phaser drawing. */
export interface BoardLayout {
  readonly width: number;
  readonly height: number;
  readonly columns: number;
  readonly rows: number;
  readonly originX: number;
  readonly originY: number;
  readonly cellSize: number;
}

export function boardLayout(width: number, height: number, columns: number, rows: number): BoardLayout | null {
  if (![width, height, columns, rows].every(Number.isFinite) || width <= 0 || height <= 0 ||
      !Number.isInteger(columns) || !Number.isInteger(rows) || columns <= 0 || rows <= 0) return null;
  const cellSize = Math.min((width - 16) / columns, (height - 16) / rows);
  if (cellSize <= 0) return null;
  return Object.freeze({ width, height, columns, rows,
    originX: (width - cellSize * columns) / 2, originY: (height - cellSize * rows) / 2, cellSize });
}

export function boardCellRect(layout: BoardLayout, x: number, y: number) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 ||
      x >= layout.columns || y >= layout.rows) return null;
  return Object.freeze({ x: layout.originX + x * layout.cellSize,
    y: layout.originY + y * layout.cellSize, width: layout.cellSize, height: layout.cellSize });
}
