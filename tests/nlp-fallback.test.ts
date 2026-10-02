import assert from 'node:assert/strict';
import test from 'node:test';
import { neuralTranspositions } from '../lib/editor/neural/runtime';
import { correctText } from '../lib/editor/correct';
test('experimental fallback is optional and cannot replace valid or protected tokens', () => {
  let calls = 0;
  assert.equal(neuralTranspositions('kitab API backend', undefined, () => { calls++; return 'sənəd'; }), 'kitab API backend');
  assert.equal(calls, 0);
  assert.equal(neuralTranspositions('şüşee', undefined, () => 'suse'), 'şüşee');
  assert.equal(neuralTranspositions('kitabb', undefined, raw => raw === 'kitabb' ? 'kitab' : undefined), 'kitab');
  const input = 'Müraciətin nömrəsini yadda saxlayın.';
  assert.equal(correctText(input, false, { neuralFallback: () => undefined }).text, correctText(input).text);
});
