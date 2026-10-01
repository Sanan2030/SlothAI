import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { alignTokens, candidateIndex, editChannels, pairedCandidates, trainPaired, type CorrectionPair, type PairedModel } from '../lib/editor/local-ai/paired';
import { alignedGaps, insertJointBoundaries, jointContextTokens, type JointBoundaryModel } from '../lib/editor/local-ai/joint-boundary';
import { summarizeReliability, wilsonLower } from '../lib/editor/local-ai/reliability';
import { tagPOS, trainPOS } from '../lib/editor/local-ai/pos';
import { reviewedTrainingPairs } from '../scripts/reviewed-training-pairs';
import { productiveMorphology } from '../lib/editor/productive-morphology';
import { correctText } from '../lib/editor/correct';
import artifact from '../lib/editor/local-ai/paired-model.json';
import boundary from '../lib/editor/local-ai/joint-boundary-model.json';
import splits from '../data/local-ai/ud/splits.json';
import additions from '../data/local-ai/paired-additions.json';
import { tokenize } from '../lib/editor/local-ai/core';
const pair = (input: string, target: string, id = 'example'): CorrectionPair => ({ id, groupId: id, input, target, split: 'train' });

test('paired alignment retains repeated-word target positions and punctuation labels', () => {
  const example = pair('sənəd hazırdır sənəd göndərildi', 'Sənəd hazırdır. Sənəd göndərildi.');
  assert.deepEqual(alignTokens(example).map(row => [row.at, row.targetAt]), [[0, 0], [1, 1], [2, 2], [3, 3]]);
  assert.deepEqual(alignedGaps(example).map(row => row.target), [0, 1, 0]);
  const dropped = alignTokens(pair('sənəd yoxlandı göndərildi', 'Sənəd yenidən yoxlandı, göndərildi.'));
  assert.deepEqual(dropped.map(row => row.targetAt), [0, 2, 3]);
});

test('character channels learn insertions, deletions and substitutions', () => {
  assert.deepEqual(editChannels('metubu', 'məktubu'), ['insert:k']);
  assert.deepEqual(editChannels('mekktubu', 'məktubu'), ['remove:k']);
  assert.deepEqual(editChannels('mektubo', 'məktubu'), ['sub:o>u']);
});

test('candidate generation repairs unseen missing, extra and swapped letters', () => {
  const model = artifact as PairedModel;
  const index = candidateIndex(model);
  for (const input of ['məktbu', 'məktubuu', 'məktbuu']) {
    assert.equal(model.edits[input], undefined);
    assert.ok(pairedCandidates(model, index, input).includes('məktubu'), input);
  }
  assert.ok(!pairedCandidates(model, index, 'Github').includes('GitHub'));
  assert.ok(pairedCandidates(model, index, 'x'.repeat(30)).length <= 32);
});

test('training consumes source errors, rejects held-out examples and ambiguous spacing', () => {
  const pos = trainPOS([[{ word: 'məktubu', lemma: 'məktub', pos: 'NOUN' }]]);
  const inputs = [pair('metubu', 'məktubu'), pair('mekktubu', 'məktubu')];
  const learned = trainPaired(inputs, pos);
  assert.equal(learned.edits.metubu.məktubu, 1);
  assert.equal(learned.edits.mekktubu.məktubu, 1);
  assert.ok(learned.channels['insert:k']);
  assert.ok(learned.weights[1] >= 0 && learned.weights.slice(2).every(weight => weight >= 0));
  assert.throws(() => trainPaired([{ ...inputs[0], split: 'test' }], pos), /Only training/);
  const ambiguous = trainPaired([pair('abdef', 'ab def'), pair('abdef', 'abd ef'), pair('abdef', 'ab def')], pos);
  assert.equal(ambiguous.splits.abdef, undefined);
});

