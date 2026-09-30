import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { correctText, formatEmail } from '../lib/editor/correct';
import { productiveMorphology } from '../lib/editor/productive-morphology';
import { languageServices } from '../lib/editor/language-services';
import { insertLearnedBoundaries } from '../lib/editor/local-ai/predict';
import { trainSequenceRanker, predictSequence } from '../lib/editor/local-ai/sequence';
import { tokenize, fold } from '../lib/editor/local-ai/core';
import { expandContextModel, type TrainingExpansion } from '../lib/editor/local-ai/expand';
import { trainContextModel } from '../lib/editor/local-ai/core';
import gold from './fixtures/independent-gold-v2.json';
import rsd from './fixtures/rsd-it-holdout.json';
import mail from './fixtures/email-holdout.json';
import expansion from '../data/local-ai/expansion.json';

for (const text of ['Mən şəhərin sakitliyini sevirəm.', 'Şəhərin oyanışını fotoqraf çəkdi.',
  'Səhərin ilk işığı torpağa düşdü.', 'Şəhərin ilk işığı torpağa düşdü.',
  'Şəhər havası təmizdir.', 'Səhər havası təmizdir.', 'Mən səhərin sakitliyini sevirəm.']) {
  test(`explicit meaning is preserved: ${text}`, () => {
    assert.equal(correctText(text).text, text);
    assert.equal(correctText(text, false, { useLocalModel: false }).text, text);
  });
}

test('morphology uses editorially specified paradigms, not its own generated labels', () => {
  for (const [lemma, expected] of [
    ['park', ['park', 'parkın', 'parka', 'parkı', 'parkda', 'parkdan']],
    ['ürək', ['ürək', 'ürəyin', 'ürəyə', 'ürəyi', 'ürəkdə', 'ürəkdən']],
    ['dəyişiklik', ['dəyişiklik', 'dəyişikliyin', 'dəyişikliyə', 'dəyişikliyi', 'dəyişiklikdə', 'dəyişiklikdən']],
  ] as const) assert.deepEqual(productiveMorphology.generateForms({ lemma, pos: 'noun', limit: 6 }), expected);
  for (const [lemma, expected] of [['yaz', 'yazacağam'], ['oxu', 'oxuyacağam'], ['gəl', 'gələcəyəm'],
    ['qoru', 'qoruyacağam'], ['et', 'edəcəyəm'], ['yarat', 'yaradacağam']] as const) {
    assert.ok(productiveMorphology.generateForms({ lemma, pos: 'verb', features: {
      tense: 'future', person: 1, number: 'singular', polarity: 'positive' }, limit: 256 }).includes(expected));
  }
  for (const wrong of ['paryın', 'paryı', 'yazacayam', 'oxuyacayam', 'getiləcək', 'etiləcək', 'qoruyanıb']) {
    assert.equal(productiveMorphology.isValidWordForm(wrong), false, wrong);
    assert.ok(!expansion.forms.some(row => row.word === wrong));
  }
  for (const word of ['eşidir', 'düzəldir', 'yaradır', 'qayıdır', 'edilir', 'gedilir', 'gəlinir',
    'gedib', 'edib', 'edən', 'oxuyan', 'göndərin', 'oxuyun']) assert.ok(productiveMorphology.isValidWordForm(word), word);
});

test('incorrect morphology labels cannot enter a rebuilt model', () => {
  const corrupt: TrainingExpansion = { forms: [{ lemma: 'park', word: 'paryın', grammaticalCase: 'genitive',
    texts: ['Bu gün paryın təsviri diqqətlə araşdırıldı.', 'Dünən paryın təsviri diqqətlə araşdırıldı.',
      'İclasda paryın təsviri diqqətlə araşdırıldı.'] }], boundaries: [] };
  assert.throws(() => expandContextModel(trainContextModel(['Mən kitab oxuyuram.']), corrupt), /Invalid morphology training label/u);
});

test('lemma and surface are separate, and ordinary restoration retains the inflection', () => {
  const entry = languageServices.lemmaDictionary.findByFoldedForm('layihelerimizden').entries;
  assert.ok(entry.some(row => row.lemma === 'layihə' && row.surface === 'layihələrimizdən' && row.pos === 'noun'));
  assert.equal(correctText('biz layihelerimizden danisiriq').text, 'Biz layihələrimizdən danışırıq.');
  assert.equal(correctText('Men bu meseleyi diqqetle arasdirdim').text, 'Mən bu məsələni diqqətlə araşdırdım.');
  assert.equal(correctText('biz teklifi tesdiqleyirik').text, 'Biz təklifi təsdiqləyirik.');
});

