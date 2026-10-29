import { expect, test } from '@playwright/test';
import { boardBrowserSave } from '../helpers/s5-06-browser-save';
import frames from '../../src/config/explorer-frames';

const positions = [[0,0],[4,0],[8,0],[0,4],[4,4],[8,4],[0,8],[4,8],[8,8]] as const;
for (const [width,height,minimum] of [[1366,768,64.9],[1280,720,60.4],[1024,768,56.9],[1920,1080,87.1]] as const) {
  test(`Gate B ${width}x${height}: valid generated L1 corner/edge saves, badge, focus and pointer ownership`, async ({ browser }, info) => {
    const context = await browser.newContext({ viewport:{width,height} });
    for (const [x,y] of positions) {
      // Strict preloaded v4 compatibility fixture; not a claim of nine continuous player journeys.
      const fixture = boardBrowserSave('number',{x,y}); const page = await context.newPage();
      await page.addInitScript((entries) => { localStorage.clear(); for(const [key,value] of entries) localStorage.setItem(key,value); }, fixture.entries);
      await page.goto('/'); await page.locator('[data-action="continue"]').click();
      await expect(page.locator('html')).toHaveAttribute('data-phaser-ready','true');
      const cell = page.locator(`[data-cell-index="${y*9+x}"]`); const badge=page.locator('.board-number-badge');
      await expect(badge).toHaveText(String(fixture.expectedNumber));
      await expect(page.locator('.board-number-badge:visible')).toHaveCount(1);
      const typography = await badge.evaluate(node => {
        const style = getComputedStyle(node);
        const luminance = (css: string) => {
          const rgb = css.match(/[\d.]+/g)!.slice(0,3).map(Number).map(v => v/255)
            .map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
          return .2126*rgb[0]!+.7152*rgb[1]!+.0722*rgb[2]!;
        };
        const a=luminance(style.color), b=luminance(style.backgroundColor);
        return { size:parseFloat(style.fontSize), line:parseFloat(style.lineHeight),
          contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05) };
      });
      expect(typography.size).toBeGreaterThanOrEqual(14);
      expect(typography.line).toBeGreaterThanOrEqual(16);
      expect(typography.contrast).toBeGreaterThanOrEqual(4.5);
      const c=(await cell.boundingBox())!, n=(await badge.boundingBox())!;
      expect(Math.abs(c.width-c.height)).toBeLessThan(.1); expect(c.width).toBeGreaterThanOrEqual(minimum-.02);
      expect(n.y).toBeGreaterThanOrEqual(104); expect(n.x).toBeGreaterThanOrEqual(c.x+.25*c.width-.1);
      expect(n.y+n.height).toBeLessThan(c.y-.26*c.width);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.keyboard.press('Tab'); await cell.focus(); await expect(cell).toBeFocused();
      expect(await cell.evaluate(e=>getComputedStyle(e).outlineStyle)).not.toBe('none');
      const canvas = (await page.locator('#game-stage canvas').boundingBox())!;
      expect(c.x).toBeGreaterThanOrEqual(canvas.x); expect(c.y).toBeGreaterThanOrEqual(canvas.y);
      expect(c.x+c.width).toBeLessThanOrEqual(canvas.x+canvas.width+1);
      expect(c.y+c.height).toBeLessThanOrEqual(canvas.y+canvas.height+1);
      const hit=await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('[data-cell-index]')?.getAttribute('data-cell-index'),
        {x:c.x+c.width/2,y:c.y+c.height/2}); expect(hit).toBe(String(y*9+x));
      if(y>0){ const underlying=await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('[data-cell-index]')?.getAttribute('data-cell-index'),
        {x:n.x+n.width/2,y:n.y+n.height/2}); expect(underlying).toBe(String((y-1)*9+x)); }
      if(x===4&&y===4) await page.screenshot({path:info.outputPath(`gate-b-${width}x${height}.png`)});
      await page.close();
    }
    await context.close();
  });
}

test('Gate B source atlas: sixteen lower-paw bands and bottom-cut checks supplement visual anatomy review', async({page})=>{
  await page.goto('/');
  const proof=await page.evaluate(async(frames)=>{
    const img=new Image(); img.src='/src/assets/explorer/explorer-atlas.png'; await img.decode();
    const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;
    const ctx=canvas.getContext('2d')!;ctx.drawImage(img,0,0);const pixels=ctx.getImageData(0,0,img.width,img.height).data;
    return frames.map(f=>{
      const scale=Math.min(1.08/f.height,1.1/f.width),left=.5-f.width*scale/2,top=.84-f.height*scale;
      let solidPaw=0,spilled=0,bottomCut=0;
      for(let y=0;y<f.height;y++)for(let x=0;x<f.width;x++){
        const alpha=pixels[((f.y+y)*img.width+f.x+x)*4+3]!;
        if(alpha>=64&&y===f.height-1)bottomCut++;
        // Conservative lower-paw band; upper anatomical masks additionally require visual review.
        if(alpha>=16&&top+y*scale>=.70){solidPaw++;if(left+x*scale<.10||left+x*scale>.90||top+y*scale>.85)spilled++;}
      }
      return {solidPaw,spilled,bottomCut};
    });
  },frames);
  expect(proof).toHaveLength(16);
  for(const frame of proof){ expect(frame.solidPaw).toBeGreaterThan(100);expect(frame.spilled).toBe(0);expect(frame.bottomCut).toBe(0); }
});

