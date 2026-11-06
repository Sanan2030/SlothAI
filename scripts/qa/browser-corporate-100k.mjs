/** 1,000 actual browser editor Worker transformations, including one real UI click. */
import {chromium} from '@playwright/test';
import {appendFileSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const arg=k=>process.argv.find(x=>x.startsWith('--'+k+'='))?.slice(k.length+3);
const corpus=resolve(arg('corpus')??'data/qa/corporate-100k-2026-11-06'),root=resolve(arg('out')??'artifacts/qa/corporate-100k-20261106/browser'),node=resolve(arg('node')??'artifacts/qa/corporate-100k-20261106/node');
const url=arg('url')??'http://127.0.0.1:3121';if(!['localhost','127.0.0.1'].includes(new URL(url).hostname))throw Error('Local audit only');
const hash=b=>createHash('sha256').update(b).digest('hex'),manifest=JSON.parse(readFileSync(corpus+'/MANIFEST.json','utf8')),raw=gunzipSync(readFileSync(corpus+'/cases.jsonl.gz'));
if(hash(raw)!==manifest.corpusSHA256)throw Error('Frozen input mismatch');const rows=raw.toString().trim().split('\n').map(JSON.parse);
const nodeSummary=JSON.parse(readFileSync(node+'/summary.json','utf8')),nodeBytes=readFileSync(node+'/results.jsonl');if(hash(nodeBytes)!==nodeSummary.resultsSHA256)throw Error('Node receipt mismatch');
const baseline=new Map(nodeBytes.toString().trim().split('\n').map(JSON.parse).map(r=>[r.id,r]));if(rows.length!==1000||baseline.size!==1000)throw Error('Incomplete audit');
mkdirSync(root,{recursive:false});writeFileSync(root+'/results.jsonl','');
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH??'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage();let transformHTTPRequests=0;const errors=[];page.on('request',r=>{if(new URL(r.url()).pathname==='/api/transform')transformHTTPRequests++});page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript({content:`globalThis.__name=fn=>fn;window.__qaWorkers=[];window.__qaEditorPosts=0;window.Worker=new Proxy(window.Worker,{construct(Target,args){const worker=Reflect.construct(Target,args),record={worker,editor:false},post=worker.postMessage.bind(worker);worker.postMessage=(data,...rest)=>{if(Number.isSafeInteger(data?.id)&&data.strategyId)window.__qaEditorPosts++;return post(data,...rest)};worker.addEventListener('message',event=>{if(Number.isSafeInteger(event.data?.id)&&event.data?.result?.metadata?.strategyUsed)record.editor=true});window.__qaWorkers.push(record);return worker}});`});
 await page.goto(url);const probe=rows[0];if(probe.module==='mail'){
  await page.getByRole('button',{name:'Mail Düzəldici',exact:true}).click();
  await page.getByLabel('Salamlaşma',{exact:true}).selectOption(probe.options.emailGreeting);
 }
 await page.getByRole('textbox',{name:probe.module==='mail'?'Qaralama':'Xam mətn',exact:true}).fill(probe.input);
 const started=performance.now();await page.getByRole('button',{name:'Düzəlt',exact:true}).click();await page.locator('.workspace-output pre').waitFor();
 const probeText=await page.locator('.workspace-output pre').textContent(),log=await page.evaluate(()=>JSON.parse(localStorage.getItem('slothai-transform-log-v1')??'[]').at(-1));
 const totals={requests:0,inputWords:0,nodeParityDifferences:0,exceptions:0,allThreeAutomatic:0};
 function record(row,result){
  const on=!result.error&&['wordLM','charSpell','punctCase'].every(k=>result.metadata?.[k]?.loaded===true&&result.metadata[k].mode==='automatic');
  const parity=result.actual===baseline.get(row.id).actual;totals.requests++;totals.inputWords+=row.inputWords;totals.nodeParityDifferences+=+!parity;totals.exceptions+=+Boolean(result.error);totals.allThreeAutomatic+=+on;
  appendFileSync(root+'/results.jsonl',JSON.stringify({id:row.id,module:row.module,...result,nodeParity:parity,allThreeAutomatic:on})+'\n');
 }
 record(probe,{actual:probeText,metadata:log.modelUsage,via:'UI-click'});
 const probeOnly=process.argv.includes('--probe-only');
 for(let offset=1;!probeOnly&&offset<rows.length;offset+=25){
  const batch=rows.slice(offset,offset+25);
  const results=await page.evaluate(async({batch,offset})=>{
   const editor=window.__qaWorkers.find(r=>r.editor)?.worker;if(!editor)throw Error('Missing UI-created editor Worker');const results=[];
   for(const [at,row] of batch.entries()){
    const id=-2_000_000-offset-at;
    const response=await new Promise((resolve,reject)=>{
     const timer=setTimeout(()=>{editor.removeEventListener('message',listener);reject(Error('Editor Worker timeout'))},60000);
     function listener(event){if(event.data?.id!==id)return;clearTimeout(timer);editor.removeEventListener('message',listener);resolve(event.data)}
     editor.addEventListener('message',listener);editor.postMessage({id,strategyId:row.module==='mail'?'gmail-corrector':'text-corrector',request:{text:row.input,options:row.options}});
    });results.push({actual:response.result?.transformedText??'',metadata:response.result?.metadata,...(response.error?{error:response.error}:{}),via:'UI-created-editor-Worker'});
   }return results;
  },{batch,offset});
  batch.forEach((row,i)=>record(row,results[i]));
  writeFileSync(root+'/results.jsonl.gz',gzipSync(readFileSync(root+'/results.jsonl')));writeFileSync(root+'/progress.json',JSON.stringify(totals,null,2)+'\n');console.log(JSON.stringify({...totals,elapsedSeconds:(performance.now()-started)/1000}));
 }
 const editorPosts=await page.evaluate(()=>window.__qaEditorPosts);
 writeFileSync(root+'/results.jsonl.gz',gzipSync(readFileSync(root+'/results.jsonl')));
 const report={scope:probeOnly?'One configured actual UI recheck; see exact request accounting.':'1000real production editor Worker transformations, first via actual UI and remaining999sent through that same UI-created Worker; not1000DOM clicks.',corpusSHA256:manifest.corpusSHA256,nodeResultsSHA256:nodeSummary.resultsSHA256,totals,editorTransformationPosts:editorPosts,transformHTTPRequests,pageErrors:errors,browser:browser.version(),elapsedSeconds:(performance.now()-started)/1000,resultsSHA256:hash(readFileSync(root+'/results.jsonl')),completedAtUTC:new Date().toISOString()};
 writeFileSync(root+'/summary.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 if(editorPosts!==(probeOnly?1:1000)||totals.nodeParityDifferences||totals.exceptions||totals.allThreeAutomatic!==(probeOnly?1:1000)||transformHTTPRequests||errors.length)process.exitCode=1;
}finally{await browser.close()}
