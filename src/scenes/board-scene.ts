import Phaser from 'phaser';
import type { BoardLayout } from '../ui/board-layout';
import type { PresentationViewModel } from '../ui/presentation-projection';

type Attempt = NonNullable<PresentationViewModel['attempt']>;
const FILL = { unknown: 0xabc3d6, flagged: 0xabc3d6, explored: 0xe8f2e7,
  obstacle: 0x566c78, 'revealed-mine': 0xe58d83 } as const;

/** Purely decorative scene. DOM owns input; the committed public projection owns every pixel. */
export class BoardScene extends Phaser.Scene {
  private graphics: Phaser.GameObjects.Graphics | null = null;
  private attempt: Attempt | null = null;
  private layout: BoardLayout | null = null;

  constructor() { super('BoardScene'); }

  create(): void {
    this.graphics = this.add.graphics();
    this.input.enabled = false;
    this.paint();
  }

  present(attempt: Attempt | null, layout: BoardLayout | null): void {
    this.attempt = attempt; this.layout = layout;
    this.paint();
  }

  private paint(): void {
    if (this.graphics === null) return;
    const g = this.graphics; g.clear();
    if (this.layout === null || this.attempt === null) return;
    const { originX, originY, cellSize } = this.layout;
    const { width, cells } = this.attempt.board;
    for (const [index, appearance] of cells.entries()) {
      const x = originX + (index % width) * cellSize;
      const y = originY + Math.floor(index / width) * cellSize;
      g.fillStyle(FILL[appearance], 1).fillRoundedRect(x + 1, y + 1, cellSize - 2, cellSize - 2, 4);
      g.lineStyle(1, 0x6d879a, 1).strokeRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
      if (appearance === 'flagged') {
        g.lineStyle(2, 0x344254, 1).lineBetween(x + cellSize * .42, y + cellSize * .24,
          x + cellSize * .42, y + cellSize * .76);
        g.fillStyle(0xd04848, 1).fillTriangle(x + cellSize * .42, y + cellSize * .24,
          x + cellSize * .72, y + cellSize * .34, x + cellSize * .42, y + cellSize * .48);
      }
      if (appearance === 'revealed-mine') {
        g.fillStyle(0x283345, 1).fillCircle(x + cellSize / 2, y + cellSize / 2, cellSize * .18);
      }
    }
    const position = this.attempt.position;
    if (position.kind !== 'waiting') {
      const x = originX + (position.x + .5) * cellSize;
      const y = originY + (position.y + .5) * cellSize;
      g.fillStyle(0xffcf63, 1).fillCircle(x, y, cellSize * .24);
      g.lineStyle(2, 0x343850, 1).strokeCircle(x, y, cellSize * .24);
    }
  }
}
