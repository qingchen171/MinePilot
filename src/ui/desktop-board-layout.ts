import { boardLayout, type BoardLayout } from './board-layout';

/** Presentation allocation only. The larger canvas never determines logical cell size. */
export function desktopBoardFrame(viewportWidth: number) {
  const allocation = viewportWidth >= 1700 ? [1920, 364, 136, 800, 87.1, 1196, 360] :
    viewportWidth >= 1330 ? [1366, 211, 112, 600, 64.9, 835, 320] :
      viewportWidth >= 1200 ? [1280, 200, 104, 560, 60.4, 780, 300] :
        [1024, 100, 104, 528, 56.9, 644, 280];
  const [reference, left, top, base, minimum, rail, railWidth] = allocation as
    [number, number, number, number, number, number, number];
  const stacked = viewportWidth < 1000;
  const side = stacked ? Math.max(160, Math.min(528.1, viewportWidth - 32)) : Math.max(base, 9 * minimum + 16);
  const cell = (side - 16) / 9;
  const gutter = Math.max(0, Math.ceil(.65 * cell) - 8 + 4);
  const lateral = Math.ceil(.05 * cell) + 4;
  const shift = (viewportWidth - reference) / 2;
  return Object.freeze({ side, gutter, lateral, top: stacked ? 160 : top,
    left: stacked ? (viewportWidth - side) / 2 : left + shift,
    railLeft: stacked ? 16 : rail + shift, railWidth: stacked ? viewportWidth - 32 : railWidth,
    railTop: stacked ? 176 + gutter + side : top,
    railHeight: stacked ? 640 : side, stacked });
}

export function decorativeBoardLayout(side: number, columns: number, rows: number): BoardLayout | null {
  const logical = boardLayout(side, side, columns, rows);
  if (logical === null) return null;
  const gutter = Math.max(0, Math.ceil(.65 * logical.cellSize) - 8 + 4);
  const lateral = Math.ceil(.05 * logical.cellSize) + 4;
  return Object.freeze({ ...logical, width: side + 2 * lateral, height: side + gutter,
    originX: logical.originX + lateral, originY: logical.originY + gutter });
}
