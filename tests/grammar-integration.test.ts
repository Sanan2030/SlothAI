import assert from 'node:assert/strict';
import test from 'node:test';
import { correctText, formatEmail } from '../lib/editor/correct';
import { chooseByGrammar } from '../lib/editor/contextual-choices';
import { productiveMorphology } from '../lib/editor/productive-morphology';

test('long independent clauses split when a new object and time phrase begin a clause', () => {
  const input = 'sənədləri aldıq onları sabah yoxlayacağıq nəticəni sabah göndərəcəyik';
  const expected = 'Sənədləri aldıq. Onları sabah yoxlayacağıq. Nəticəni sabah göndərəcəyik.';
  assert.equal(correctText(input).text, expected);
  assert.equal(correctText(expected).text, expected);
  assert.equal(correctText('sənədləri sabah göndərəcəyik').text, 'Sənədləri sabah göndərəcəyik.');
  const mail = formatEmail('Mövzu: Sənəd yoxlaması Hörmətli komanda, müraciəti aldıq sənədləri yoxlayırıq nəticəni sabah göndərəcəyik Hörmətlə, Sənan').text;
  assert.match(mail, /Müraciəti aldıq\. Sənədləri yoxlayırıq\. Nəticəni sabah göndərəcəyik\./u);
});

test('noun morphology, lemma and POS constrain an otherwise ambiguous spelling', () => {
  assert.ok(productiveMorphology.analyzeWord('uçmaq').some(item => item.lemma === 'uç' && item.features.mood === 'infinitive'));
  assert.ok(productiveMorphology.analyzeWord('sənədləri').some(item => item.lemma === 'sənəd' && item.features.case === 'accusative'));
  assert.ok(productiveMorphology.generateForms({ lemma: 'sənəd', features: { case: 'accusative' } }).includes('sənədi'));
  assert.equal(chooseByGrammar('uc', 'kitab'), 'üç');
  assert.equal(chooseByGrammar('uc', 'sənədləri'), undefined);
  assert.equal(chooseByGrammar('uc', 'API'), undefined);
  assert.equal(correctText('uc kitab sistemdə qeydiyyata alındı').text, 'Üç kitab sistemdə qeydiyyata alındı.');
  assert.equal(correctText('uc sənədləri yoxla').text, 'Uc sənədləri yoxla.');
  assert.equal(correctText('uc min sənəd köçürülüb').text, 'Üç min sənəd köçürülüb.');
  assert.ok(productiveMorphology.analyzeWord('sənədin').some(item => item.lemma === 'sənəd' && item.features.case === 'genitive'));
  assert.equal(chooseByGrammar('adi', 'siyahıda', 'sənədin'), 'adı');
  assert.equal(chooseByGrammar('adi', 'istifadəçi', ''), undefined);
  assert.equal(correctText('senedin adi siyahida gorunur').text, 'Sənədin adı siyahıda görünür.');
  assert.equal(correctText('adi istifadəçi sənədi göndərdi').text, 'Adi istifadəçi sənədi göndərdi.');
});
