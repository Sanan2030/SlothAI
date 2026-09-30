import assert from 'node:assert/strict';
import test from 'node:test';
import corpus from '../data/local-ai/pairs.json';
import model from '../lib/editor/local-ai/model.json';
import { createLocalPredictor } from '../lib/editor/local-ai/predict';
import { trainContextModel } from '../lib/editor/local-ai/core';
import { correctText, formatEmail } from '../lib/editor/correct';

const cases = [
  ['seher belediyyesi parki ve binalari yoxlayir', 'şəhər'],
  ['seher zengli saatin sesine oyandim', 'səhər'],
  ['suret avtomobilin panelinde gosterilir', 'sürət'],
  ['suret arxivde senedin esli ile yoxlanilir', 'surət'],
] as const;

test('500 pairs have disjoint gold groups and a reproducible training artifact', () => {
  assert.equal(corpus.pairs.length, 500);
  assert.equal(new Set(corpus.pairs.map(pair => pair.input)).size, 500);
  const train = corpus.pairs.filter(pair => pair.split === 'train');
  const heldOut = corpus.pairs.filter(pair => pair.split === 'test');
  assert.equal(train.length, 400);
  assert.equal(heldOut.length, 100);
  const trainGroups = new Set(train.map(pair => pair.groupId));
  assert.ok(heldOut.every(pair => !trainGroups.has(pair.groupId)));
  const targets = [...new Set(train.map(pair => pair.target))];
  assert.equal(targets.length, 80);
  assert.deepEqual(trainContextModel(targets), model);
});

test('learned context generalizes to fresh sentences without an exact text lookup', () => {
  for (const [input, expected] of cases) {
    assert.ok(!corpus.pairs.some(pair => pair.input === input));
    assert.equal(createLocalPredictor(input)(input.split(' ')[0], 0), expected);
  }
  assert.equal(createLocalPredictor('seher')('seher', 0), undefined);
  assert.equal(createLocalPredictor('səhər bələdiyyəsi parkı yoxlayır')('səhər', 0), undefined);
  assert.equal(createLocalPredictor('seher gecə nəqliyyat küçə')('seher', 0), undefined);
});

test('both editor modes use the model, while literal code and URLs remain protected', () => {
  const input = 'suret avtomobilin panelinde gosterilir';
  assert.ok(correctText(input).text.startsWith('Sürət '));
  assert.ok(formatEmail(input, { emailGreeting: 'Salam,', omitSubject: true }).text.includes('Sürət '));
  const protectedInput = '`suret avtomobilin panelinde` https://example.com/seher';
  const result = correctText(protectedInput).text;
  assert.ok(result.includes('`suret avtomobilin panelinde`'));
  assert.ok(result.includes('https://example.com/seher'));
});
