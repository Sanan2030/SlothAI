import {SourceInflectionEngine} from '../lib/editor/source-inflection';
import test from 'node:test';import assert from 'node:assert/strict';
import {constrainedSpelling} from '../lib/editor/lexical-constraints';
import {languageServices} from '../lib/editor/language-services';
import {correctText} from '../lib/editor/correct';
import {repairRepeatedVowel} from '../lib/editor/verified-typos';
const choose=(raw:string,left:string,right:string)=>constrainedSpelling(raw,raw,left,right,languageServices)?.word??raw;
test('selectional relations distinguish objects, temporal adjuncts and literal author meanings',()=>{
 assert.equal(choose('oturulur','Ekran qarşısında ','.'),'oturulur');
 assert.equal(choose('oturulur','Məlumat şəbəkə ilə ',' və qeyd edilir.'),'ötürülür');
 assert.equal(choose('səhər','',' parkda gəzirik.'),'səhər');
 assert.equal(choose('səhər','',' parkında ağac əkilir.'),'şəhər');
 assert.equal(choose('acıqlanır','Uşaq qaydanı eşidəndə ','.'),'acıqlanır');
 assert.equal(choose('adi','Məhsulun ',' qutusu dəyişdirilir.'),'adi');
 assert.equal(choose('adi','Müəllifin ',' qeyd edilir.'),'adı');
});
test('repeat repair keeps doubled-letter words and names, but verifies malformed inflections',()=>{
 for(const word of ['Məhəmməd','hədiyyə','saatının','maaşının','addımı'])assert.equal(repairRepeatedVowel(word),word);
 assert.equal(repairRepeatedVowel('yazılıır'),'yazılır');
 assert.equal(correctText('GNU Linux PDF faylını saxlayır.').text,'GNU Linux PDF faylını saxlayır.');
});

test('vowel-initial verb endings preserve Azerbaijani stem voicing and temporal forms',()=>{
 const model=new SourceInflectionEngine(()=>false,[{lemma:'et',pos:'verb'},{lemma:'get',pos:'verb'},{lemma:'böyüt',pos:'verb'}]);
 for(const word of ['edəndə','gedəndə','böyüdəndə','edib','etməzdən'])assert.ok(model.analyze(word).length,word);
 assert.equal(model.analyze('etən').length,0);assert.equal(model.analyze('getib').length,0);
});
