/** Offline factorial ablation. Never changes application source or adds UI switches. */
import {build} from 'esbuild';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const arg=key=>process.argv.find(x=>x.startsWith('--'+key+'='))?.slice(key.length+3);
const root=resolve(arg('out')??'artifacts/qa/model-contributions-20261106');
const hash=value=>createHash('sha256').update(value).digest('hex');
const read=path=>JSON.parse(readFileSync(path,'utf8'));
const save=(name,value)=>writeFileSync(resolve(root,name),JSON.stringify(value,null,2)+'\n');
const comparable=value=>value.normalize('NFC').replace(/\s+/gu,' ').trim();
const words=value=>(value.normalize('NFC').match(/\p{L}+/gu)??[]).map(w=>w.toLocaleLowerCase('az-AZ')).join(' ');
const variants=Array.from({length:8},(_,mask)=>({id:`w${+Boolean(mask&4)}c${+Boolean(mask&2)}p${+Boolean(mask&1)}`,wordLM:Boolean(mask&4),charSpell:Boolean(mask&2),punctCase:Boolean(mask&1)}));
const require=createRequire(import.meta.url);
const script=fileURLToPath(import.meta.url);
const provenance={
 scope:'Paired offline decision ablation on authored development/engineering references, not blind or representative real-user accuracy.',
 wordLM:'Remove trained n-gram scores, OOV penalty, empirical context corrections/evidence and legacy fallback. Keep source vocabulary, morphology, lexical constraints and candidate retrieval fixed. This measures WordLM probabilistic/contextual decisions, not its entire lexical-data contribution.',
 charSpell:'Omit the learned character scorer in both baseline and PunctCase stability verification. Keep candidates/linguistic constraints fixed.',
 punctCase:'Omit only the automatic PunctCase proposal and acceptance/stability stage.',
 baseline:'All older models, reviewed rules, dictionary, source vocabulary and formatting remain. w0c0p0 is not a model-free or regex-only baseline.',
 interactions:'Benefits are conditional on the other components. Leave-one-out, standalone-on-fixed-baseline and Shapley attribution are different quantities.',
 latency:'Corpus timings share CPU and caches; isolated warm benchmark is reported separately. No latency claims from concurrent corpus timing.',
};

