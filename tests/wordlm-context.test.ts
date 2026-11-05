import test from 'node:test';import assert from 'node:assert/strict';
import {SpellingContextModel,type SourceContextArtifact} from '../lib/editor/wordlm/context';
const artifact:SourceContextArtifact={schemaVersion:1,settings:{minimumContextCount:3,maximumForms:8,maximumProfiles:8000,contextsPerDirectionPerForm:8},profiles:[['sert',['sərt','şərt'],[100,100],[[2,10,11,[1,500]],[0,10,-1,[0,20]]]]]};
const fold=(s:string)=>s.replace(/ə/g,'e').replace(/ş/g,'s');const ids=(s:string)=>({contract:10,renewed:11}[s]);
test('source counts change a spelling distribution while preserving all family probability mass',()=>{
 const model=new SpellingContextModel(artifact,ids,fold);const priors=[{word:'sərt',logScore:-4},{word:'şərt',logScore:-4}];
 const rows=model.adjustments('sert',['contract'],['renewed'],priors);assert.equal(rows.length,2);assert.equal(rows[0].examples,1);assert.equal(rows[1].examples,500);assert.ok(rows.every(r=>r.bridge));
 const before=priors.reduce((n,r)=>n+Math.exp(r.logScore),0);const after=priors.reduce((n,r,i)=>n+Math.exp(r.logScore+rows[i].logAdjustment),0);assert.ok(Math.abs(before-after)<1e-14);
 assert.ok(priors[1].logScore+rows[1].logAdjustment>priors[0].logScore+rows[0].logAdjustment+Math.log(100));
});
test('unknown neighbours and a missing alternative do not create context evidence',()=>{
 const model=new SpellingContextModel(artifact,ids,fold);assert.deepEqual(model.adjustments('sert',['unknown'],['unknown'],[{word:'sərt',logScore:-4},{word:'şərt',logScore:-4}]),[]);
 assert.deepEqual(model.adjustments('sert',['contract'],['renewed'],[{word:'other',logScore:-4},{word:'şərt',logScore:-4}]),[]);
});
test('source corruption and duplicate families are rejected',()=>{
 assert.throws(()=>new SpellingContextModel({...artifact,schemaVersion:2},ids,fold));assert.throws(()=>new SpellingContextModel({...artifact,profiles:[...artifact.profiles,...artifact.profiles]},ids,fold));
});

test('context counts are bound to the accepted train split, base model, dictionary and builder', async()=>{
 const {readFileSync}=await import('node:fs');const {createHash}=await import('node:crypto');
 const hash=(name:string)=>createHash('sha256').update(readFileSync(name)).digest('hex');
 const data=JSON.parse(readFileSync('lib/editor/wordlm/context-model.json','utf8'));
 const info=JSON.parse(readFileSync('lib/editor/wordlm/context-info.json','utf8'));
 const manifest=JSON.parse(readFileSync('docs/stage1/collection/MANIFEST.json','utf8'));
 assert.equal(hash('lib/editor/wordlm/context-model.json'),info.artifactSHA256);
 assert.equal(data.baseWordLMArtifactSHA256,hash('lib/editor/wordlm/model.json'));
 assert.equal(data.dictionarySHA256,hash('lib/editor/generated/az-words.json'));
 assert.equal(info.scriptSHA256,hash('scripts/train-wordlm-context.py'));
 assert.equal(info.trainSentences,manifest.splitCounts.train);
 assert.equal(data.sourceTrainSHA256,manifest.files['train.jsonl'].sha256);
 assert.equal(info.utf8ReplacementRows,0);
 assert.equal(data.profiles.length,info.profiles);
});
