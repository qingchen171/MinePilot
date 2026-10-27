// Design-reference arithmetic only. No production imports, browser, state or writes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const manifest = JSON.parse(readFileSync(new URL('./reference-manifest.json', import.meta.url), 'utf8'));
for (const asset of manifest.acceptedReferences) {
  const bytes = readFileSync(new URL(asset.archiveFile, import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex').toUpperCase(), asset.sha256);
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(bytes.readUInt32BE(16), 1366);
  assert.equal(bytes.readUInt32BE(20), 768);
}
const epsilon = 1e-8;
const inside = (a,b) => a.x >= b.x-epsilon && a.y >= b.y-epsilon &&
  a.x+a.w <= b.x+b.w+epsilon && a.y+a.h <= b.y+b.h+epsilon;
const overlaps = (a,b) => a.x < b.x+b.w-epsilon && a.x+a.w > b.x+epsilon &&
  a.y < b.y+b.h-epsilon && a.y+a.h > b.y+epsilon;
const relative = (x,y,c,[left,top,right,bottom]) =>
  ({x:x+left*c,y:y+top*c,w:(right-left)*c,h:(bottom-top)*c});
const bounds = {
  art: [-.05,-.65,1.05,.90], body: [-.05,-.25,1.05,.90],
  number: [.25,-.65,.67,-.27], surface: [.04,.06,.96,.90],
  feet: [.10,.60,.90,.85], marker: [.72,.06,.98,.46],
};
const positions = [
  ['center',4,4],['top',4,0],['bottom',4,8],['left',0,4],['right',8,4],
  ['top-left',0,0],['top-right',8,0],['bottom-left',0,8],['bottom-right',8,8],
];
const configs = [
  {width:1366,height:768,left:211,baseTop:112,baseSide:600,minimum:64.9,railLeft:835,railWidth:320},
  {width:1280,height:720,left:200,baseTop:104,baseSide:560,minimum:60.4,railLeft:780,railWidth:300},
  {width:1024,height:768,left:100,baseTop:104,baseSide:528,minimum:56.9,railLeft:644,railWidth:280},
  {width:1920,height:1080,left:364,baseTop:136,baseSide:800,minimum:87.1,railLeft:1196,railWidth:360},
];
let exactCases=0, allocatedCases=0;
const rows=[];
for (const cfg of configs) {
  const side=Math.max(cfg.baseSide,9*cfg.minimum+16);
  const allocatedCell=(side-16)/9;
  assert.ok(allocatedCell >= cfg.minimum-epsilon);
  assert.ok(side >= cfg.baseSide-epsilon);
  const gutter=Math.max(0,Math.ceil(.65*allocatedCell)-8+4);
  const lateral=Math.ceil(.05*allocatedCell)+4;
  const top=cfg.baseTop+gutter;
  const outer={x:cfg.left-lateral,y:cfg.baseTop,w:side+2*lateral,h:side+gutter};
  const viewport={x:0,y:0,w:cfg.width,h:cfg.height};
  assert.ok(inside(outer,viewport),'external drawing surface must fit');
  assert.ok(outer.x+outer.w <= cfg.railLeft-4,'rail gap must remain');
  assert.ok(cfg.railLeft+cfg.railWidth <= cfg.width);
  assert.ok(cfg.baseTop+cfg.baseSide <= cfg.height,'rail retains original height');
  for (const [variant,c] of [['exact-minimum',cfg.minimum],['allocated',allocatedCell]]) {
    const inset=(side-9*c)/2;
    for (const [name,column,row] of positions) {
      const x=cfg.left+inset+column*c,y=top+inset+row*c;
      const art=relative(x,y,c,bounds.art),body=relative(x,y,c,bounds.body);
      const number=relative(x,y,c,bounds.number),surface=relative(x,y,c,bounds.surface);
      const feet=relative(x,y,c,bounds.feet);
      assert.ok(inside(art,outer),variant+'/'+name+': exterior clip');
      assert.ok(art.y >= cfg.baseTop+4-epsilon,'header/HUD protection');
      assert.ok(inside(feet,surface),'foot and shadow support');
      assert.ok(inside(surface,{x,y,w:c,h:c}),'top surface in actual cell');
      assert.ok(inside(body,art) && inside(number,art));
      assert.ok(body.y-(number.y+number.h) >= 1-epsilon,'helmet gap');
      assert.ok(number.h >= 16 && number.w >= 14,'minimum text box capacity');
      for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) {
        if ((dx===0 && dy===0) || column+dx<0 || column+dx>8 || row+dy<0 || row+dy>8) continue;
        const marker=relative(x+dx*c,y+dy*c,c,bounds.marker);
        assert.ok(!overlaps(number,marker),'number must not overlap neighbor protected marker');
      }
      // Critical markers/focus are above body; actual pixels are Gate B evidence.
      if (variant==='exact-minimum') exactCases++; else allocatedCases++;
    }
  }
  rows.push({viewport:cfg.width+'x'+cfg.height,minimum:cfg.minimum,
    side:+side.toFixed(3),cell:+allocatedCell.toFixed(6),G:gutter,L:lateral,
    boardTop:top,boardBottom:+(top+side).toFixed(3),
    bottomSpace:+(cfg.height-top-side).toFixed(3)});
}
console.table(rows);
console.log(JSON.stringify({referenceHashesAndDimensions:'PASS',references:manifest.acceptedReferences.length,
  exactMinimumCases:exactCases,allocatedViewportCases:allocatedCases,geometry:'PASS',
  browserInteraction:'NOT RUN',pixelMasksContrastAndAnimation:'NOT CERTIFIED'}));