function replaceOnce(source,before,after){
 if(source.split(before).length!==2)throw Error('Ablation source marker changed: '+before);
 return source.replace(before,after);
}
async function bundle(variant){
 const receipt=[];
 await build({entryPoints:['lib/strategies/bootstrap.ts'],outfile:resolve(root,'bundles',variant.id+'.cjs'),bundle:true,format:'cjs',platform:'node',target:'node20',logLevel:'silent',plugins:[{
  name:'audited-offline-ablation',setup(builder){
   if(variant.removeWordLMLexicon)builder.onLoad({filter:/lib[\\/]editor[\\/]wordlm[\\/]lexical-evidence\.ts$/},args=>{
    const original=readFileSync(args.path,'utf8');
    const contents=replaceOnce(original,"import artifact from './model.json';",'const artifact={words:[] as string[]};');
    receipt.push({file:args.path,originalSHA256:hash(original),instrumentedSHA256:hash(contents),scope:'Only trained vocabulary data removed. All attestation/restoration function bodies and their general dictionary/morphology paths remain unchanged.'});
    return {contents,loader:'ts'};
   });
   if(variant.trace)builder.onLoad({filter:/lib[\\/]editor[\\/]wordlm[\\/]selection\.ts$/},args=>{
    const original=readFileSync(args.path,'utf8');let contents=original;
    const guard='if (validRaw && !options.diagnostics && !constraint && !repeats.length && !sourceCandidates.some(r=>r.surface!==raw) && !attested.some(word => word !== raw)) return current;';
    contents=replaceOnce(contents,guard,guard.replace('return current;',"{globalThis.__slothContributionTrace?.({kind:'skipped',raw:rawSurface,rawStart:origin.index,current,reason:'validRaw fast path'});return current;}"));
    const marker="options.diagnostics?.({ kind: 'candidates', source: 'wordlm-selection'";
    contents=replaceOnce(contents,marker,"globalThis.__slothContributionTrace?.({kind:'ranked',raw:rawSurface,rawStart:origin.index,current,selected:surface,reason,candidates,proposals:[...proposals.keys()],charRows,left,right});\n    "+marker);
    receipt.push({file:args.path,originalSHA256:hash(original),instrumentedSHA256:hash(contents),scope:'Observability only. Existing diagnostics flag/fast paths are preserved.'});
    return {contents,loader:'ts'};
   });
   builder.onLoad({filter:/lib[\\/]strategies[\\/]impl[\\/](?:text|gmail)-corrector\.ts$/},args=>{
    const original=readFileSync(args.path,'utf8');let contents=original;
    if(!variant.charSpell){
     contents=replaceOnce(contents,'const charModel = await loadCharSpell();','const charModel = undefined;');
     if(contents.split('createCharSpellInference(charModel)').length!==3)throw Error('Both CharSpell call sites required');
     contents=contents.replaceAll('createCharSpellInference(charModel)','undefined');
     contents=replaceOnce(contents,'charSpell: charSpell.stats','charSpell: undefined');
    }
    if(!variant.punctCase){
     const start=contents.indexOf('const enhanced = await automaticPunctCase('),end=contents.indexOf('const result = enhanced.correction;',start);
     if(start<0||end<start)throw Error('PunctCase stage marker missing');
     contents=contents.slice(0,start)+'const enhanced = {correction: baseline};\n    '+contents.slice(end);
    }
    receipt.push({file:args.path,originalSHA256:hash(original),instrumentedSHA256:hash(contents)});
    return {contents,loader:'ts'};
   });
   if(!variant.wordLM){
    builder.onLoad({filter:/lib[\\/]editor[\\/]wordlm[\\/]runtime\.ts$/},args=>{
     const original=readFileSync(args.path,'utf8');let contents=original;
     contents=replaceOnce(contents,'return model.rank(left, candidates, right);',`return [...new Set(candidates)].slice(0,8).map(word=>({word,score:0,evidence:false,bridgeEvidence:false})).sort((a,b)=>a.word.localeCompare(b.word,'az'));`);
     contents=replaceOnce(contents,"return model.hasWord(word) ? 0 : Math.log(model.vocabularySize);",'return 0;');
     // Keep monitoring unchanged: it cannot alter a selected output. Static
     // vocabulary still supports retrieval and morphology, deliberately fixed.
     receipt.push({file:args.path,originalSHA256:hash(original),instrumentedSHA256:hash(contents)});
     return {contents,loader:'ts'};
    });
    builder.onLoad({filter:/lib[\\/]editor[\\/]wordlm[\\/]context-runtime\.ts$/},args=>{
     const original=readFileSync(args.path,'utf8');
     const contents=replaceOnce(original,'return model.adjustments(folded(raw), left, right, candidates);','return [];');
     receipt.push({file:args.path,originalSHA256:hash(original),instrumentedSHA256:hash(contents)});
     return {contents,loader:'ts'};
    });
   }
  },
 }]});
 save('bundles/'+variant.id+'.receipt.json',{variant,...provenance,files:receipt,bundleSHA256:hash(readFileSync(resolve(root,'bundles',variant.id+'.cjs')))});
}

