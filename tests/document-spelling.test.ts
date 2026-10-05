import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import corpus from '../data/nlp/documents/document-workflow-001.json';
import artifact from '../lib/editor/neural/document-model.json';
import report from '../data/nlp/documents/document-training-report.json';
import { documentSpelling } from '../lib/editor/neural/document-runtime';
import { isEstablishedSurface } from '../lib/editor/lexicon';
import { tokenize } from '../lib/editor/local-ai/core';
import { parameterCount } from '../lib/editor/neural/network';

test('document model trains on individual name-free source fragments with truthful provenance', () => {
  assert.equal(artifact.corpusSHA256, createHash('sha256').update(readFileSync('data/nlp/documents/document-workflow-001.json')).digest('hex'));
  assert.equal(corpus.provenance.documentCount, 1);
  assert.equal(corpus.sentences.length, 145);
  assert.ok(corpus.sentences.every(row => row.split === 'train' && row.annotationStatus === 'assistant-curated-source' && !row.target.includes('\n')));
  assert.deepEqual(artifact.lexicon.splits, {});
  assert.equal(parameterCount(artifact.network), 313);
  assert.ok(report.finalTrainingBCE < report.initialTrainingBCE);
  assert.ok(Buffer.byteLength(JSON.stringify(artifact)) < 140_000);
});

test('document ranker preserves learned correct sentences and protected spans', () => {
  for (const row of corpus.sentences) assert.equal(documentSpelling(row.target), row.target);
  for (const text of ['API backend deploy commit framework database.', 'https://example.com/a test@example.com `git commit`',
    'NaməlumXüsusiAd gridə daxil oldu.', 'Filtr dəyişdi.', 'Salam, hər vaxtınız xeyir olsun.'])
    assert.equal(documentSpelling(text), text);
});

test('document ranker only emits recognized source/dictionary surfaces and is stable', () => {
  assert.equal(documentSpelling('Operator senedin daxil edilmesi uchun melumatlari doldurur.'),
    'Operator sənədin daxil edilməsi üçün məlumatları doldurur.');
  for (const input of ['Istifadechi senedin melumatlarini gridde yoxlayir.', 'Muvafiq sutunlarin ardicillighi sistemde gosterilir.',
    'Sechilmish deyeri xanadan silmek mumkundur.', 'Operator senedin daxil edilmesi uchun melumatlari doldurur.']) {
    const output = documentSpelling(input);
    assert.equal(documentSpelling(output), output);
    const before = tokenize(input), after = tokenize(output);
    assert.equal(before.length, after.length);
    for (let at = 0; at < before.length; at++) if (before[at].word !== after[at].word) assert.ok(isEstablishedSurface(after[at].word));
  }
});
