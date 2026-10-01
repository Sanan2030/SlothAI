import assert from 'node:assert/strict';
import test from 'node:test';
import { createNetwork, trainNetwork, predictNetwork, parameterCount } from '../lib/editor/neural/network';
import { neuralAgreement } from '../lib/editor/neural/runtime';
import { finiteAnalyses, agreementForms } from '../lib/editor/neural/morphology';
import { correctText } from '../lib/editor/correct';
import corpus from '../data/neural/corpus.json';
import challenge from '../data/neural/challenge.json';
import model from '../lib/editor/neural/model.json';

test('nonlinear network learns XOR and resumable SGD reproduces uninterrupted steps', () => {
  const rows = Array.from({ length: 24 }, () => [{ x: [0, 0], y: 0 }, { x: [0, 1], y: 1 }, { x: [1, 0], y: 1 }, { x: [1, 1], y: 0 }]).flat();
  const trained = createNetwork(2, 8, 7); trainNetwork(trained, rows, 80);
  for (const row of rows.slice(0, 4)) assert.equal(predictNetwork(trained, row.x) > 0.5, Boolean(row.y));
  const first = createNetwork(2, 8, 7), second = createNetwork(2, 8, 7);
  trainNetwork(first, rows, 12); trainNetwork(second, rows, 6);
  const resumed = JSON.parse(JSON.stringify(second)); trainNetwork(resumed, rows, 6);
  assert.deepEqual(first, resumed);
  assert.throws(() => predictNetwork(first, [1]), /dimensions/);
  assert.throws(() => trainNetwork(first, rows, 201), /bounded/);
});

test('small artifact bounds deployment and synthetic families stay disjoint', () => {
  assert.equal(parameterCount(model.lexical) + parameterCount(model.agreement), 494);
  assert.ok(Buffer.byteLength(JSON.stringify(model)) < 110000);
  const groups = new Map<string, string>();
  for (const row of [...corpus.lexical, ...corpus.agreement]) {
    assert.ok(!groups.has(row.groupId) || groups.get(row.groupId) === row.split); groups.set(row.groupId, row.split);
  }
  const targets = new Set(corpus.lexical.filter(row => row.split === 'train').map(row => row.target));
  assert.ok(corpus.lexical.filter(row => row.split !== 'train').every(row => !targets.has(row.target)));
});

test('independent correction probes preserve code, coordination and correct agreement', () => {
  for (const row of challenge.rows) assert.equal(correctText(row.input).text, row.expected, row.input);
  assert.equal(neuralAgreement('Mən gələndə sən gedirsən.'), 'Mən gələndə sən gedirsən.');
  assert.equal(neuralAgreement('Mən telefonu söndürüb yatdım, amma yağmadı.'), 'Mən telefonu söndürüb yatdım, amma yağmadı.');
});

test('new morphology seam prevents duplicated second-person past vowels', () => {
  assert.deepEqual(agreementForms({ lemma: 'hazırla', pos: 'verb', features: { tense: 'past', polarity: 'positive', person: 2, number: 'plural' }, limit: 4 }).filter(word => !word.includes('nıl')), ['hazırladınız', 'hazırlandınız']);
  assert.ok(finiteAnalyses('hazırladınız').some(row => row.lemma === 'hazırla' && row.features.person === 2));
});
