import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAnimatedDiff } from '../lib/ui/text-diff';

test('character diff marks only changed Azerbaijani letters when words align', () => {
  const parts = buildAnimatedDiff('men cox', 'mən çox');
  const changed = parts.filter((part) => part.changed).map((part) => part.text);
  assert.deepEqual(changed, ['ə', 'ç']);
});

test('character diff marks capitalization without highlighting the whole word', () => {
  const parts = buildAnimatedDiff('salam', 'Salam.');
  const changed = parts.filter((part) => part.changed).map((part) => part.text);
  assert.deepEqual(changed, ['S']);
  assert.equal(parts.map((part) => part.text).join(''), 'Salam.');
});

test('new output words are highlighted as added content', () => {
  const parts = buildAnimatedDiff('salam', 'Salam dünya.');
  const changed = parts.filter((part) => part.changed).map((part) => part.text);
  assert.ok(changed.includes('S'));
  assert.ok(changed.includes('dünya'));
});

test('unchanged output stays unhighlighted', () => {
  const parts = buildAnimatedDiff('API hazırdır', 'API hazırdır');
  assert.equal(parts.some((part) => part.changed), false);
});
