import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dataset } from '../scripts/eval/datasets';
import { bootstrap, metrics } from '../scripts/eval/metrics';
test('phase 0 evaluation hashes, size, provenance and split quarantine', () => {
  const holdout = dataset('holdout-500'), noHarm = dataset('no-harm-2000'), calibration = dataset('calibration-100');
  assert.equal(holdout.cases.length, 500); assert.equal(new Set(holdout.cases.map(row => row.domain)).size, 25);
  assert.equal(holdout.cases.filter(row => row.input === row.expected).length, 150);
  assert.equal(new Set(noHarm.cases.map(row => row.probeWord)).size, 2000);
  const all = [holdout, noHarm, calibration];
  assert.equal(new Set(all.flatMap(data => data.cases.map(row => row.id))).size, 2600);
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const documents = new Set(all[i].cases.map(row => row.documentId)), texts = new Set(all[i].cases.map(row => row.expected));
    assert.ok(all[j].cases.every(row => !documents.has(row.documentId) && !texts.has(row.expected)));
  }
  assert.equal(calibration.purpose, 'calibration-only');
  assert.ok(all.every(data => data.trainingAllowed === false && data.provenance.includes('not')));
});
test('phase 0 metrics distinguish successful correction, harm and abstention', () => {
  const common = { domain: 'test', category: 'test', idempotent: true };
  const rows = [
    { ...common, id: 'a', documentId: 'a', input: 'söz', expected: 'söz', output: 'soz' },
    { ...common, id: 'b', documentId: 'b', input: 'soz', expected: 'söz', output: 'söz' },
    { ...common, id: 'c', documentId: 'c', input: 'soz', expected: 'söz', output: 'soz' },
  ];
  const result = metrics(rows, 100);
  assert.equal(result.estimates.precision.value, .5);
  assert.equal(result.estimates.recall.value, .5);
  assert.equal(result.estimates.falsePositiveRate.value, 1);
  assert.equal(result.estimates.errorAbstentionRate.value, .5);
  assert.equal(result.estimates.sentenceExact.value, 1 / 3);
  assert.deepEqual(metrics(rows, 100), result);
  assert.deepEqual(bootstrap([], () => 0), { value: null, ci95: null });
  assert.deepEqual(bootstrap([1, 1], () => 1).ci95, [1, 1]);
});