test('all 800 targets are complete and bound to frozen inputs without training leakage', () => {
  const inputs = new Map([...rsd, ...mail].map(row => [row.id, row.input]));
  assert.equal(gold.cases.length, 800);
  assert.equal(new Set(gold.cases.map(row => row.id)).size, 800);
  const training = new Set([readFileSync('data/local-ai/seeds.txt', 'utf8'),
    readFileSync('data/local-ai/supplemental-training.txt', 'utf8')].flatMap(value => value.trim().split('\n')));
  for (const row of gold.cases) {
    const input = inputs.get(row.id)!;
    assert.ok(input && row.expected.trim());
    assert.equal(createHash('sha256').update(input).digest('hex'), row.inputSha256);
    assert.ok(!training.has(row.expected), row.id);
  }
  assert.equal(gold.review.blindEvaluation, false);
});

test('ordered context ranker learns word positions, remains deterministic and abstains without evidence', () => {
  const training = ['Şəhər küçələri və binaları ilə tanınır.', 'Şəhər binaları və küçələri ilə seçilir.',
    'Səhər günəş doğanda oyandım.', 'Səhər günəş çıxanda oyandım.'];
  const model = trainSequenceRanker(training);
  assert.deepEqual(trainSequenceRanker(training), model);
  const fresh = ['seher yeni binalari ve kuceleri ile secilir', 'seher gunes doganda men oyandim'];
  assert.equal(predictSequence(model, tokenize(fresh[0]), 0), 'şəhər');
  assert.equal(predictSequence(model, tokenize(fresh[1]), 0), 'səhər');
  assert.equal(predictSequence(model, tokenize('seher'), 0), undefined);
  assert.equal(predictSequence(model, tokenize('səhər binaları küçələri'), 0), undefined);
  assert.ok(training.every(row => !fresh.some(text => fold(row) === text)));
});

test('dependent scopes extend beyond eight tokens and separate sentences close the scope', () => {
  const dependent = 'Mən bildim ki operator dünən bu sənədi çox böyük diqqətlə yeni sistemdə yoxladı müştəri nəticəni gözləyir';
  assert.equal(insertLearnedBoundaries(dependent), dependent);
  const explicit = 'Mən bildim ki operator sənədi yoxladı. Operator sənədi yoxladı müştəri nəticəni gözləyir';
  assert.equal(insertLearnedBoundaries(explicit), explicit.replace('yoxladı müştəri', 'yoxladı. müştəri'));
  assert.equal(insertLearnedBoundaries('Operator sənədi yoxladı müştəri barədə məlumat'), 'Operator sənədi yoxladı müştəri barədə məlumat');
});

test('compact mail recipient ends before body nouns and handles qualified titles', () => {
  for (const [input, greeting, beginning] of [
    ['salam komanda iki icraçı eyni sənədi yoxlayır', 'Hörmətli komanda,', 'İki icraçı'],
    ['hormetli test komandası qəbul sınağının iştirakçıları və tarixləri sənəddə yeniləndi', 'Hörmətli test komandası,', 'Qəbul sınağının'],
    ['hormetli rəhbər köməkçisi gələn həftənin iclası üçün dəvətlər hazırdır', 'Hörmətli rəhbər köməkçisi,', 'Gələn həftənin'],
  ]) {
    const output = formatEmail(input).text;
    assert.ok(output.includes(greeting + '\n\n' + beginning), output);
    assert.equal(formatEmail(output).text, output);
  }
});

test('long conditionals use morphology, not a character window or noun endings', () => {
  const input = 'Əgər operator bu gün bütün əlavə sənədləri yeni qaydalara uyğun olaraq böyük diqqətlə yoxlasa müştəriyə nəticə göndəriləcək';
  assert.equal(correctText(input).text,
    'Əgər operator bu gün bütün əlavə sənədləri yeni qaydalara uyğun olaraq böyük diqqətlə yoxlasa, müştəriyə nəticə göndəriləcək.');
  assert.equal(correctText('Əgər masa otaqda olsa görüş burada keçiriləcək').text,
    'Əgər masa otaqda olsa, görüş burada keçiriləcək.');
  assert.equal(correctText('Əgər gəlsəniz biz görüşərik').text, 'Əgər gəlsəniz, biz görüşərik.');
});
