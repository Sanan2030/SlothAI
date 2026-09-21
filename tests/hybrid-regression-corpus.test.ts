import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { ERROR_CATEGORIES, isErrorCategory, type ErrorCategory } from '../lib/editor/error-categories';

type CorpusCase = {
  id: string;
  mode: 'text' | 'email';
  category: string;
  errorCategory: ErrorCategory;
  input: string;
  expected: string;
  notes?: string;
};

type Corpus = {
  version: number;
  count: number;
  errorCategories: ErrorCategory[];
  errorCategoryCounts: Record<ErrorCategory, number>;
  cases: CorpusCase[];
};

const corpus = JSON.parse(
  readFileSync(new URL('./fixtures/hybrid-regression-corpus.json', import.meta.url), 'utf8'),
) as Corpus;

test('hybrid regression corpus contains at least 200 curated cases', () => {
  assert.ok(corpus.count >= 200, `expected >= 200 cases, got ${corpus.count}`);
  assert.equal(corpus.count, corpus.cases.length);
});

test('hybrid regression corpus IDs are unique', () => {
  const ids = corpus.cases.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('hybrid regression corpus cases have valid required fields', () => {
  for (const item of corpus.cases) {
    assert.match(item.id, /^[a-z]+(?:-[a-z]+)*-\d{3}$/u);
    assert.ok(item.mode === 'text' || item.mode === 'email');
    assert.ok(item.category.trim().length > 0, `${item.id}: category is empty`);
    assert.ok(isErrorCategory(item.errorCategory), `${item.id}: invalid errorCategory ${item.errorCategory}`);
    assert.ok(item.input.trim().length > 0, `${item.id}: input is empty`);
    assert.ok(item.expected.trim().length > 0, `${item.id}: expected is empty`);
  }
});

test('hybrid regression corpus declares exactly the supported error categories', () => {
  assert.deepEqual([...corpus.errorCategories].sort(), [...ERROR_CATEGORIES].sort());

  const observed = new Set(corpus.cases.map((item) => item.errorCategory));
  for (const required of ERROR_CATEGORIES) {
    assert.ok(observed.has(required), `missing error category: ${required}`);
  }
});

test('hybrid regression corpus errorCategoryCounts are accurate', () => {
  const counts = Object.fromEntries(ERROR_CATEGORIES.map((category) => [category, 0])) as Record<ErrorCategory, number>;
  for (const item of corpus.cases) counts[item.errorCategory]++;

  assert.deepEqual(corpus.errorCategoryCounts, counts);
  assert.equal(
    Object.values(corpus.errorCategoryCounts).reduce((sum, value) => sum + value, 0),
    corpus.count,
  );
});

test('hybrid regression corpus includes text and email modes', () => {
  assert.ok(corpus.cases.some((item) => item.mode === 'email'), 'email cases are required');
  assert.ok(corpus.cases.some((item) => item.mode === 'text'), 'text cases are required');
});
