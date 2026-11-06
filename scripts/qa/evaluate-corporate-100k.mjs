/** Frozen corporate audit through unchanged app strategies, with explicit request accounting. */
import {readFileSync,writeFileSync,appendFileSync,mkdirSync,existsSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {getStrategyRegistry} from '../../lib/strategies/bootstrap.ts';
const arg=k=>process.argv.find(v=>v.startsWith('--'+k+'='))?.slice(k.length+3);
const corpus=resolve(arg('corpus')??'data/qa/corporate-100k-2026-11-06'),out=resolve(arg('out')??'artifacts/qa/corporate-100k-20261106/node');
const sha=b=>createHash('sha256').update(b).digest('hex');
const comparable=s=>s.normalize('NFC').replace(/\s+/gu,' ').trim();
const manifest=JSON.parse(readFileSync(corpus+'/MANIFEST.json','utf8')),compressed=readFileSync(corpus+'/cases.jsonl.gz'),raw=gunzipSync(compressed);
if(sha(raw)!==manifest.corpusSHA256||sha(compressed)!==manifest.gzipSHA256)throw Error('Frozen input integrity failed');
const rows=raw.toString().trim().split('\n').map(JSON.parse);if(rows.length!==1000||rows.reduce((s,r)=>s+r.inputWords,0)!==100000)throw Error('Incomplete100k-word corpus');
if(existsSync(out))throw Error('Use a fresh output directory');mkdirSync(out,{recursive:true});
const files=execFileSync('rg',['--files','lib/editor','lib/strategies','lib/workers','app'],{encoding:'utf8'}).trim().split('\n').filter(p=>/\.(?:tsx?|json)$/.test(p)).sort();
const runtimeSHA256=Object.fromEntries(files.map(p=>[p,sha(readFileSync(p))]));
writeFileSync(out+'/RUN_SOURCE.json',JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),corpusSHA256:manifest.corpusSHA256,runtimeSHA256,startedAtUTC:new Date().toISOString(),inferencePolicy:'Actual full application strategies, no ablation/threshold/weight changes. 1000first passes+1000repeat verification calls.'},null,2)+'\n');
writeFileSync(out+'/results.jsonl','');const started=performance.now();
const totals={requests:0,inputWords:0,strictExact:0,repeatStable:0,exceptions:0,allThreeAutomatic:0,literalsPreserved:0,literalCases:0,charRankedTokens:0,charCandidates:0,punctCaseProposed:0,punctCaseApplied:0};
const domains={},variants={};
for(const [i,row] of rows.entries()){
 let actual='',repeated='',metadata,error;const start=performance.now();
 try{
  const strategy=getStrategyRegistry().get(row.module==='mail'?'gmail-corrector':'text-corrector');
  const result=await strategy.transform({text:row.input,options:row.options});actual=result.transformedText;metadata=result.metadata;
  repeated=(await strategy.transform({text:actual,options:row.options})).transformedText;
 }catch(cause){error=String(cause);}
 const strictExact=!error&&comparable(actual)===comparable(row.expected),repeatStable=!error&&comparable(actual)===comparable(repeated);
 const literalPreserved=row.protectedLiterals.every(s=>actual.includes(s));
 const allThreeAutomatic=!error&&['wordLM','charSpell','punctCase'].every(k=>metadata?.[k]?.loaded===true&&metadata[k].mode==='automatic');
 const record={id:row.id,domain:row.domain,module:row.module,variant:row.variant,inputWords:row.inputWords,actual,repeated,strictExact,repeatStable,literalPreserved,allThreeAutomatic,elapsedMs:performance.now()-start,...(error?{error}:{}),metadata};
 appendFileSync(out+'/results.jsonl',JSON.stringify(record)+'\n');
 totals.requests++;totals.inputWords+=row.inputWords;totals.strictExact+=+strictExact;totals.repeatStable+=+repeatStable;totals.exceptions+=+Boolean(error);totals.allThreeAutomatic+=+allThreeAutomatic;totals.literalCases+=+Boolean(row.protectedLiterals.length);totals.literalsPreserved+=+(Boolean(row.protectedLiterals.length)&&literalPreserved);totals.charRankedTokens+=metadata?.charSpell?.rankedTokens??0;totals.charCandidates+=metadata?.charSpell?.candidatesScored??0;totals.punctCaseProposed+=metadata?.punctCase?.proposed??0;totals.punctCaseApplied+=metadata?.punctCase?.applied??0;
 for(const [map,key] of [[domains,row.domain],[variants,row.variant]]){const t=map[key]??={requests:0,strictExact:0,repeatStable:0,exceptions:0};t.requests++;t.strictExact+=+strictExact;t.repeatStable+=+repeatStable;t.exceptions+=+Boolean(error);}
 if((i+1)%25===0){const progress={...totals,completed:i+1,total:rows.length,elapsedSeconds:(performance.now()-started)/1000};writeFileSync(out+'/progress.json',JSON.stringify(progress,null,2)+'\n');writeFileSync(out+'/results.jsonl.gz',gzipSync(readFileSync(out+'/results.jsonl')));console.log(JSON.stringify(progress));}
}
const report={scope:'Assistant-authored compositional corporate audit; strict frozen-reference matching here, separate manual assistant adjudication later. Not independent human/real-user accuracy.',corpusSHA256:manifest.corpusSHA256,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),totals,domains,variants,firstPassRequests:1000,repeatVerificationRequests:1000,totalTransformationCalls:2000,elapsedSeconds:(performance.now()-started)/1000,resultsSHA256:sha(readFileSync(out+'/results.jsonl')),completedAtUTC:new Date().toISOString()};
writeFileSync(out+'/summary.json',JSON.stringify(report,null,2)+'\n');writeFileSync(out+'/results.jsonl.gz',gzipSync(readFileSync(out+'/results.jsonl')));console.log(JSON.stringify(report,null,2));
if(totals.exceptions||totals.allThreeAutomatic!==1000)process.exitCode=1;
