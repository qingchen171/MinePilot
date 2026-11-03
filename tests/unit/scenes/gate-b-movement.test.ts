import { expect, it, vi } from 'vitest';
vi.mock('phaser',()=>({default:{Scene:class {}}}));
import { BoardScene } from '../../../src/scenes/board-scene';
import type { EffectCue } from '../../../src/ui/effect-cues';

it('committed move changes registered pose, with no line, circle or decoration tween',()=>{
 const decoration={clear:vi.fn(),lineStyle:vi.fn(),lineBetween:vi.fn(),strokeCircle:vi.fn(),setAlpha:vi.fn()};
 const pose=vi.fn(),addEvent=vi.fn(()=>({remove:vi.fn()})),tween=vi.fn();
 const scene=new BoardScene();
 Object.assign(scene,{decoration,layout:{originX:0,originY:0,cellSize:64,columns:9,rows:9},
   attempt:{position:{kind:'on-board',x:4,y:4}},showPose:pose,time:{addEvent},tweens:{add:tween}});
 const cue={kind:'move',from:{x:0,y:0},effectAnchor:{x:4,y:4},committedDestination:{x:4,y:4}} as EffectCue;
 scene.playEffect(cue,1,()=>true);
 expect(pose).toHaveBeenCalledWith(1);expect(addEvent).toHaveBeenCalledOnce();
 expect(decoration.lineBetween).not.toHaveBeenCalled();expect(decoration.strokeCircle).not.toHaveBeenCalled();
 expect(tween).not.toHaveBeenCalled();
 scene.cancelEffect();expect(pose).toHaveBeenLastCalledWith(0);
});
