/** Counterfactual retrieval probe: existing source vocabulary only, no app edits. */
import {readFileSync,writeFileSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {foldLetters} from '../../lib/editor/dictionary.ts';
import {loadCharSpell} from '../../lib/editor/charspell/load.ts';
import {createCharSpellInference} from '../../lib/editor/charspell/runtime.ts';
import {rankWordLM,wordLMSurfacePenalty} from '../../lib/editor/wordlm/runtime.ts';
import {spellingContextAdjustments} from '../../lib/editor/wordlm/context-runtime.ts';
import {automaticWordLMPolicy,channelLogScore} from '../../lib/editor/wordlm/selection.ts';
const root=resolve(process.argv.find(s=>s.startsWith('--out='))?.slice(6)??'artifacts/qa/model-contributions-20261106');
const artifact=JSON.parse(readFileSync('lib/editor/wordlm/model.json','utf8'));
const charPolicy=JSON.parse(readFileSync('lib/editor/charspell/selection-policy.json','utf8'));
const lower=s=>s.normalize('NFC').replace(/I/g,'ı').replace(/İ/g,'i').toLowerCase();
const alphabet='abcdefghijklmnopqrstuvwxyz';
const frequencies=new Map(),index=new Map();
for(const [i,word] of artifact.words.entries())if(/^[a-zəçğıöşü]{2,40}$/u.test(word)){
 frequencies.set(word,artifact.unigrams[i]);const key=foldLetters(word),values=index.get(key)??[];values.push(word);index.set(key,values);
}
function retrieve(raw){
 const word=foldLetters(lower(raw)),keys=new Set([word]);
 for(let at=0;at<word.length;at++){
  keys.add(word.slice(0,at)+word.slice(at+1));
  if(at+1<word.length)keys.add(word.slice(0,at)+word[at+1]+word[at]+word.slice(at+2));
  for(const letter of alphabet)keys.add(word.slice(0,at)+letter+word.slice(at+1));
 }
 for(let at=0;at<=word.length;at++)for(const letter of alphabet)keys.add(word.slice(0,at)+letter+word.slice(at));
 const found=new Set();for(const key of keys)for(const candidate of index.get(key)??[])found.add(candidate);
 return [...found].sort((a,b)=>(frequencies.get(b)??0)-(frequencies.get(a)??0)||a.localeCompare(b,'az'));
}
const model=await loadCharSpell();
const traces=gunzipSync(readFileSync(root+'/remaining-error-traces.jsonl.gz')).toString().trim().split('\n').map(JSON.parse);
const totals={sites:0,targetInSourceVocabulary:0,targetRetrievedBeforeCap:0,targetRetrievedIn20:0,charTop1:0,charTop3:0,wordLMTop1:0,wordLMTop3:0,fusionTop1:0,fusionTop3:0};const records=[];
for(const row of traces){
 const actualWords=row.actual.match(/[\p{L}\p{M}]+(?:[-’'][\p{L}\p{M}]+)*/gu)??[];
 for(const site of row.sites){
  const retrieved=retrieve(site.raw),candidates=[...new Set([lower(site.raw),site.current,...retrieved])].slice(0,20);
  const left=actualWords.slice(Math.max(0,site.at-2),site.at).map(lower),right=actualWords.slice(site.at+1,site.at+3).map(lower);
  const char=createCharSpellInference(model).rank(site.raw,candidates,left,right);
  // The current browser ranker caps each call at eight. Independent log scores
  // can be merged across batches for this diagnostic without dropping a pool tail.
  const rawLM=[];for(let at=0;at<candidates.length;at+=8)rawLM.push(...rankWordLM(left,candidates.slice(at,at+8),right));
  const context=new Map(spellingContextAdjustments(lower(site.raw),left,right,rawLM.map(r=>({word:r.word,logScore:r.score-wordLMSurfacePenalty(r.word)}))).map(r=>[r.word,r]));
  const logits=new Map(char.map(r=>[r.word,r.logit]));
  const lm=rawLM.map(r=>({...r,rawLogScore:r.score,score:automaticWordLMPolicy.lmWeight*(r.score-wordLMSurfacePenalty(r.word)+(context.get(r.word)?.logAdjustment??0))+channelLogScore(lower(site.raw),r.word,automaticWordLMPolicy)})).sort((a,b)=>b.score-a.score||a.word.localeCompare(b.word,'az'));
  const fused=lm.map(r=>({...r,score:r.score+charPolicy.weight*(logits.get(r.word)??0)})).sort((a,b)=>b.score-a.score||a.word.localeCompare(b.word,'az'));
  const charRank=char.findIndex(r=>r.word===site.target),lmRank=lm.findIndex(r=>r.word===site.target),fusionRank=fused.findIndex(r=>r.word===site.target);
  totals.sites++;totals.targetInSourceVocabulary+=+frequencies.has(site.target);totals.targetRetrievedBeforeCap+=+retrieved.includes(site.target);totals.targetRetrievedIn20+=+candidates.includes(site.target);totals.charTop1+=+(charRank===0);totals.charTop3+=+(charRank>=0&&charRank<3);totals.wordLMTop1+=+(lmRank===0);totals.wordLMTop3+=+(lmRank>=0&&lmRank<3);totals.fusionTop1+=+(fusionRank===0);totals.fusionTop3+=+(fusionRank>=0&&fusionRank<3);
  records.push({id:row.id,...site,sourceOneEditCandidates:candidates,retrievedBeforeCap:retrieved.length,charRanking:char,wordLMRanking:lm,fusedRanking:fused,charTargetRank:charRank<0?null:charRank+1,wordLMTargetRank:lmRank<0?null:lmRank+1,fusionTargetRank:fusionRank<0?null:fusionRank+1});
 }
}
const report={scope:'Post-audit diagnostic on observed engineering failures, not blind evaluation or a deployed improvement. No expected target is injected into retrieval. No model weights/policies/app source change.',policy:'Existing WordLM vocabulary indexed by folded word. One deletion, insertion, substitution or adjacent swap. Order by existing source unigram then lexical order, retain raw/current, cap20. Use existing app OOV/context/channel weights and CharSpell fusion weight without refitting. Character/LM/fused ranks are diagnostic; app protection and acceptance guards are not applied.',vocabularySourceSHA256:createHash('sha256').update(readFileSync('lib/editor/wordlm/model.json')).digest('hex'),totals};
writeFileSync(root+'/retrieval-prototype.json',JSON.stringify(report,null,2)+'\n');writeFileSync(root+'/retrieval-prototype-sites.jsonl.gz',gzipSync(records.map(r=>JSON.stringify(r)).join('\n')+'\n'));console.log(JSON.stringify(report));
