import assert from 'node:assert/strict';
import test from 'node:test';
import { productiveMorphology, legacyModelMorphology, artifactMorphology } from '../lib/editor/productive-morphology';
import { isClausePredicate } from '../lib/editor/segmentation';
import { correctText } from '../lib/editor/correct';
test('productive copulas recover nominal lemmas and case without altering frozen features', () => {
  for (const [surface, lemma, person] of [['müəlliməm', 'müəllim', 1], ['həkimsən', 'həkim', 2], ['məktəbdəyəm', 'məktəb', 1], ['şirkətlərimizdəndir', 'şirkət', 3], ['müəllimlərik', 'müəllim', 1]] as const) {
    assert.ok(productiveMorphology.analyzeWord(surface).some(row => row.lemma === lemma && row.features.person === person && row.features.derivation?.some(value => value.startsWith('copula-'))), surface);
    assert.ok(isClausePredicate(surface)); assert.equal(legacyModelMorphology.analyzeWord(surface).length, 0);
    assert.equal(artifactMorphology.analyzeWord(surface).length, 0);
  }
  assert.equal(productiveMorphology.findByFoldedForm('muellimem'), 'müəlliməm');
  assert.equal(productiveMorphology.findByFoldedForm('mektebdeyem'), 'məktəbdəyəm');
  assert.equal(productiveMorphology.analyzeWord('məktəbdəam').length, 0);
  assert.equal(productiveMorphology.analyzeWord('müəllimum').length, 0);
  assert.equal(productiveMorphology.analyzeWord('tamuydurmasözdür').length, 0);
});
test('scoped syntax distinguishes hunger, questions, contrasts and completed causal clauses', () => {
  const cases = [
    ['o ac idi yemeyi yedi sonra qapini ac', 'O, ac idi. Yeməyi yedi. Sonra qapını aç.'],
    ['men bakida yasayiram sen harda yasayirsan', 'Mən Bakıda yaşayıram. Sən harada yaşayırsan?'],
    ['bu gun hava yaxsidir sabah ise yagis yagacaq', 'Bu gün hava yaxşıdır. Sabah isə yağış yağacaq.'],
    ['server cavab vermedi buna gore backend komandasina yazdim onlar problemi hell etdiler', 'Server cavab vermədi. Buna görə backend komandasına yazdım. Onlar problemi həll etdilər.'],
  ];
  for (const [input, expected] of cases) assert.equal(correctText(input, true).text, expected);
  assert.equal(correctText('O, ac idi. Qapını aç.', true).text, 'O, ac idi. Qapını aç.');
  assert.equal(correctText('Mən işə getdim.', true).text, 'Mən işə getdim.');
});
test('ambiguous numerals retain counted noun phrases without disabling verbal readings', () => {
  assert.equal(correctText('Xidmət iyirmi dörd saat, yeddi gün fəaliyyət göstərir.', true).text, 'Xidmət iyirmi dörd saat, yeddi gün fəaliyyət göstərir.');
  assert.ok(isClausePredicate('yeddi'));
});
