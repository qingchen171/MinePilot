import Phaser from 'phaser';
import type { BoardLayout } from '../ui/board-layout';
import type { PresentationViewModel } from '../ui/presentation-projection';
import type { EffectCue } from '../ui/effect-cues';
import frames from '../config/explorer-frames';

type Attempt = NonNullable<PresentationViewModel['attempt']>;
const FILL = { unknown: 0xe9a454, flagged: 0xe9a454, explored: 0xffe8b7,
  obstacle: 0x566c78, 'revealed-mine': 0xe58d83 } as const;

/** Purely decorative scene. DOM owns input; the committed public projection owns every pixel. */
export class BoardScene extends Phaser.Scene {
  private graphics: Phaser.GameObjects.Graphics | null = null;
  private attempt: Attempt | null = null;
  private layout: BoardLayout | null = null;
  private decoration: Phaser.GameObjects.Graphics | null = null;
  private decorationTween: Phaser.Tweens.Tween | null = null;
  private decorationEpoch = 0;
  private explorer: Phaser.GameObjects.Image | null = null;
  private markers: Phaser.GameObjects.Graphics | null = null;
  private direction = 0;
  private poseTimer: Phaser.Time.TimerEvent | null = null;
  private tiles: Phaser.GameObjects.Image[] = [];

  constructor() { super('BoardScene'); }

  preload(): void {
    this.load.image('explorer', new URL('../assets/explorer/explorer-atlas.png', import.meta.url).href);
    this.load.image('tiles', new URL('../assets/game/tiles.png', import.meta.url).href);
  }

