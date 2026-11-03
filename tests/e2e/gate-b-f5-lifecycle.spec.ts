import { expect, test } from '@playwright/test';
import { boardBrowserSave } from '../helpers/s5-06-browser-save';

test('real L1 committed move and flags survive repeated immediate F5, then accept new mutations', async ({page},info)=>{
  await page.goto('/');await page.getByRole('button',{name:'Levels',exact:true}).first().click();
  await page.locator('[data-level-id="level-001"]').click();
  await page.locator('[data-cell-index="0"]').click();
  await page.locator('[data-cell-index="80"]').click({button:'right'});
  for(const target of [79,78]){
    const before=await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k])=>k!=='minepilot:persistence:writer-lease'))));
    const revision=await page.evaluate(()=>JSON.parse(localStorage.getItem('minepilot:persistence:head')!).revision);
    await page.reload();await page.getByRole('button',{name:'Continue',exact:true}).click();
    expect(await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k])=>k!=='minepilot:persistence:writer-lease'))))).toBe(before);
    await expect(page.locator('[data-cell-index="80"]')).toHaveAttribute('data-appearance','flagged');
    await page.locator(`[data-cell-index="${target}"]`).click({button:'right'});
    await expect(page.locator(`[data-cell-index="${target}"]`)).toHaveAttribute('data-appearance','flagged');
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('minepilot:persistence:head')!).revision)).toBe(revision+1);
  }
  await page.reload();await page.getByRole('button',{name:'Continue',exact:true}).click();
  const beforeMove=await page.evaluate(()=>JSON.parse(localStorage.getItem('minepilot:persistence:head')!).revision);
  await page.locator('[data-cell-index="1"]').click(); // Safe or pending: both must commit the real command.
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('minepilot:persistence:head')!).revision)).toBe(beforeMove+1);
  await expect(page.locator('#status')).not.toContainText('elsewhere');
  await page.screenshot({path:info.outputPath('f5-playable.png')});
});

test('live foreign owner stays protected and ownership recovery survives Home and Levels',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Levels',exact:true}).first().click();
  await page.locator('[data-level-id="level-001"]').click();
  const head=await page.evaluate(()=>localStorage.getItem('minepilot:persistence:head'));
  const contender=await page.context().newPage();await contender.goto('/');
  await contender.getByRole('button',{name:'Continue',exact:true}).click();
  await contender.locator('[data-cell-index="80"]').click({button:'right'});
  await expect(contender.locator('#status')).toContainText('Another game session');
  for(const route of ['Home','Levels']){
    await contender.getByRole('button',{name:route,exact:true}).first().click();
    await contender.getByRole('button',{name:route==='Home'?'Continue':'Game',exact:true}).first().click();
    await expect(contender.locator('html')).toHaveAttribute('data-page',route.toLowerCase());
    await expect(contender.locator('[data-action="reload"]')).toBeVisible();
    await expect(contender.locator('#page')).toContainText('Another game session');
  }
  expect(await page.evaluate(()=>localStorage.getItem('minepilot:persistence:head'))).toBe(head);
  await contender.close();
  await page.locator('[data-cell-index="80"]').click({button:'right'});
  await expect(page.locator('[data-cell-index="80"]')).toHaveAttribute('data-appearance','flagged');
});

test('mouse target uses warm subtle treatment while keyboard focus remains visible',async({page},info)=>{
  await page.goto('/');await page.getByRole('button',{name:'Levels',exact:true}).first().click();
  await page.locator('[data-level-id="level-001"]').click();
  const cell=page.locator('[data-cell-index="1"]');await cell.hover();
  await expect(cell).toHaveAttribute('data-selected','true');
  expect(await cell.evaluate(n=>getComputedStyle(n).boxShadow)).not.toMatch(/26, 74, 146|32, 93, 197/);
  await cell.focus();await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-cell-index="2"]')).toBeFocused();
  expect(await page.locator('[data-cell-index="2"]').evaluate(n=>getComputedStyle(n).outlineStyle)).not.toBe('none');
  await page.screenshot({path:info.outputPath('warm-target-keyboard-focus.png')});
});

test('committed explorer reconstruction and corrected interaction screenshot',async({page},info)=>{
  // Strict-v4 generated-L1 compatibility fixture; F5 above uses a fresh live history.
  const f=boardBrowserSave('number',{x:4,y:4});
  await page.addInitScript(entries=>{for(const [k,v] of entries)localStorage.setItem(k,v)},f.entries);
  await page.goto('/');await page.getByRole('button',{name:'Continue',exact:true}).click();
  const target=f.moveTarget!;
  await page.locator(`[data-cell-index="${target.y*9+target.x}"]`).click();
  await expect(page.locator(`[data-cell-index="${target.y*9+target.x}"]`)).toHaveAttribute('data-character','true');
  await expect(page.locator('#status')).toHaveText('Character move saved.');
  await page.screenshot({path:info.outputPath('movement-without-blue-ghost.png')});
});
