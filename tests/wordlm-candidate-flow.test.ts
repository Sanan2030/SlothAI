import assert from 'node:assert/strict';import test from 'node:test';
import {attestedSpellingCandidates} from '../lib/editor/wordlm/lexical-evidence';
import {SourceInflectionEngine} from '../lib/editor/source-inflection';
import {correctText} from '../lib/editor/correct';
import {BrowserWordLM} from '../lib/editor/wordlm/core';

test('the model vocabulary supplies inflected alternatives and preserves authored accents',()=>{
 const values=attestedSpellingCandidates('sureti');assert.ok(values.includes('surəti'));assert.ok(values.includes('sürəti'));assert.ok(values.length<=8);
 assert.deepEqual(attestedSpellingCandidates('sürəti'),['sürəti']);
});
test('sentence-start frequency alone is not observed lexical evidence',()=>{
 const model=new BrowserWordLM({schemaVersion:1,words:['<s>','<unk>','word','next'],unigrams:[0,.2,.4,.4],contexts2:[[0,.5]],bigrams:[[0,2,.5]],contexts3:[],trigrams:[]});
 assert.equal(model.rank([],['word'],['next'])[0].evidence,false);
});
test('classified stems license present, negative participles and locative relative forms',()=>{
 const model=new SourceInflectionEngine(()=>false,[{lemma:'paketlə',pos:'verb'},{lemma:'rampa',pos:'noun'}]);
 for(const surface of ['paketləyirsiniz','paketləmir','paketləmədiyi','paketləməyib','rampasındakı'])assert.ok(model.analyze(surface).length,surface);
 assert.ok(model.candidates('rampasindaki').some(row=>row.surface==='rampasındakı'));
});
test('a typed technical acronym keeps its exact casing while source spellings are resolved',()=>{
 const input='GNU Linux PDF faylını saxlayır.';assert.equal(correctText(input).text,input);
 assert.equal(correctText('gul').text,'Gul.');assert.equal(correctText('gul əkdik').text,'Gül əkdik.');
 assert.equal(correctText('Burada oturulur.').text,'Burada oturulur.');
});