test('Gate B real Phaser explorer survives rapid committed moves, interruption, route and F5; live text ignores redraw', async ({ page }) => {
  const fixture=boardBrowserSave('number',{x:4,y:4});
  await page.addInitScript(entries=>{
    if(sessionStorage.getItem('gate-b-installed'))return;
    for(const [k,v] of entries)localStorage.setItem(k,v);
    sessionStorage.setItem('gate-b-installed','yes');
  },fixture.entries);
  await page.goto('/'); await page.locator('[data-action="continue"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-phaser-ready','true');
  const announcement=page.locator('.board-current-announcement');
  await expect(announcement).toHaveText(`Character at row 5, column 5. Nearby mines: ${fixture.expectedNumber}.`);
  await announcement.evaluate(node=>{
    (window as unknown as { liveChanges:number }).liveChanges=0;
    new MutationObserver(()=>{(window as unknown as {liveChanges:number}).liveChanges++})
      .observe(node,{childList:true,characterData:true,subtree:true});
  });
  await page.setViewportSize({width:1024,height:768});
  await page.setViewportSize({width:1366,height:768});
  expect(await page.evaluate(()=>(window as unknown as {liveChanges:number}).liveChanges)).toBe(0);
  const initial=await page.evaluate(()=>JSON.parse(localStorage.getItem('minepilot:persistence:head')!).revision);
  const target=fixture.moveTarget!;
  await page.locator(`[data-cell-index="${target.y*9+target.x}"]`).click();
  await page.locator('[data-cell-index="40"]').click();
  await page.evaluate(()=>dispatchEvent(new Event('resize'))); // Cancels the older pose, not the commit.
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('minepilot:persistence:head')!).revision)).toBe(initial+2);
  expect(await page.evaluate(()=>(window as unknown as {liveChanges:number}).liveChanges)).toBe(2);
  async function actualExplorerPixels() {
    await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur()});
    await page.mouse.move(2,2);
    await expect.poll(async()=>{
      const screenshot=await page.locator('#game-stage canvas').screenshot();
      return page.evaluate(async({bytes,frame})=>{
        const shot=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/png'}));
        const capture=document.createElement('canvas');capture.width=shot.width;capture.height=shot.height;
        const actual=capture.getContext('2d')!;actual.drawImage(shot,0,0);shot.close();
        const atlas=new Image();atlas.src='/src/assets/explorer/explorer-atlas.png';await atlas.decode();
        const source=document.createElement('canvas');source.width=atlas.width;source.height=atlas.height;
        const expected=source.getContext('2d')!;expected.drawImage(atlas,0,0);
        const bounds=document.querySelector('#game-stage canvas')!.getBoundingClientRect();
        const cell=document.querySelector('[data-cell-index="40"]')!.getBoundingClientRect();
        const scale=Math.min(1.08*cell.width/frame.height,1.1*cell.width/frame.width);
        let checked=0,matching=0;
        for(const fx of [.35,.45,.55,.65])for(const fy of [.3,.4,.5,.6,.7]){
          const sx=Math.floor(frame.width*fx),sy=Math.floor(frame.height*fy);
          const want=expected.getImageData(frame.x+sx,frame.y+sy,1,1).data;
          if(want[3]!<250)continue;
          const x=(cell.x+cell.width/2-frame.width*scale/2+sx*scale-bounds.x)*capture.width/bounds.width;
          const y=(cell.y+.84*cell.width-frame.height*scale+sy*scale-bounds.y)*capture.height/bounds.height;
          const got=actual.getImageData(Math.floor(x),Math.floor(y),1,1).data;
          checked++;if([0,1,2].every(i=>Math.abs(want[i]!-got[i]!)<40))matching++;
        }
        return checked>=12&&matching/checked>=.8;
      },{bytes:[...screenshot],frame:frames[0]!});
    },{timeout:15_000,message:'actual committed center-cell explorer matches its registered opaque atlas interior'}).toBe(true);
  }
  await actualExplorerPixels();
  await page.getByRole('button',{name:'Home',exact:true}).click();
  await page.locator('[data-action="continue"]').click(); await actualExplorerPixels();
  await page.reload(); await page.locator('[data-action="continue"]').click(); await actualExplorerPixels();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('minepilot:persistence:head')!).revision)).toBe(initial+2);
});

test('Gate B pending Revive and Failure are immediately visible together at 1024x768',async({page})=>{
  await page.setViewportSize({width:1024,height:768});
  await page.addInitScript(entries=>{for(const [k,v]of entries)localStorage.setItem(k,v)},boardBrowserSave('pending').entries);
  await page.goto('/');await page.locator('[data-action="continue"]').click();
  for(const action of ['revive','failure']){
    const button=page.locator(`.game-decisions [data-game-action="${action}"]`);
    const bounds=(await button.boundingBox())!;expect(bounds.y+bounds.height).toBeLessThan(768);
    expect(await button.evaluate(node=>{
      const r=node.getBoundingClientRect();return node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
    })).toBe(true);
  }
  expect(await page.locator('#game-controls').evaluate(node=>node.scrollTop)).toBe(0);
});