  create(): void {
    this.tiles = []; this.direction = 0;
    if (this.textures.exists('tiles')) {
      this.textures.get('tiles').add('unknown', 0, 66, 88, 740, 711);
      this.textures.get('tiles').add('explored', 0, 960, 88, 746, 711);
    }
    this.graphics = this.add.graphics();
    if (this.textures.exists('explorer')) {
      const texture = this.textures.get('explorer');
      frames.forEach((frame, index) => texture.add(index, 0, frame.x, frame.y, frame.width, frame.height));
      this.explorer = this.add.image(0, 0, 'explorer', 0).setOrigin(.5, 1);
    }
    this.markers = this.add.graphics();
    this.decoration = this.add.graphics();
    this.input.enabled = false;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cancelEffect(); this.graphics = null; this.markers = null; this.explorer = null; this.tiles = [];
    });
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
    // A pose changes only after the caller has rendered the committed destination.
    // It is never a sprite journey through intermediate gameplay cells.
    if (cue.kind === 'move' && cue.from && this.attempt.position.kind !== 'waiting') {
      const dx = this.attempt.position.x - cue.from.x;
      const dy = this.attempt.position.y - cue.from.y;
      this.direction = dy < 0 ? dx < 0 ? 3 : 2 : dx < 0 ? 1 : 0;
      this.showPose(1);
      let step = 1;
      this.poseTimer = this.time.addEvent({ delay: 110, repeat: 2, callback: () => {
        if (this.decorationEpoch !== epoch || !stillValid(epoch)) return;
        step += 1; this.showPose(step <= 3 ? step : 0);
      } });
    }
    const { originX, originY, cellSize, columns, rows } = this.layout;
    const coordinate = cue.effectAnchor;
    const x = coordinate ? originX + (coordinate.x + .5) * cellSize : originX + columns * cellSize / 2;
    const y = coordinate ? originY + (coordinate.y + .5) * cellSize : originY + rows * cellSize / 2;
    const colors: Record<EffectCue['kind'], number> = {
      move: 0x3b9bcc, flag: 0xd04848, detection: 0x588db8, airplane: 0x6d70d4,
      revive: 0x60b880, lucky: 0xffcf63, benben: 0x8abf87, reward: 0xf4bd45,
      pending: 0xd47064, failure: 0x9a6670, victory: 0xf4bd45, item: 0x6d70d4, saved: 0x698aa0,
    };
    this.decoration.lineStyle(Math.max(2, cellSize * .08), colors[cue.kind], .9);
    if (cue.kind === 'move' && cue.from !== null && cue.committedDestination !== null) {
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
    this.poseTimer?.remove(); this.poseTimer = null;
    this.showPose(0);
    this.decorationTween?.stop();
    this.decorationTween = null;
    this.decoration?.clear();
    this.decorationEpoch = 0;
  }

  private paint(): void {
    if (this.graphics === null) return;
    const g = this.graphics; g.clear();
    this.markers?.clear(); this.explorer?.setVisible(false);
    this.tiles.forEach((tile) => tile.setVisible(false));
    if (this.layout === null || this.attempt === null) return;
    const { originX, originY, cellSize } = this.layout;
    const { width, cells } = this.attempt.board;
    for (const [index, appearance] of cells.entries()) {
      const x = originX + (index % width) * cellSize;
      const y = originY + Math.floor(index / width) * cellSize;
      const s = cellSize;
      if (this.textures.exists('tiles') && appearance !== 'obstacle') {
        const tile = this.tiles[index] ?? this.add.image(0,0,'tiles','unknown').setOrigin(0).setDepth(-1);
        this.tiles[index] = tile;
        tile.setFrame(appearance === 'explored' || appearance === 'revealed-mine' ? 'explored' : 'unknown');
        tile.setPosition(x+.02*s,y+.02*s).setDisplaySize(.96*s,.96*s).setVisible(true);
      } else {
      g.fillStyle(0x77451e).fillRoundedRect(x + .025*s, y + .05*s, .95*s, .93*s, .12*s);
      g.fillStyle(0xba7138).fillRoundedRect(x + .025*s, y + .025*s, .95*s, .91*s, .12*s);
      g.fillStyle(FILL[appearance]).fillRoundedRect(x + .04*s, y + .035*s, .92*s, .85*s, .11*s);
      g.lineStyle(2, 0xffe8ae, .85).strokeRoundedRect(x + .055*s, y + .05*s, .89*s, .81*s, .1*s);
      // Identical material marks for hidden Safe and Mine; no hidden state is consulted.
      g.lineStyle(2, appearance === 'explored' ? 0xd9b987 : 0xc07b3b, .45);
      g.lineBetween(x+.22*s,y+.28*s,x+.35*s,y+.2*s);
      g.fillStyle(appearance === 'explored' ? 0xcaa877 : 0xa86b30, .22);
      g.fillCircle(x+.69*s,y+.63*s,.025*s);
      }
      const m = this.markers!;
      if (appearance === 'flagged') {
        m.lineStyle(2, 0x653717).lineBetween(x+.76*s,y+.09*s,x+.76*s,y+.44*s);
        m.fillStyle(0xd32828).fillTriangle(x+.77*s,y+.08*s,x+.96*s,y+.16*s,x+.77*s,y+.25*s);
      }
      if (appearance === 'revealed-mine') {
        m.fillStyle(0x283345).fillCircle(x+.91*s,y+.14*s,.07*s);
      }
    }
    const position = this.attempt.position;
    if (position.kind !== 'waiting') {
      const x = originX + (position.x + .5) * cellSize;
      const y = originY + position.y * cellSize;
      g.fillStyle(0x77451e, .2).fillEllipse(x, y+.76*cellSize, .64*cellSize, .14*cellSize);
      g.fillStyle(0x77451e, .12).fillEllipse(x, y+.76*cellSize, .72*cellSize, .18*cellSize);
      if (this.explorer) {
        this.explorer.setPosition(x, y+.84*cellSize).setVisible(true); this.showPose(0);
      } else g.fillStyle(0xffcf63).fillCircle(x,y+.5*cellSize,.24*cellSize);
    }
  }

  private showPose(pose: number): void {
    if (!this.explorer || !this.layout) return;
    const index = this.direction * 4 + pose;
    const frame = frames[index]!;
    this.explorer.setFrame(index);
    // Uniform scale per frame preserves anatomy. Every complete paw shares the baseline.
    this.explorer.setScale(Math.min(1.08*this.layout.cellSize/frame.height,
      1.1*this.layout.cellSize/frame.width));
  }
}
