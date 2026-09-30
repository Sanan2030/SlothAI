import assert from 'node:assert/strict';
import test from 'node:test';
import corpus from '../data/local-ai/context-corpus.json';
import baseline from '../data/local-ai/context-baseline.json';
import { contextTrainingTexts } from '../scripts/context-training';
import { fold, tokenize } from '../lib/editor/local-ai/core';
import { createLocalPredictor } from '../lib/editor/local-ai/predict';

test('context training stays disjoint from all reserved model and editorial evaluations', () => {
  assert.equal(contextTrainingTexts().length, 60);
  assert.equal(corpus.rows.filter(row => row.split === 'validation').length, 24);
  assert.equal(corpus.rows.filter(row => row.split === 'test').length, 36);
  for (const word of new Set(corpus.rows.map(row => row.word))) {
    assert.equal(corpus.rows.filter(row => row.word === word && row.split === 'train').length, 5);
  }
});

test('reserved context decisions have no wrong substitutions and preserve baseline successes', () => {
  // Fixed pre-training correct decisions; abstentions are explicitly permitted.
  const protectedIds = new Set(baseline.rows.filter(row => row.correct).map(row => row.id));
  let accepted = 0;
  for (const row of corpus.rows.filter(row => row.split === 'test')) {
    const targetTokens = tokenize(row.text);
    const at = targetTokens.findIndex(token => token.word.toLocaleLowerCase('az-AZ') === row.word);
    const input = fold(row.text).replace(/[.,!?]/gu, '');
    const token = tokenize(input)[at];
    const result = createLocalPredictor(input)(token.word, token.start);
    if (result !== undefined) { accepted++; assert.equal(result, row.word, row.id); }
    if (protectedIds.has(row.id)) assert.equal(result, row.word, `Baseline regression: ${row.id}`);
  }
  assert.ok(accepted >= 28);
});

test('isolated ambiguous words and accented spellings do not receive speculative substitutions', () => {
  for (const word of ['seher', 'suret', 'el', 'et', 'uc', 'adi']) {
    assert.equal(createLocalPredictor(word)(word, 0), undefined);
  }
  for (const word of ['şəhər', 'səhər', 'sürət', 'əl', 'ət', 'üç', 'adı']) {
    assert.equal(createLocalPredictor(`${word} qeydiyyat sənədində yazılıb`)(word, 0), undefined);
  }
});
