import assert from 'node:assert/strict';
import test from 'node:test';
import base from '../lib/editor/neural/model.json';
import { boundedCandidates } from '../lib/editor/neural/bounded-candidates';
import { transpositionIndex } from '../lib/editor/neural/attention';
import type { PairedModel } from '../lib/editor/local-ai/paired';
const model = base.lexicon as PairedModel, index = transpositionIndex(model);
for (const [raw, expected] of [['dusunmek', 'düşünmək'], ['maktablar', 'məktəblər'], ['lahiyede', 'layihədə'], ['muqavlie', 'müqavilə'], ['kitabb', 'kitab'], ['mektebde', 'məktəbdə']]) {
  test(`bounded candidate coverage: ${raw}`, () => {
    const candidates = boundedCandidates(model, index, raw);
    assert.ok(candidates.includes(expected), `${raw}: ${candidates.join(', ')}`); assert.ok(candidates.length <= 24);
  });
}
test('bounded generation protects valid forms, explicit letters and terminology', () => {
  for (const word of ['API', 'backend', 'məktəb', 'a'.repeat(25)]) assert.deepEqual(boundedCandidates(model, index, word), []);
  assert.ok(boundedCandidates(model, index, 'şüşee').every(word => word.includes('ş') && word.includes('ü')));
});
