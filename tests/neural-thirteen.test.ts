import assert from 'node:assert/strict';
import test from 'node:test';
import cases from './fixtures/neural-thirteen.json';
import model from '../lib/editor/neural/model.json';
import type { PairedModel } from '../lib/editor/local-ai/paired';
const lexicon = model.lexicon as PairedModel;
import { correctText, formatEmail } from '../lib/editor/correct';
import { neuralSpelling, preservesDiacritics } from '../lib/editor/neural/runtime';
import { createNominalRepair } from '../lib/editor/neural/nominal-repair';

for (const row of cases.rows) test(`remaining lexical regression: ${row.id}`, () => {
  assert.equal(neuralSpelling(row.input), row.expected);
  assert.equal(correctText(row.input).text, row.expected);
  assert.equal(neuralSpelling(row.expected), row.expected);
});
const fresh = [
  ['Meteblerimizdə robototexnika dərnəyi var.', 'Məktəblərimizdə robototexnika dərnəyi var.'],
  ['Mən muterilerimden cavab aldım.', 'Mən müştərilərimdən cavab aldım.'],
  ['Siketlerimizin müqavilələri yeniləndi.', 'Şirkətlərimizin müqavilələri yeniləndi.'],
  ['Teebelerimize kitab verdik.', 'Tələbələrimizə kitab verdik.'],
  ['Tellebelerimizlə görüşdük.', 'Tələbələrimizlə görüşdük.'],
  ['Mussterilerinizden gələn sualları cavablandırın.', 'Müştərilərinizdən gələn sualları cavablandırın.'],
  ['Muellimlerimizin tövsiyəsini oxudum.', 'Müəllimlərimizin tövsiyəsini oxudum.'],
  ['Senedlerinizde imza yoxdur.', 'Sənədlərinizdə imza yoxdur.'],
];
for (const [input, expected] of fresh) test(`repair transfers to another suffix and sentence: ${input}`, () => {
  assert.equal(neuralSpelling(input), expected);
  assert.equal(correctText(input).text, expected);
  assert.ok(formatEmail(input, { omitSubject: true }).text.includes(expected));
  assert.equal(correctText(expected).text, expected);
});
test('long diacritic restoration does not consume the structural edit budget', () => {
  assert.ok(preservesDiacritics('mussterilerimin', 'müştərilərimin'));
  assert.ok(preservesDiacritics('muellimlerimizin', 'müəllimlərimizin'));
  assert.ok(preservesDiacritics('tellebelerimizlə', 'tələbələrimizlə'));
  assert.equal(preservesDiacritics('şirkətlərimdə', 'sirkətlərimdə'), false);
  assert.equal(preservesDiacritics('məktəblərimiz', 'mekteblerimiz'), false);
  assert.equal(preservesDiacritics('kitab', 'laboratoriya'), false);
});
test('missing consonants require trained evidence and valid inflections', () => {
  const repair = createNominalRepair(lexicon);
  assert.equal(repair('meteblerimizdə'), 'məktəblərimizdə');
  const noInsertionEvidence = createNominalRepair({ ...lexicon, channels: {} });
  assert.equal(noInsertionEvidence('meteblerimizdə'), undefined);
  for (const raw of ['metebxyz', 'mteblerimizde', 'teebelerimxyz', 'siketlerimxyz']) assert.equal(repair(raw), undefined, raw);
  for (const input of ['Bu sənəd qrupa aiddir.', 'Səhərin havası təmizdir.',
    'GitHub, PostgreSQL və OAuth2 adlarını saxlayın.', 'Mən və sən sənədləri oxuduq.']) {
    assert.equal(neuralSpelling(input), input);
  }
});

test('dependent verb clauses are not converted into possessed noun forms', () => {
  const repair = createNominalRepair(lexicon);
  assert.equal(repair('catanda'), undefined);
  assert.equal(repair('catandan'), undefined);
  assert.equal(neuralSpelling('Evə çatandan sonra zəng et.'), 'Evə çatandan sonra zəng et.');
  assert.equal(neuralSpelling('Evə çatanda xəbər verin.'), 'Evə çatanda xəbər verin.');
  assert.equal(correctText('eve catanda xeber verin').text, 'Evə çatanda xəbər verin.');
});
