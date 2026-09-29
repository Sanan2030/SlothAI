import assert from 'node:assert/strict';
import test from 'node:test';
import { EXPECTED_RESULTS_KEY, findExpectedResult, readExpectedResults,
  saveExpectedResult, writeExpectedResults } from '../lib/editor/expected-results';

test('approved example persists and returns only for the same module, input and format option', () => {
  const storage = new Map<string, string>();
  const store = { getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); } };
  const item = { module: 'text' as const, input: 'salam necesen', output: 'Salam, necəsən?', preserveFormatting: false };
  const updated = saveExpectedResult([], item);
  assert.equal(writeExpectedResults(store, updated), true);
  const loaded = readExpectedResults(store);
  assert.equal(findExpectedResult(loaded, item)?.output, item.output);
  assert.equal(findExpectedResult(loaded, { ...item, module: 'mail' }), undefined);
  assert.equal(findExpectedResult(loaded, { ...item, input: 'salam necesen!' }), undefined);
  assert.equal(findExpectedResult(loaded, { ...item, preserveFormatting: true }), undefined);
  assert.deepEqual(saveExpectedResult(loaded, { ...item, output: 'Salam! Necəsən?' }),
    [{ ...item, output: 'Salam! Necəsən?' }]);
  storage.set(EXPECTED_RESULTS_KEY, '{broken');
  assert.deepEqual(readExpectedResults(store), []);
});

test('example storage is bounded and rejects empty or oversized corrections', () => {
  const item = { module: 'text' as const, input: 'a', output: 'A.', preserveFormatting: false };
  let examples = [] as ReturnType<typeof saveExpectedResult>;
  for (let i = 0; i < 35; i++) examples = saveExpectedResult(examples, { ...item, input: `${i}` });
  assert.equal(examples.length, 30);
  assert.equal(findExpectedResult(examples, { ...item, input: '0' }), undefined);
  assert.throws(() => saveExpectedResult(examples, { ...item, output: ' ' }));
  assert.throws(() => saveExpectedResult(examples, { ...item, output: 'a'.repeat(10_001) }));
});
