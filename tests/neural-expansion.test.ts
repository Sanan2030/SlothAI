import assert from 'node:assert/strict';
import test from 'node:test';
import expansion from '../data/neural/expansion-pairs.json';
import diverse from '../data/neural/diverse-pairs.json';
import { correctText } from '../lib/editor/correct';
import { neuralSpelling } from '../lib/editor/neural/runtime';
import { auditPairs } from '../scripts/neural-data-quality';
import { collectPairedEvidence, trainPaired } from '../lib/editor/local-ai/paired';
import posArtifact from '../lib/editor/local-ai/pos-model.json';
import type { POSModel } from '../lib/editor/local-ai/pos';

test('expansion contexts are distinct across previous and new datasets', () => {
  const audit = auditPairs([...diverse.rows, ...expansion.rows]);
  assert.deepEqual(audit.duplicates, []);
  assert.deepEqual(audit.nearDuplicates, []);
  assert.deepEqual(audit.splitLeaks, []);
  assert.equal(expansion.rows.filter(row => row.split === 'train').length, 24);
  assert.equal(expansion.rows.filter(row => row.split === 'validation').length, 8);
});
for (const row of expansion.rows.filter(row => row.split === 'test')) {
  test(`expanded holdout stays exact in core and neural spelling: ${row.id}`, () => {
    assert.equal(correctText(row.input).text, row.target);
    assert.equal(neuralSpelling(row.input), row.target);
  });
}
test('evidence-only collection preserves the full trainer counts without unused classifier updates', () => {
  const pairs = expansion.rows.filter(row => row.split === 'train');
  const evidence = collectPairedEvidence(pairs, posArtifact as POSModel);
  const full = trainPaired(pairs, posArtifact as POSModel);
  for (const key of ['words', 'edits', 'channels', 'splits'] as const) assert.deepEqual(evidence[key], full[key]);
  assert.ok(evidence.weights.every(value => value === 0));
  assert.ok(full.weights.some(value => value !== 0));
  assert.throws(() => collectPairedEvidence(expansion.rows, posArtifact as POSModel), /Only training/);
});

test('spelling does not replace one valid regular case with another', async () => {
  const { areRegularCaseAlternatives } = await import('../lib/editor/neural/morphology');
  for (const [left, right] of [['qrupa', 'qrupu'], ['kluba', 'klubun'], ['kursa', 'kursda'], ['fondan', 'fonda']]) {
    assert.ok(areRegularCaseAlternatives(left, right), left);
  }
  assert.equal(areRegularCaseAlternatives('qrippa', 'qrupu'), false);
  assert.equal(areRegularCaseAlternatives('qrupə', 'qrupu'), false);
  assert.equal(areRegularCaseAlternatives('qruppa', 'qrupa'), false);
  for (const text of ['Bu tapşırığın hansı qrupa aid olduğunu dəqiqləşdirməyə kömək edin.',
    'Axşam kluba üzv olmaq üçün ərizə verdim.', 'Sınaq zamanı kursda əlavə suallar verildi.']) {
    assert.equal(neuralSpelling(text), text);
    assert.equal(correctText(text).text, text);
  }
});