test('POS uses contextual transitions and preserves annotated lemma alternatives', () => {
  const sentences = Array.from({ length: 8 }, () => [
    { word: 'mən', lemma: 'mən', pos: 'PRON' }, { word: 'yaz', lemma: 'yazmaq', pos: 'VERB' },
  ]);
  const model = trainPOS([...sentences, ...Array.from({ length: 8 }, () => [
    { word: 'gözəl', lemma: 'gözəl', pos: 'ADJ' }, { word: 'yaz', lemma: 'yaz', pos: 'NOUN' },
  ])]);
  assert.equal(tagPOS(model, ['mən', 'yaz'])[1].tag, 'VERB');
  assert.equal(tagPOS(model, ['gözəl', 'yaz'])[1].tag, 'NOUN');
  assert.equal(tagPOS(model, ['mən', 'yaz'])[1].lemma, undefined);
  assert.deepEqual(tagPOS(model, []), []);
});

test('parallel UD families and corruption families remain in exactly one split', () => {
  const groups = new Map<string, string>();
  for (const row of [...splits, ...additions.rows]) {
    assert.ok(!groups.has(row.group) || groups.get(row.group) === row.split);
    groups.set(row.group, row.split);
  }
  const trainTargets = new Set(additions.rows.filter(row => row.split === 'train').map(row => row.target));
  assert.ok(additions.rows.filter(row => row.split !== 'train').every(row => !trainTargets.has(row.target)));
});

test('productive analysis covers new roots and genuine ASCII meanings', () => {
  for (const [word, lemma, pos] of [['qovluğa', 'qovluq', 'noun'], ['içdi', 'iç', 'verb'], ['oturur', 'otur', 'verb'], ['rənglənir', 'rənglə', 'verb']]) {
    assert.ok(productiveMorphology.analyzeWord(word).some(row => row.lemma === lemma && row.pos === pos), word);
  }
  assert.equal(correctText('Nərmin günorta evdə oturur.').text, 'Nərmin günorta evdə oturur.');
});

test('joint boundaries preserve dependencies, converbs, noun phrases and offsets', () => {
  const model = boundary as JointBoundaryModel;
  for (const input of ['Paralel icra üçün iki struktur bölmə seçildi.', 'Kubernetes podu yaddaş limitinə çatdı.', 'Dedi ki sənədi yoxlayıb məlumatı göndərəcək.', 'Komanda sənədi yoxlayıb qeydiyyatı tamamlayır.']) {
    assert.equal(insertJointBoundaries(input, model), input);
    const virtual = jointContextTokens(input, word => word, model);
    assert.deepEqual(virtual.map(({ start, end, word }) => ({ start, end, word })), tokenize(input).map(({ start, end, word }) => ({ start, end, word })));
  }
});

test('reliability counts wrong edits, abstentions and correlated families separately', () => {
  const summary = summarizeReliability([
    { score: 0.95, accepted: true, correct: true, group: 'a' },
    { score: 0.99, accepted: true, correct: false, group: 'a' },
    { score: 0.3, accepted: false, correct: true, group: 'b' },
  ]);
  assert.equal(summary.wrong, 1); assert.equal(summary.abstained, 1);
  assert.equal(summary.acceptedGroups, 1); assert.equal(summary.allCorrectGroups, 0);
  assert.equal(summary.precision, 0.5); assert.equal(wilsonLower(0, 0), null);
  assert.ok(wilsonLower(10, 10)! < 1);
});

test('real reviewed pairs require a valid explicit file and reject conflicting targets', () => {
  const directory = mkdtempSync(join(tmpdir(), 'slothai-reviewed-'));
  const filename = join(directory, 'pairs.json');
  const example = { id: '1', module: 'text', input: 'metubu', expected: 'məktubu', actual: 'metubu', preserveFormatting: false, reviewedAt: '2026-10-01T00:00:00Z' };
  try {
    writeFileSync(filename, JSON.stringify({ kind: 'slothai-reviewed-tests', version: 1, cases: [example] }));
    assert.equal(reviewedTrainingPairs(filename)[0].target, 'məktubu');
    assert.deepEqual(reviewedTrainingPairs(), []);
    writeFileSync(filename, JSON.stringify({ kind: 'slothai-reviewed-tests', version: 1, cases: [example, { ...example, id: '2', expected: 'kitab' }] }));
    assert.throws(() => reviewedTrainingPairs(filename), /Conflicting/);
  } finally { rmSync(directory, { recursive: true }); }
});
