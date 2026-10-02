import { createExperimentPredictor } from '../scripts/nlp/inference';
import artifact from '../lib/editor/neural/attention-model.json';
import baseModel from '../lib/editor/neural/model.json';
import { attentionLexicon, type AttentionArtifact } from '../lib/editor/neural/attention';
import { correctText } from '../lib/editor/correct';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildData, corrupt, protectedMask, splitDocuments, type Category, type CleanDocument } from '../scripts/nlp/data';
import { distance, edits, quality } from '../scripts/nlp/metrics';
import { attentionCandidates, transpositionIndex, createAttentionNetwork, contextKeys, attend } from '../lib/editor/neural/attention';
import type { PairedModel } from '../lib/editor/local-ai/paired';
import { tokenPosition } from '../lib/editor/neural/attention';

test('Unicode CER and exact edit precision separate useful repairs from overcorrection', () => {
  const row = { id: 'partial', input: 'men geldim', target: 'mən gəldim', actual: 'mən geldim', category: 'diacritics' };
  const score = quality([row]);
  assert.equal(score.truePositiveEdits, 1); assert.equal(score.falsePositiveEdits, 0); assert.equal(score.missedEdits, 1);
  assert.equal(score.precision, 1); assert.equal(score.recall, 0.5); assert.equal(score.f05, 1.25 / 1.5);
  assert.equal(score.charErrors, 1); assert.equal(score.wer, 0.5); assert.equal(score.accuracy, 0);
  const clean = quality([{ ...row, input: 'Mən gəldim.', target: 'Mən gəldim.', actual: 'Mən getdim.' }]);
  assert.equal(clean.identityFalseChangeRate, 1); assert.equal(clean.precision, 0); assert.equal(clean.recall, null);
  assert.equal(quality([]).cer, null);
});
test('alignment handles insertion, deletion, joining and Unicode without changing offsets', () => {
  assert.equal(distance([...'şüşə'], [...'suse']), 4);
  assert.deepEqual(edits(['a', 'b'], ['a', 'x', 'b']), [{ start: 1, end: 1, replacement: ['x'] }]);
  assert.deepEqual(edits(['a', 'b'], ['b']), [{ start: 0, end: 1, replacement: [] }]);
  assert.equal(distance(['a'], ['a', 'b']), 1);
  assert.throws(() => edits(Array(3000).fill('a'), Array(3000).fill('b')), /million/);
});
const documents: CleanDocument[] = [
  { documentId: 'doc-a', source: 'authored-fixture', license: 'fixture', text: 'Bu sənəddə istifadəçi hüquqları və təhlükəsizlik qaydaları ətraflı izah olunur.\n\nƏlavə hesabatda müraciətlərin emalı barədə müstəqil məlumat verilir.' },
  { documentId: 'doc-b', source: 'authored-fixture', license: 'fixture', text: 'Bu sənəddə istifadəçi hüquqları və təhlükəsizlik qaydaları ətraflı izah olunur.\n\nMüştərinin ödəniş planı ayrıca hazırlanır.' },
  { documentId: 'doc-c', source: 'authored-fixture', license: 'fixture', text: 'Dənizdə külək gücləndikcə gəmilər sahilə yaxınlaşır.' },
];
test('documents and shared source paragraphs stay in one split before corruption', () => {
  const split = splitDocuments(documents);
  const a = split.documents.find(doc => doc.documentId === 'doc-a')!, b = split.documents.find(doc => doc.documentId === 'doc-b')!;
  assert.equal(a.split, b.split); assert.equal(a.cluster, b.cluster);
  assert.throws(() => splitDocuments([...documents, documents[0]]), /Duplicate/);
  const duplicated = splitDocuments([...documents, { ...documents[0], documentId: 'copy-a' }]);
  assert.equal(duplicated.removedExactDuplicates.length, 1);
  const first = buildData(documents), second = buildData(documents);
  assert.deepEqual(first, second);
  for (const doc of documents) assert.equal(new Set(first.rows.filter(row => row.documentId === doc.documentId).map(row => row.split)).size, 1);
  assert.equal(new Set(first.rows.map(row => row.input + '\n' + row.target)).size, first.rows.length);
  assert.ok(first.rows.some(row => row.category === 'identity'));
});
test('all noise channels preserve names, foreign terms, numbers, code, URLs and email', () => {
  const text = '🙂 Əli backend API 12.5 https://example.az/a?q=ş email@site.az `şüşə` üçün gəlirəm sonra düşünmək lazımdır.';
  const terms = ['backend', 'API'];
  assert.equal(protectedMask(text, terms).length, text.length);
  const categories: Category[] = ['identity', 'diacritics', 'delete', 'insert', 'swap', 'keyboard', 'space', 'colloquial'];
  for (const category of categories) for (let seed = 0; seed < 10; seed++) {
    const output = corrupt(text, category, String(seed), terms);
    for (const value of ['Əli', 'backend', 'API', '12.5', 'https://example.az/a?q=ş', 'email@site.az', '`şüşə`']) assert.ok(output.includes(value), `${category}: ${value}`);
    assert.equal(output, corrupt(text, category, String(seed), terms));
  }
  for (const category of categories.filter(value => value !== 'identity')) assert.ok(Array.from({ length: 20 }, (_, at) => corrupt(text, category, String(at), terms)).some(output => output !== text), category);
});
test('sentence units never split a protected URL or numeric decimal', () => {
  const data = buildData([{ documentId: 'url', source: 'fixture', license: 'fixture', text: 'Məlumat https://example.az/path səhifəsində və 12.5 nömrəli bölmədə yerləşir. İstifadəçi sonra sənədi açır.' }]);
  const clean = data.rows.filter(row => row.category === 'identity');
  assert.equal(clean.length, 2); assert.ok(clean[0].target.includes('https://example.az/path')); assert.ok(clean[0].target.includes('12.5'));
});
test('direct diacritic candidate expansion is isolated from default production candidates', () => {
  const model = { words: { necəsən: {}, məktəblər: {} } } as unknown as PairedModel;
  const index = transpositionIndex(model);
  assert.deepEqual(attentionCandidates(index, 'necesen'), []);
  assert.deepEqual(attentionCandidates(index, 'necesen', 'folded-and-swaps'), ['necəsən']);
});
test('uniform and position ablations remove exactly their advertised mechanism', () => {
  const network = createAttentionNetwork(), { tokens, at } = tokenPosition('Biz sənədi sonra imzaladıq.', 'sənədi');
  network.experiment = { attention: 'uniform' };
  const result = attend(network, 'sənədi', contextKeys(tokens, at));
  assert.ok(result.weights.every(weight => weight === 1 / result.weights.length));
  assert.notDeepEqual(contextKeys(tokens, at), contextKeys(tokens, at, false));
});

test('an ambiguous neural abstention survives later dictionary correction', () => {
  assert.equal(correctText('Sehre nəqliyyatı haqqında hesabat yayımlandı.').text, 'Sehre nəqliyyatı haqqında hesabat yayımlandı.');
  assert.equal(correctText('Bu yol üçün suert limiti ayrıca təyin edilib.').text, 'Bu yol üçün suert limiti ayrıca təyin edilib.');
});

test('offline trained-bundle inference repairs swaps while preserving protected and valid spans', () => {
  const predictor = createExperimentPredictor({ artifact: artifact as AttentionArtifact, lexicon: attentionLexicon(baseModel.lexicon as PairedModel, artifact.vocabulary) });
  assert.equal(predictor('Biz konfiqruasiya sənədini açdıq.'), 'Biz konfiqurasiya sənədini açdıq.');
  const text = 'Əli konfiqruasiya https://example.az/a 12.5 backend kodunu saxladı.';
  assert.equal(predictor(text, ['konfiqruasiya', 'backend']), text);
});
