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
  assert.deepEqual(changed, ['Salam']);
  assert.equal(parts.map((part) => part.text).join(''), 'Salam.');
});

test('new output words are highlighted as whole words', () => {
  const parts = buildAnimatedDiff('salam', 'Salam dünya.');
  const changed = parts.filter((part) => part.changed).map((part) => part.text);
  assert.deepEqual(changed, ['Salam', 'dünya']);
});

test('unchanged output stays unhighlighted', () => {
  const parts = buildAnimatedDiff('API hazırdır', 'API hazırdır');
  assert.equal(parts.some((part) => part.changed), false);
});
