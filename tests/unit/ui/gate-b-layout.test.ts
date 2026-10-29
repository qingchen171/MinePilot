import { describe, it, expect } from 'vitest';
import { desktopBoardFrame, decorativeBoardLayout } from '../../../src/ui/desktop-board-layout';
import frames from '../../../src/config/explorer-frames';

describe('Gate B square geometry and exterior gutters', () => {
  for (const [width, height, minimum] of [[1366,768,64.9],[1280,720,60.4],[1024,768,56.9],[1920,1080,87.1]]) {
    it(`${width}: logical Board retains minimum cells and overflow stays in desktop`, () => {
      const frame = desktopBoardFrame(width!); const layout = decorativeBoardLayout(frame.side,9,9)!;
      expect(layout.cellSize).toBeGreaterThanOrEqual(minimum!);
      expect(frame.left-frame.lateral).toBeGreaterThanOrEqual(0);
      expect(frame.left+frame.side+frame.lateral).toBeLessThan(width!);
      expect(frame.top+layout.height).toBeLessThan(height!);
      expect(layout.originY-.65*layout.cellSize).toBeGreaterThanOrEqual(4);
      expect(layout.originX-.05*layout.cellSize).toBeGreaterThanOrEqual(4);
      expect(frame.railLeft).toBeGreaterThan(frame.left+frame.side+frame.lateral);
    });
  }
  it('rejects invalid dimensions and keeps narrow fallback inside the viewport', () => {
    expect(decorativeBoardLayout(0,9,9)).toBeNull();
    expect(decorativeBoardLayout(600,0,9)).toBeNull();
    const frame = desktopBoardFrame(390); const layout = decorativeBoardLayout(frame.side,9,9)!;
    expect(frame.stacked).toBe(true); expect(frame.left+frame.side+frame.lateral).toBeLessThan(390);
    expect(frame.railTop).toBeGreaterThan(frame.top+layout.height);
  });
  it('sixteen separate registered frames fit body envelope without changing proportions', () => {
    expect(frames).toHaveLength(16);
    for (const f of frames) {
      expect(f.x+f.width).toBeLessThanOrEqual(1254); expect(f.y+f.height).toBeLessThanOrEqual(1254);
      const scale = Math.min(1.08/f.height,1.1/f.width);
      expect(.84-f.height*scale).toBeGreaterThanOrEqual(-.25);
      expect(.5-f.width*scale/2).toBeGreaterThanOrEqual(-.05);
      expect(.5+f.width*scale/2).toBeLessThanOrEqual(1.05);
    }
  });
});