async function prepare(){
 if(existsSync(resolve(root,'MANIFEST.json')))throw Error('Use a fresh output directory; frozen manifest exists');
 mkdirSync(resolve(root,'bundles'),{recursive:true});
 const {loadNovelCorpus}=await import('./corpus.ts');
 const loaded=loadNovelCorpus('data/qa/novel-10000-2026-11-04');
 const cases=loaded.rows.map(row=>({...row,set:'development-10000',category:row.variant}));
 const sourceFiles=['data/qa/novel-10000-2026-11-04/MANIFEST.json','data/qa/novel-10000-2026-11-04/cases.jsonl.gz','data/qa/novel-10000-2026-11-04/GOLD_REVIEW.json'];
 for(const set of ['holdout-500','no-harm-2000','calibration-100']){
  const file=`data/evaluation/phase0/${set}.json`;sourceFiles.push(file);
  for(const row of read(file).cases)cases.push({...row,set,module:'text',options:{}});
 }
 const punctuation='tests/fixtures/punctuation-holdout.json';sourceFiles.push(punctuation);
 for(const row of read(punctuation).cases)cases.push({...row,set:'punctuation-336',module:row.mode==='email'?'mail':'text',options:{}});
 const probes='data/evaluation/model-contributions/punctuation-contrasts-2026-11-06.json';sourceFiles.push(probes);
 for(const row of read(probes).cases)cases.push({...row,set:'punctuation-contrasts-40',module:'text',options:{}});
 if(new Set(cases.map(row=>row.set+'/'+row.id)).size!==cases.length)throw Error('Duplicate case key');
 const bytes=cases.map(row=>JSON.stringify(row)).join('\n')+'\n';writeFileSync(resolve(root,'cases.jsonl.gz'),gzipSync(bytes));
 const files=execFileSync('rg',['--files','lib/editor','lib/strategies'],{encoding:'utf8'}).trim().split('\n').filter(p=>/\.(?:json|ts)$/.test(p)).sort();
 save('MANIFEST.json',{...provenance,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),createdAtUTC:new Date().toISOString(),cases:cases.length,distinctInputs:new Set(cases.map(r=>r.input)).size,sets:Object.fromEntries([...new Set(cases.map(r=>r.set))].map(set=>[set,cases.filter(r=>r.set===set).length])),casesSHA256:hash(bytes),sourceFilesSHA256:Object.fromEntries(sourceFiles.map(p=>[p,hash(readFileSync(p))])),runtimeSHA256:Object.fromEntries(files.map(p=>[p,hash(readFileSync(p))])),frozenCorpusSHA256:loaded.manifest.corpusSHA256,goldReviewSHA256:loaded.goldReviewSHA256,reviewedTargetsSHA256:loaded.reviewedTargetsSHA256,variants});
 for(const variant of variants)await bundle(variant);
 console.log(JSON.stringify({stage:'prepared',cases:cases.length,variants:8,root}));
}
function loadCases(){const bytes=gunzipSync(readFileSync(resolve(root,'cases.jsonl.gz')));if(hash(bytes)!==read(resolve(root,'MANIFEST.json')).casesSHA256)throw Error('Frozen case digest changed');return bytes.toString().trim().split('\n').map(JSON.parse);}

async function evaluate(override){
 const variant=override??variants.find(v=>v.id===arg('variant'));if(!variant)throw Error('Unknown --variant');
 const out=resolve(root,variant.id);mkdirSync(out,{recursive:false});
 const registry=require(resolve(root,'bundles',variant.id+'.cjs')).getStrategyRegistry();
 const rows=loadCases();const totals={};const started=performance.now();const records=[];
 for(const [i,row] of rows.entries()){
  const total=totals[row.set]??={cases:0,exact:0,wordExact:0,identityInputs:0,identityPreserved:0,exceptions:0,changedFromInput:0,charSpellRankedTokens:0,charSpellCandidatesScored:0,punctCaseProposed:0,punctCaseApplied:0,punctCaseRejected:0};
  let actual='',metadata,error;const time=performance.now();
  try{const result=await registry.get(row.module==='mail'?'gmail-corrector':'text-corrector').transform({text:row.input,options:row.options});actual=result.transformedText;metadata=result.metadata;}catch(e){error=String(e);}
  const exact=!error&&comparable(actual)===comparable(row.expected),wordExact=!error&&words(actual)===words(row.expected),identity=comparable(row.input)===comparable(row.expected);
  total.cases++;total.exact+=+exact;total.wordExact+=+wordExact;total.identityInputs+=+identity;total.identityPreserved+=+(identity&&exact);total.exceptions+=+Boolean(error);total.changedFromInput+=+(comparable(actual)!==comparable(row.input));
  total.charSpellRankedTokens+=metadata?.charSpell?.rankedTokens??0;total.charSpellCandidatesScored+=metadata?.charSpell?.candidatesScored??0;total.punctCaseProposed+=metadata?.punctCase?.proposed??0;total.punctCaseApplied+=metadata?.punctCase?.applied??0;total.punctCaseRejected+=+Boolean(metadata?.punctCase?.rejectedUnstable);
  records.push({key:row.set+'/'+row.id,set:row.set,id:row.id,actual,exact,wordExact,elapsedMs:performance.now()-time,...(error?{error}:{}),metadata});
  if((i+1)%500===0){const progress={variant:variant.id,completed:i+1,total:rows.length,elapsedSeconds:(performance.now()-started)/1000};save(variant.id+'/progress.json',progress);console.log(JSON.stringify(progress));}
 }
 const bytes=records.map(r=>JSON.stringify(r)).join('\n')+'\n';writeFileSync(out+'/results.jsonl.gz',gzipSync(bytes));
 save(variant.id+'/summary.json',{variant,totals,elapsedSeconds:(performance.now()-started)/1000,resultsSHA256:hash(bytes)});
 console.log(JSON.stringify({variant:variant.id,complete:true,sets:totals}));
}

