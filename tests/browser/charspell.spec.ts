import {test,expect} from '@playwright/test';
import info from '../../lib/editor/charspell/model-info.json';
test('CharSpell runs in the actual editor Worker for text and mail without activation',async({page,context})=>{
 const api:string[]=[];context.on('request',r=>{if(r.url().includes('/api/transform'))api.push(r.url())});
 await page.goto('/');
 for(const editorModule of ['text','mail']){
  if(editorModule==='mail')await page.getByRole('button',{name:'Mail Düzəldici',exact:true}).click();
  await page.getByRole('textbox',{name:editorModule==='text'?'Xam mətn':'Qaralama',exact:true}).fill('qapi aciqdir');
  await page.getByRole('button',{name:'Düzəlt',exact:true}).click();
  await expect(page.locator('.workspace-output pre')).toContainText('Qapı açıqdır.');
  const log=await page.evaluate(()=>JSON.parse(localStorage.getItem('slothai-transform-log-v1')??'[]').at(-1));
  expect(log.modelUsage.charSpell.mode).toBe('automatic');expect(log.modelUsage.charSpell.loaded).toBe(true);
  expect(log.modelUsage.charSpell.sourceCheckpointSHA256).toBe(info.sourceCheckpointSHA256);
  expect(log.modelUsage.charSpell.rankedTokens).toBeGreaterThan(0);expect(log.modelUsage.charSpell.candidatesScored).toBeGreaterThan(0);
  expect(log.modelUsage.wordLM.mode).toBe('automatic');expect(log.modelUsage.punctCase.loaded).toBe(true);
 }
 expect(api).toEqual([]);expect(page.workers().length).toBeGreaterThan(0);
});
