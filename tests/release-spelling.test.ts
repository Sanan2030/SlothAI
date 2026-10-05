import test from 'node:test';
import assert from 'node:assert/strict';
import { correctText } from '../lib/editor/correct';
import { restoreWord, isEstablishedSurface } from '../lib/editor/lexicon';
import { languageServices } from '../lib/editor/language-services';
import { productiveMorphology, artifactMorphology } from '../lib/editor/productive-morphology';

for (const [id, input, expected] of [
  ['a', 'sirket yeni layiheni ireli surdu ve musterilerle gorush kecirdi', 'Şirkət yeni layihəni irəli sürdü və müştərilərlə görüş keçirdi.'],
  ['b', 'her kes evvelceden hazirlashmali idi chunki imtahan cetin olacaqdi', 'Hər kəs əvvəlcədən hazırlaşmalı idi, çünki imtahan çətin olacaqdı.'],
  ['f', 'Muellimler telebelerin biliyini yoxlayanda obyektiv olmalidirlar', 'Müəllimlər tələbələrin biliyini yoxlayanda obyektiv olmalıdırlar.'],
]) test('requested correction ' + id + ' is exact and idempotent', () => {
  assert.equal(correctText(input).text, expected);
  assert.equal(correctText(expected).text, expected);
});

test('runtime derivation recovers lemma and inflection, leaving artifact features frozen', () => {
  assert.ok(productiveMorphology.analyzeWord('hazırlaşmalıdırlar').some(row => row.lemma === 'hazırla'
    && row.features.derivation?.includes('reflexive') && row.features.person === 3 && row.features.number === 'plural'));
  assert.ok(productiveMorphology.analyzeWord('çıxaq').some(row => row.lemma === 'çıx' && row.features.mood === 'optative'));
  assert.ok(productiveMorphology.analyzeWord('sürdü').some(row => row.lemma === 'sür' && row.features.tense === 'past'));
  assert.ok(productiveMorphology.analyzeWord('müştərilərlə').some(row => row.lemma === 'müştəri' && row.features.number === 'plural'));
  assert.equal(artifactMorphology.isValidWordForm('hazırlaşmalıdırlar'), false);
  for (const wrong of ['olmaludurlar', 'sürmalıdırlar', 'çıxək']) assert.equal(productiveMorphology.isValidWordForm(wrong), false);
});

test('lexical output invariant rejects unattested suffix guesses, preserving correct surfaces', () => {
  const inputs = ['abide', 'abidə', 'hazirlashmali', 'chunki', 'musterilerle', 'cixaq', 'olmalidirlar', 'surdu', 'mekteblerimizdeki', 'gonderilməsini'];
  for (const word of inputs) {
    const output = restoreWord(word, languageServices);
    if (output !== word) assert.equal(isEstablishedSurface(output, languageServices), true, word + ' => ' + output);
  }
  assert.equal(restoreWord('abide', languageServices), 'abidə');
  assert.equal(restoreWord('abidə', languageServices), 'abidə');
  assert.equal(isEstablishedSurface('abıdə', languageServices), false);
  for (const word of ['backend', 'framework', 'database', 'commit', 'DeployService', 'API']) assert.equal(restoreWord(word, languageServices), word);
});

test('parsed suffix fallback uses a real stem and preserves agreement mood', () => {
  const row = languageServices.morphology.analyzeWord('göndəriləndə');
  assert.ok(row.some(item => item.lemma === 'göndər' && item.lemma !== item.surface));
  assert.equal(correctText('men bu gun evdeyem').text, 'Mən bu gün evdəyəm.');
  assert.equal(correctText('men hele qerar vermemishem').text, 'Mən hələ qərar verməmişəm.');
  assert.equal(correctText('Mən sənədi oxuyurlar.').text, 'Mən sənədi oxuyuram.');
});
