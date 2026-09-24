import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAnimatedDiff } from '../lib/ui/text-diff';

test('word diff highlights the full corrected Azerbaijani words', () => {
  const parts = buildAnimatedDiff('men cox', 'mən çox');
  const changed = parts.filter((part) => part.changed).map((part) => part.text);
  assert.deepEqual(changed, ['mən', 'çox']);
});

test('capitalization change highlights the full word', () => {
  const parts = buildAnimatedDiff('salam', 'Salam.');
  const changed = parts.filter((part) => part.changed).map((part) => part.text);
  assert.deepEqual(changed, ['Salam', '.']);
  assert.equal(parts.map((part) => part.text).join(''), 'Salam.');
});

test('new output words are highlighted as whole words', () => {
  const parts = buildAnimatedDiff('salam', 'Salam dünya.');
  const changed = parts.filter((part) => part.changed).map((part) => part.text);
  assert.deepEqual(changed, ['Salam', 'dünya', '.']);
});

test('unchanged output stays unhighlighted', () => {
  const parts = buildAnimatedDiff('API hazırdır', 'API hazırdır');
  assert.equal(parts.some((part) => part.changed), false);
});

test('punctuation-only insertions are visible', () => {
  assert.deepEqual(buildAnimatedDiff('Salam', 'Salam.').filter(p => p.changed), [{ text: '.', changed: true }]);
});

test('insertions and deletions retain following anchors', () => {
  assert.deepEqual(buildAnimatedDiff('bir artıq iki üç', 'bir iki yeni üç').filter(p => p.changed).map(p => p.text), ['yeni']);
});

test('pathological many-short-token diff stays bounded', () => {
  const start = performance.now();
  const output = 'b '.repeat(5000);
  assert.equal(buildAnimatedDiff('a '.repeat(5000), output).map(p => p.text).join(''), output);
  assert.ok(performance.now() - start < 1000);
});
