import Phaser from 'phaser';
import type { BoardLayout } from '../ui/board-layout';
import type { PresentationViewModel } from '../ui/presentation-projection';
import type { EffectCue } from '../ui/effect-cues';

type Attempt = NonNullable<PresentationViewModel['attempt']>;
const FILL = { unknown: 0xabc3d6, flagged: 0xabc3d6, explored: 0xe8f2e7,
  obstacle: 0x566c78, 'revealed-mine': 0xe58d83 } as const;

/** Purely decorative scene. DOM owns input; the committed public projection owns every pixel. */
export class BoardScene extends Phaser.Scene {
  private graphics: Phaser.GameObjects.Graphics | null = null;
  private attempt: Attempt | null = null;
  private layout: BoardLayout | null = null;
  private decoration: Phaser.GameObjects.Graphics | null = null;
  private decorationTween: Phaser.Tweens.Tween | null = null;
  private decorationEpoch = 0;

  constructor() { super('BoardScene'); }

  create(): void {
    this.graphics = this.add.graphics();
    this.decoration = this.add.graphics();
    this.input.enabled = false;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cancelEffect());
    this.paint();
  }

  present(attempt: Attempt | null, layout: BoardLayout | null): void {
    this.attempt = attempt; this.layout = layout;
    this.paint();
  }

  /** Disposable decoration, never a second character position or board authority. */
  playEffect(cue: EffectCue, epoch: number, stillValid: (epoch: number) => boolean): void {
    this.cancelEffect();
    if (!this.decoration || !this.layout || !this.attempt || !stillValid(epoch)) return;
    this.decorationEpoch = epoch;
    const { originX, originY, cellSize, columns, rows } = this.layout;
    const coordinate = cue.coordinate;
    const x = coordinate ? originX + (coordinate.x + .5) * cellSize : originX + columns * cellSize / 2;
    const y = coordinate ? originY + (coordinate.y + .5) * cellSize : originY + rows * cellSize / 2;
    const colors: Record<EffectCue['kind'], number> = {
      move: 0x3b9bcc, flag: 0xd04848, detection: 0x588db8, airplane: 0x6d70d4,
      revive: 0x60b880, lucky: 0xffcf63, benben: 0x8abf87, reward: 0xf4bd45,
      pending: 0xd47064, failure: 0x9a6670, victory: 0xf4bd45, item: 0x6d70d4, saved: 0x698aa0,
    };
    this.decoration.lineStyle(Math.max(2, cellSize * .08), colors[cue.kind], .9);
    if (cue.kind === 'move' && cue.from !== null && cue.coordinate !== null) {
      const fromX = originX + (cue.from.x + .5) * cellSize;
      const fromY = originY + (cue.from.y + .5) * cellSize;
      this.decoration.lineBetween(fromX, fromY, x, y);
    }
    this.decoration.strokeCircle(x, y, Math.max(8, cellSize * .3));
    this.decoration.setAlpha(1);
    this.decorationTween = this.tweens.add({ targets: this.decoration, alpha: 0, duration: 250,
      onComplete: () => { if (this.decorationEpoch === epoch && stillValid(epoch)) this.cancelEffect(); } });
  }

  cancelEffect(): void {
    this.decorationTween?.stop();
    this.decorationTween = null;
    this.decoration?.clear();
    this.decorationEpoch = 0;
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
