import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

type CorpusCase = {
  id: string;
  mode: 'text' | 'email';
  category: string;
  input: string;
  expected: string;
  notes?: string;
};

type Corpus = {
  version: number;
  count: number;
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
    assert.ok(item.input.trim().length > 0, `${item.id}: input is empty`);
    assert.ok(item.expected.trim().length > 0, `${item.id}: expected is empty`);
  }
});

test('hybrid regression corpus includes core editor risk areas', () => {
  const categories = new Set(corpus.cases.map((item) => item.category));
  for (const required of [
    'business',
    'technical',
    'morphology',
    'spelling',
    'punctuation',
    'ambiguity',
    'protection',
  ]) {
    assert.ok(categories.has(required), `missing category: ${required}`);
  }

  assert.ok(corpus.cases.some((item) => item.mode === 'email'), 'email cases are required');
  assert.ok(corpus.cases.some((item) => item.mode === 'text'), 'text cases are required');
});
