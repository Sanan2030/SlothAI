import assert from 'node:assert/strict';
import test from 'node:test';
import type { PairedModel } from '../lib/editor/local-ai/paired';
import { correctText, formatEmail } from '../lib/editor/correct';
import { neuralSpelling } from '../lib/editor/neural/runtime';
import { createNominalRepair } from '../lib/editor/neural/nominal-repair';
import model from '../lib/editor/neural/model.json';
import pairs from '../data/neural/diverse-pairs.json';

const fixedIds = new Set(['diverse-062', 'diverse-063', 'diverse-064', 'diverse-065', 'diverse-066', 'diverse-071']);
for (const row of pairs.rows.filter(row => fixedIds.has(row.id))) {
  test(`fixed nominal output: ${row.id}`, () => {
    assert.equal(correctText(row.input).text, row.target);
    assert.equal(neuralSpelling(row.input), row.target);
    assert.ok(formatEmail(row.input, { omitSubject: true }).text.includes(row.target));
    assert.equal(correctText(row.target).text, row.target);
  });
}

const fresh = [
  ['Maktubların ünvanı siyahıda göstərilib.', 'Məktubların ünvanı siyahıda göstərilib.'],
  ['Maktublarla bağlı cavab aldıq.', 'Məktublarla bağlı cavab aldıq.'],
  ['Ehtiyat nüsxə qovluqqdan götürüldü.', 'Ehtiyat nüsxə qovluqdan götürüldü.'],
  ['Qovluqqdakı faylı arxivə köçürün.', 'Qovluqdakı faylı arxivə köçürün.'],
  ['Əməkkdaşlarımızdan rəy istədik.', 'Əməkdaşlarımızdan rəy istədik.'],
  ['Əməkkdaşlara yeni kart verdilər.', 'Əməkdaşlara yeni kart verdilər.'],
  ['Taləbələrimizə cihazı göstərdik.', 'Tələbələrimizə cihazı göstərdik.'],
  ['Taləbələrdən iki nəfər müsabiqəyə qatıldı.', 'Tələbələrdən iki nəfər müsabiqəyə qatıldı.'],
  ['Senadlərimin surətini çıxardım.', 'Sənədlərimin surətini çıxardım.'],
  ['Senadlərimizdən biri arxivdədir.', 'Sənədlərimizdən biri arxivdədir.'],
  ['Hesabbatlarımdakı məbləğləri yoxlayın.', 'Hesabatlarımdakı məbləğləri yoxlayın.'],
  ['Hesabbatlardan alınan rəqəmləri cədvələ yazdıq.', 'Hesabatlardan alınan rəqəmləri cədvələ yazdıq.'],
  ['maktublarimizdaki', 'məktublarımızdakı'],
];
for (const [input, expected] of fresh) test(`nominal repair transfers without sentence replay: ${input}`, () => {
  assert.equal(neuralSpelling(input), expected);
  assert.equal(neuralSpelling(expected), expected);
});

test('morphology repair abstains on ambiguous roots, unsupported suffixes and large edits', () => {
  const ambiguous = createNominalRepair({ ...(model.lexicon as PairedModel),
    words: { səhər: { count: 1, context: {}, pos: [] }, şəhər: { count: 1, context: {}, pos: [] } } });
  assert.equal(ambiguous('sahərləri'), undefined);
  const repair = createNominalRepair(model.lexicon as PairedModel);
  for (const raw of ['olunan', 'itdi', 'maktubxyz', 'maktublərlə', 'hesabbatlardax', 'zzmaktubları', 'məktubları', 'API_KEYS']) assert.equal(repair(raw), undefined, raw);
});

test('valid lexical forms and protected technical names remain intact', () => {
  for (const text of [
    'Qəbul olunan sənəd hazırdır.', 'Vergi kodu itdi.', 'Bu hadisə yarışa səbəb oldu.',
    'Rəhbər gələndə məlumat verin.', 'Məktubları qovluqların yanında saxladıq.',
    'Hesabatlardakı rəqəmlər düzgündür.', 'API, backend, OAuth2 və GitHub adlarını qoruyun.',
  ]) assert.equal(neuralSpelling(text), text);
});
