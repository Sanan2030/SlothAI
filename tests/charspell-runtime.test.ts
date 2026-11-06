import {correctText} from '../lib/editor/correct';
import assert from 'node:assert/strict';
import test from 'node:test';
import golden from './fixtures/charspell-golden.json';
import weights from '../lib/editor/charspell/weights.json';
import {decodeCharSpell} from '../lib/editor/charspell/load';
import {createCharSpellInference} from '../lib/editor/charspell/runtime';

test('original CharSpell float32 browser logits match batched PyTorch, including empty/padded/Unicode/long words',async()=>{
 const model=await decodeCharSpell(weights.data);let maximum=0;
 for(const row of golden.examples){
  const ranked=model.rank(row.input,row.candidates,row.left,row.right);
  for(const [i,word] of row.candidates.entries()){
   const actual=ranked.find(r=>r.word===word)!.logit;maximum=Math.max(maximum,Math.abs(actual-row.logits[i]));
  }
 }
 assert.ok(maximum<golden.absoluteTolerance,'maximum logit difference '+maximum);
});
test('CharSpell validates every weight and has independent request usage counters',async()=>{
 await assert.rejects(()=>decodeCharSpell(weights.data.slice(4)));
 const changed=(weights.data[10]==='A'?'B':'A');await assert.rejects(()=>decodeCharSpell(weights.data.slice(0,10)+changed+weights.data.slice(11)));
 const model=await decodeCharSpell(weights.data),a=createCharSpellInference(model),b=createCharSpellInference(model);
 a.rank('sefer',['səfər','səhər'],['uzun'],['bitdi']);assert.equal(a.stats.rankedTokens,1);assert.equal(b.stats.rankedTokens,0);
});

test('verified lexical context survives character-score disagreement and repeated processing',async()=>{
 const model=await decodeCharSpell(weights.data);
 const run=(text:string)=>correctText(text,false,{charSpell:createCharSpellInference(model)}).text;
 const result=run('butun kes acarları yenilenir');
 assert.equal(result,'Bütün keş açarları yenilənir.');assert.equal(run(result),result);
 assert.equal(run('Quşlar, uçun!'),'Quşlar, uçun!');
 assert.equal(run('Ekran qarşısında oturulur.'),'Ekran qarşısında oturulur.');
});
