import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import corpus from '../data/nlp/logs/log-2026-10-05-training.json';
import artifact from '../lib/editor/neural/log-model.json';
import ocr from '../lib/editor/log-ocr-model.json';
import { correctText } from '../lib/editor/correct';
import { logSpelling } from '../lib/editor/neural/log-runtime';
import { editOCRLabels, repairOCRTokens } from '../lib/editor/log-ocr';
import { parameterCount } from '../lib/editor/neural/network';
import { isEstablishedSurface } from '../lib/editor/lexicon';
import { tokenize } from '../lib/editor/local-ai/core';

test('log training records real, redacted fragments and deduplicates observed OCR tokens', () => {
  const hash = createHash('sha256').update(readFileSync('data/nlp/logs/log-2026-10-05-training.json')).digest('hex');
  assert.equal(artifact.corpusSHA256, hash);
  assert.equal(ocr.sourceSHA256, hash);
  assert.equal(corpus.provenance.uniqueInputs, 3);
  assert.equal(corpus.provenance.duplicateEntries, 1);
  assert.equal(new Set(corpus.sentences.map(row => row.target)).size, 14);
  assert.ok(!/yelo|bestcomp|sənan|senan|nəbizadə|nebizade/iu.test(JSON.stringify(corpus)));
  assert.equal(parameterCount(artifact.network), 313);
  assert.ok(Buffer.byteLength(JSON.stringify(artifact)) < 45_000);
  assert.equal(Object.keys(ocr.mappings).length, 99);
  assert.deepEqual(artifact.lexicon.splits, {});
});

test('observed story repairs do not rewrite correct targets and are idempotent', () => {
  for (const row of corpus.sentences) {
    assert.equal(correctText(row.input).text, row.target, row.id);
    assert.equal(correctText(row.target).text, row.target, row.id + ':identity');
    const actual = logSpelling(row.input), before = tokenize(row.input), after = tokenize(actual);
    assert.equal(before.length, after.length);
    for (let at = 0; at < before.length; at++) if (before[at].word !== after[at].word)
      assert.ok(isEstablishedSurface(after[at].word) || after[at].word.split('-').every(word => isEstablishedSurface(word)));
  }
});

test('OCR channel repairs only recognized generic list tokens and protects code/prose', () => {
  assert.equal(repairOCRTokens('Kredit inzibatla;dlnlmasl 5öböSi'), 'Kredit inzibatlaşdırılması şöbəsi');
  for (const text of ['const a = foo;bar; baz;', '# başlıq\n\nArxiv ;öbasi\n\nRisk departamenti',
    'https://example.com/50böS1\n\nArxiv ;öbasi\n\nRisk departamenti']) assert.equal(editOCRLabels(text, value => value), undefined);
  const input = 'Kredit inzibatla;dlnlmasl 5öböSi\n\nArxiv ;öbasi\n\nTexniki dastak ;öbasi';
  const expected = 'Kredit inzibatlaşdırılması şöbəsi\n\nArxiv şöbəsi\n\nTexniki dəstək şöbəsi';
  assert.equal(correctText(input).text, expected);
  assert.equal(correctText(expected).text, expected);
  const names = 'NaməlumŞirkət filiall\n\nArxiv ;öbasi\n\nTexniki dastak ;öbasi';
  const namedOutput = correctText(names).text;
  assert.ok(namedOutput.startsWith('NaməlumŞirkət filialı\n'));
  assert.equal(correctText(namedOutput).text, namedOutput);
});

test('contextual collocation never turns genuine discovery into importance', () => {
  assert.equal(correctText('Bu layihe boyuk ehemiyyet kesf edirdi.').text, 'Bu layihə böyük əhəmiyyət kəsb edirdi.');
  assert.equal(correctText('Alimler yeni planet kesf etdiler.').text, 'Alimlər yeni planet kəşf etdilər.');
  assert.equal(correctText('burda coxlu metn var meselen ').text, 'Burada çoxlu mətn var, məsələn…');
});
