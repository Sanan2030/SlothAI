import assert from 'node:assert/strict';
import test from 'node:test';
import { composeBoundedHeads, createBoundedHead, preservesWordEdges, isSingleMissingVowel, type BoundedBundle } from '../lib/editor/neural/bounded-head';
import base from '../lib/editor/neural/bounded-model.json';
import { tokenize } from '../lib/editor/local-ai/core';
test('domain adaptation cannot override an established correction', () => {
  let calls = 0;
  const head = composeBoundedHeads(() => 'məktəb', () => { calls++; return 'məktublar'; });
  assert.equal(head('maktab', tokenize('maktab'), 0), 'məktəb');
  assert.equal(calls, 0);
});
test('domain adaptation handles abstention without forcing a correction', () => {
  const tokens = tokenize('naməlumsöz');
  assert.equal(composeBoundedHeads(() => undefined, () => undefined)('naməlumsöz', tokens, 0), undefined);
  assert.equal(composeBoundedHeads(() => undefined, () => 'məktəb')('maktab', tokens, 0), 'məktəb');
});
test('bounded head protects foreign terms, proper names and explicit terms', () => {
  const head = createBoundedHead(base as BoundedBundle, ['konfiqurasya']);
  for (const raw of ['API', 'PostgreSQL', 'Əli', 'konfiqurasya']) assert.equal(head(raw, tokenize(raw), 0), undefined);
  const invalid = structuredClone(base) as BoundedBundle; invalid.artifact.threshold = NaN;
  assert.throws(() => createBoundedHead(invalid), /Unsupported/);
});

test('domain head preserves word edges instead of guessing a different inflection', () => {
  for (const [raw, candidate] of [['məktəbdən', 'məktəbdə'], ['kitablr', 'kitab'], ['dən', 'edən'], ['bəndx', 'bənd']]) assert.equal(preservesWordEdges(raw, candidate), false);
  for (const [raw, candidate] of [['komandasna', 'komandasına'], ['müqvilənin', 'müqavilənin'], ['proqrm', 'proqram']]) assert.equal(preservesWordEdges(raw, candidate), true);
});

test('domain vowel restoration cannot change active voice or invent suffixes', () => {
  for (const [raw, target] of [['unvanladigi', 'ünvanlandığı'], ['sənədin', 'sənədinin'], ['kitab', 'katib'], ['xətt', 'xətti']]) assert.equal(isSingleMissingVowel(raw, target), false);
  for (const [raw, target] of [['avtorizasya', 'avtorizasiya'], ['müddti', 'müddəti'], ['bildriş', 'bildiriş']]) assert.equal(isSingleMissingVowel(raw, target), true);
});
