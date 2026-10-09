import { describe, expect, it } from 'vitest';
import { boardCellRect, boardLayout } from '../../../src/ui/board-layout';

describe('one public board geometry', () => {
  it('keeps row-major corners and edges inside a centered clipped rectangle', () => {
    const layout = boardLayout(640, 360, 9, 9)!;
    expect(layout.cellSize).toBeGreaterThan(0);
    const first = boardCellRect(layout, 0, 0)!;
    const last = boardCellRect(layout, 8, 8)!;
    expect(first.x).toBe(layout.originX);
    expect(first.y).toBe(layout.originY);
    expect(last.x + last.width).toBeCloseTo(640 - layout.originX);
    expect(last.y + last.height).toBeCloseTo(360 - layout.originY);
    expect(boardCellRect(layout, -1, 0)).toBeNull();
    expect(boardCellRect(layout, 9, 0)).toBeNull();
  });

  it('reflows in CSS pixels without a DPR-dependent coordinate mapping', () => {
    const standard = boardLayout(640, 360, 2, 1)!;
    const zoomed = boardLayout(320, 180, 2, 1)!;
    expect(boardCellRect(standard, 1, 0)!.x / 2).toBeCloseTo(boardCellRect(zoomed, 1, 0)!.x);
    expect(boardLayout(0, 360, 2, 1)).toBeNull();
  });
});