async function summarize(){
 const rows=loadCases(),manifest=read(resolve(root,'MANIFEST.json'));
 const results=Object.fromEntries(variants.map(v=>[v.id,gunzipSync(readFileSync(resolve(root,v.id,'results.jsonl.gz'))).toString().trim().split('\n').map(JSON.parse)]));
 const full=results.w1c1p1;const paired={};const shapley={};const changed=[];
 for(const set of Object.keys(manifest.sets)){
  const indices=rows.flatMap((r,i)=>r.set===set?[i]:[]);paired[set]={};shapley[set]={};
  for(const [model,bit,without] of [['wordLM',4,'w0c1p1'],['charSpell',2,'w1c0p1'],['punctCase',1,'w1c1p0']]){
   const summary={cases:indices.length,allExact:0,withoutExact:0,improved:0,regressed:0,changed:0,neitherExactButChanged:0,improvedIds:[],regressedIds:[]};
   for(const i of indices){
    const on=full[i],off=results[without][i];if(on.key!==off.key||on.key!==rows[i].set+'/'+rows[i].id)throw Error('Unpaired results');
    summary.allExact+=+on.exact;summary.withoutExact+=+off.exact;
    if(on.exact&&!off.exact){summary.improved++;summary.improvedIds.push(rows[i].id);}
    if(!on.exact&&off.exact){summary.regressed++;summary.regressedIds.push(rows[i].id);}
    if(comparable(on.actual)!==comparable(off.actual)){summary.changed++;summary.neitherExactButChanged+=+(!on.exact&&!off.exact);changed.push({model,...rows[i],all: on.actual,without:off.actual,allExact:on.exact,withoutExact:off.exact,allMetadata:on.metadata,withoutMetadata:off.metadata});}
   }
   summary.netExact=summary.improved-summary.regressed;paired[set][model]=summary;
   let contribution=0;
   for(let mask=0;mask<8;mask++)if(!(mask&bit)){
    const size=[1,2,4].filter(b=>mask&b).length,weight=size===1?1/6:1/3;
    const before=results[variants[mask].id],after=results[variants[mask|bit].id];
    contribution+=weight*indices.reduce((sum,i)=>sum+Number(after[i].exact)-Number(before[i].exact),0);
   }
   shapley[set][model]=contribution;
  }
  const sum=Object.values(shapley[set]).reduce((a,b)=>a+b,0),delta=indices.reduce((n,i)=>n+Number(full[i].exact)-Number(results.w0c0p0[i].exact),0);
  if(Math.abs(sum-delta)>1e-7)throw Error('Invalid factorial attribution');
 }
 const summary={...provenance,sourceCommit:manifest.sourceCommit,cases:manifest.cases,distinctInputs:manifest.distinctInputs,variants:Object.fromEntries(variants.map(v=>[v.id,read(resolve(root,v.id,'summary.json'))])),leaveOneOut:paired,shapleyExactMatches:shapley,changedCases:changed.length,limitations:['Static source vocabulary and older learned models remain in every configuration.','WordLM final document monitoring remains present even in score ablations; this is not a memory/load-removal benchmark.','Authored/development references include repeated structures and overlaps. Report datasets separately; do not interpret aggregate match rate as real-user accuracy.','Exact reference matching can reject legitimate stylistic alternatives.','No neural training or threshold selection used these results.']};
 save('summary.json',summary);writeFileSync(resolve(root,'paired-changes.jsonl.gz'),gzipSync(changed.map(r=>JSON.stringify(r)).join('\n')+'\n'));
 console.log(JSON.stringify({leaveOneOut:paired,shapleyExactMatches:shapley},null,2));
}
async function parity(){
 const manifest=read(resolve(root,'MANIFEST.json')),rows=loadCases();
 for(const [path,digest] of Object.entries(manifest.runtimeSHA256))if(hash(readFileSync(path))!==digest)throw Error('Runtime changed: '+path);
 const full=gunzipSync(readFileSync(resolve(root,'w1c1p1/results.jsonl.gz'))).toString().trim().split('\n').map(JSON.parse);
 const savedPath='artifacts/qa/charspell-integration-20261106/accepted-v13/results.jsonl';
 const savedSummary=read('artifacts/qa/charspell-integration-20261106/accepted-v13/summary.json');
 const saved=readFileSync(savedPath);if(hash(saved)!==savedSummary.resultsSHA256)throw Error('Published baseline result digest mismatch');
 const cached=new Map(saved.toString().trim().split('\n').map(JSON.parse).filter(r=>r.mode==='default').map(r=>[r.id,r]));
 const {getStrategyRegistry}=await import('../../lib/strategies/bootstrap.ts');
 let direct=0,cachedCount=0;
 for(const [i,row] of rows.entries()){
  const result=row.set==='development-10000'?cached.get(row.id):await getStrategyRegistry().get(row.module==='mail'?'gmail-corrector':'text-corrector').transform({text:row.input,options:row.options});
  const actual=row.set==='development-10000'?result.actual:result.transformedText;
  if(actual!==full[i].actual)throw Error('Full variant does not match actual app: '+full[i].key);
  if(!full[i].metadata.charSpell.loaded||!full[i].metadata.punctCase.loaded||!full[i].metadata.wordLM.loaded)throw Error('Full model receipt missing');
  if(row.set==='development-10000')cachedCount++;else direct++;
 }
 save('app-parity.json',{sourceCommit:manifest.sourceCommit,passed:true,exactByteOutputParity:true,cachedPublishedAppResults:cachedCount,cachedPublishedResultsSHA256:hash(saved),freshActualAppStrategyRequests:direct,total:rows.length,runtimeFilesUnchanged:Object.keys(manifest.runtimeSHA256).length});
 console.log(JSON.stringify({stage:'parity',passed:true,cachedCount,direct}));
}
async function stability(){
 const rows=loadCases(),report={scope:'Repeat every variant/output that differs from full; full 10k repeats are separately verified in the published source audit.',variants:{}};
 const full=gunzipSync(readFileSync(resolve(root,'w1c1p1/results.jsonl.gz'))).toString().trim().split('\n').map(JSON.parse);
 for(const variant of [...variants,{id:'w0lexc1p1'}]){
  const results=gunzipSync(readFileSync(resolve(root,variant.id,'results.jsonl.gz'))).toString().trim().split('\n').map(JSON.parse);
  const registry=require(resolve(root,'bundles',variant.id+'.cjs')).getStrategyRegistry();const checked=new Set(),unstable=[];
  for(const [i,row] of rows.entries())if(comparable(results[i].actual)!==comparable(full[i].actual)){
   for(const [id,output] of [[variant.id,results[i].actual],['w1c1p1',full[i].actual]]){
    const key=id+'/'+i;if(checked.has(key))continue;checked.add(key);
    const engine=id===variant.id?registry:require(resolve(root,'bundles/w1c1p1.cjs')).getStrategyRegistry();
    const next=await engine.get(row.module==='mail'?'gmail-corrector':'text-corrector').transform({text:output,options:row.options});
    if(comparable(next.transformedText)!==comparable(output))unstable.push({key:row.set+'/'+row.id,variant:id,first:output,second:next.transformedText});
   }
  }
  report.variants[variant.id]={requests:checked.size,unstable};
 }
 save('changed-output-stability.json',report);console.log(JSON.stringify(report));
}
async function trace(){
 await bundle({id:'trace',wordLM:true,charSpell:true,punctCase:true,trace:true});
 const registry=require(resolve(root,'bundles/trace.cjs')).getStrategyRegistry();
 const rows=loadCases(),full=gunzipSync(readFileSync(resolve(root,'w1c1p1/results.jsonl.gz'))).toString().trim().split('\n').map(JSON.parse);
 const {spellingCandidates}=await import('../../lib/editor/spelling-candidates.ts');
 const {sourceSpellingCandidates}=await import('../../lib/editor/lexicon.ts');
 const {attestedSpellingCandidates}=await import('../../lib/editor/wordlm/lexical-evidence.ts');
 const {loadCharSpell}=await import('../../lib/editor/charspell/load.ts');
 const {createCharSpellInference}=await import('../../lib/editor/charspell/runtime.ts');
 const model=await loadCharSpell(),records=[];const totals={documents:0,parityDifferences:0,unalignedDocuments:0,wordErrorSites:0,fastPathSkipped:0,ranked:0,noSelectionEvent:0,targetInProductionPool:0,targetInFinalRankedPool:0,targetInExpandedPool:0,expandedCharTop1:0,expandedCharTop3:0};
 const tokens=s=>[...s.matchAll(/[\p{L}\p{M}]+(?:[-’'][\p{L}\p{M}]+)*/gu)];
 for(const [i,row] of rows.entries())if(row.set==='holdout-500'&&!full[i].exact){
  const events=[];globalThis.__slothContributionTrace=event=>events.push(event);
  const result=await registry.get('text-corrector').transform({text:row.input,options:row.options});
  if(result.transformedText!==full[i].actual){totals.parityDifferences++;throw Error('Trace changed output: '+row.id);}
  totals.documents++;
  const input=tokens(row.input),actual=tokens(result.transformedText),gold=tokens(row.expected);const sites=[];
  if(input.length!==actual.length||gold.length!==actual.length)totals.unalignedDocuments++;
  else for(let at=0;at<actual.length;at++)if(actual[at][0]!==gold[at][0]){
   const raw=input[at][0],target=gold[at][0].toLocaleLowerCase('az-AZ'),current=actual[at][0].toLocaleLowerCase('az-AZ');
   const event=events.find(e=>e.rawStart===input[at].index),kind=event?.kind??'no-event';
   const pool=[...new Set([raw.toLocaleLowerCase('az-AZ'),current,...sourceSpellingCandidates(raw).map(r=>r.surface),...attestedSpellingCandidates(raw),...spellingCandidates.candidates(raw,20)])].slice(0,20);
   const ranking=createCharSpellInference(model).rank(raw,pool,actual.slice(Math.max(0,at-2),at).map(w=>w[0]),actual.slice(at+1,at+3).map(w=>w[0]));
   const position=ranking.findIndex(r=>r.word===target);
   const site={at,raw,current,target,productionTrace:event,expandedCandidates:pool,expandedCharRanking:ranking,expandedTargetRank:position<0?null:position+1};sites.push(site);totals.wordErrorSites++;
   totals.fastPathSkipped+=+(kind==='skipped');totals.ranked+=+(kind==='ranked');totals.noSelectionEvent+=+(kind==='no-event');
   totals.targetInProductionPool+=+Boolean(event?.proposals?.includes(target));totals.targetInFinalRankedPool+=+Boolean(event?.candidates?.some(c=>c.word===target));totals.targetInExpandedPool+=+(position>=0);totals.expandedCharTop1+=+(position===0);totals.expandedCharTop3+=+(position>=0&&position<3);
  }
  records.push({...row,actual:result.transformedText,sites,events});
 }
 delete globalThis.__slothContributionTrace;
 save('remaining-error-diagnosis.json',{scope:'Actual-output-equivalent trace of remaining500-case engineering errors. Expanded retrieval/scoring is an offline counterfactual, not an app improvement or fitted policy. Expected target is never injected into the generated candidate pool.',totals});
 writeFileSync(resolve(root,'remaining-error-traces.jsonl.gz'),gzipSync(records.map(r=>JSON.stringify(r)).join('\n')+'\n'));
 console.log(JSON.stringify({stage:'trace',totals}));
}
async function punctuation(){
 const {loadPunctCase}=await import('../../lib/editor/punctcase/load.ts');
 const {tagProbabilities,punctCaseWordPattern}=await import('../../lib/editor/punctcase/core.ts');
 const {PUNCTCASE_POLICY}=await import('../../lib/editor/punctcase/edit.ts');
 const info=read('lib/editor/punctcase/model-info.json'),model=await loadPunctCase();
 const rows=loadCases(),off=gunzipSync(readFileSync(resolve(root,'w1c1p0/results.jsonl.gz'))).toString().trim().split('\n').map(JSON.parse);const records=[];
 for(const [i,row] of rows.entries())if(row.set==='punctuation-contrasts-40'&&!row.id.startsWith('probe-literal')){
  const baseline=off[i].actual,current=[...baseline.matchAll(punctCaseWordPattern())],gold=[...row.expected.matchAll(punctCaseWordPattern())];
  if(current.length!==gold.length||current.some((w,j)=>w[0].toLocaleLowerCase('az-AZ')!==gold[j][0].toLocaleLowerCase('az-AZ')))continue;
  const predicted=model.predict(current.map(w=>w[0]));
  for(let at=0;at<current.length;at++){
   const marks=(text,tokens)=>text.slice(tokens[at].index+tokens[at][0].length,tokens[at+1]?.index??text.length).match(/[,.;:!?]/gu)?.join('')??'';
   const actual=marks(baseline,current),expected=marks(row.expected,gold);if(actual===expected)continue;
   const probabilities=tagProbabilities(predicted.punctuation[at]),top=probabilities.indexOf(Math.max(...probabilities)),wanted=expected?info.punctuation.indexOf(expected):0;
   records.push({id:row.id,input:row.input,baseline,expectedText:row.expected,afterWord:current[at][0],actualMark:actual,expectedMark:expected,topLabel:info.punctuation[top],topProbability:probabilities[top],expectedLabelProbability:wanted>=0?probabilities[wanted]:null,threshold:PUNCTCASE_POLICY.punctuationProbability,structuralBlock:actual?'existing punctuation is preserved; insert-only editor cannot remove/replace it':at===current.length-1?'last-token punctuation is owned by preceding engine':null});
  }
 }
 save('punctcase-gap-diagnosis.json',{scope:'Diagnostic missing/wrong punctuation gaps in frozen40 contrast cases; probabilities are not calibrated real-user confidence and do not justify lowering thresholds.',gaps:records.length,existingMarksCannotBeRepaired:records.filter(r=>r.actualMark).length,records});console.log(JSON.stringify({stage:'punctuation',gaps:records.length}));
}
async function benchmark(){
 const ids=['w1c1p1','w0c1p1','w1c0p1','w1c1p0'];const engines=Object.fromEntries(ids.map(id=>[id,require(resolve(root,'bundles',id+'.cjs')).getStrategyRegistry().get('text-corrector')]));
 const seed=('men bu gun mektebe getdim sonra dostumla gorusdum sabah saat onda yigincagimiz var lutfen gecikmeyin cunki cox vacib movzular muzakire olunacaq API request backend terefde yoxlanilir melumatlar sistemde saxlanilir neticeler hazir olanda gondereceyik tesekkur edirik sorgunuz qebul olundu layihe davam edir').split(' ');
 const results=[];
 for(const count of [20,100,500,1000]){
  const text=Array.from({length:count},(_,i)=>seed[i%seed.length]+((i+1)%24===0?'.':'')).join(' '),timings=Object.fromEntries(ids.map(id=>[id,[]]));
  for(const id of ids)await engines[id].transform({text});
  for(let round=0;round<5;round++)for(let j=0;j<ids.length;j++){
   const id=ids[(j+round)%ids.length],start=performance.now();await engines[id].transform({text});timings[id].push(performance.now()-start);
  }
  results.push({words:count,inputSHA256:hash(text),variants:Object.fromEntries(ids.map(id=>{const values=timings[id].slice().sort((a,b)=>a-b);return [id,{timingsMs:timings[id],medianMs:values[2],maximumMs:values[4]}];}))});
 }
 save('latency.json',{scope:'Isolated sequential warm Node whole-strategy benchmark, five rounds with rotating variant order; repeated seed and warm caches, not mobile/browser or cold-start latency. WordLM document monitoring/static lexical data remain in every variant.',node:process.version,results});console.log(JSON.stringify({stage:'benchmark',results}));
}
async function lexical(){
 const variant={id:'w0lexc1p1',wordLM:false,charSpell:true,punctCase:true,removeWordLMLexicon:true};
 await bundle(variant);await evaluate(variant);await lexicalSummary();
}
async function lexicalSummary(){
 const full=gunzipSync(readFileSync(resolve(root,'w1c1p1/results.jsonl.gz'))).toString().trim().split('\n').map(JSON.parse),off=gunzipSync(readFileSync(resolve(root,'w0lexc1p1/results.jsonl.gz'))).toString().trim().split('\n').map(JSON.parse),sets={};
 for(const [i,on] of full.entries()){
  const no=off[i];if(on.key!==no.key)throw Error('Unpaired lexical removal');
  const set=sets[on.set]??={cases:0,fullExact:0,withoutExact:0,improved:0,regressed:0,changed:0};
  set.cases++;set.fullExact+=+on.exact;set.withoutExact+=+no.exact;set.improved+=+(on.exact&&!no.exact);set.regressed+=+(no.exact&&!on.exact);set.changed+=+(comparable(on.actual)!==comparable(no.actual));
 }
 for(const set of Object.values(sets))set.netExact=set.improved-set.regressed;
 save('wordlm-lexical-comparison.json',{scope:'Additional WordLM learned-data ablation: remove trained probability/context decisions and only the trained vocabulary words supplied to lexical-evidence. All lexical helper function bodies, their dictionary-based repairs, general morphology, CharSpell, PunctCase and older rules/models remain. Final WordLM document monitoring remains and cannot affect output. Distinct from the eight-way fixed-lexicon score ablation.',sets});console.log(JSON.stringify({stage:'lexical-summary',sets}));
}
async function all(){
 await prepare();
 const queue=[...variants].reverse();
 const runner=async()=>{while(queue.length){const v=queue.shift();await new Promise((done,reject)=>{const child=spawn(process.execPath,['--import','tsx',script,'--stage=run','--variant='+v.id,'--out='+root],{stdio:'inherit'});child.on('error',reject);child.on('exit',code=>code===0?done():reject(Error('Variant failed: '+v.id)));});}};
 await Promise.all(Array.from({length:Math.min(2,Number(arg('workers')??2))},runner));await summarize();
}
const stage=arg('stage')??'all';
await ({prepare,run:evaluate,summarize,parity,stability,trace,punctuation,benchmark,lexical,'lexical-summary':lexicalSummary,all}[stage]??(()=>{throw Error('Unknown stage');}))();
