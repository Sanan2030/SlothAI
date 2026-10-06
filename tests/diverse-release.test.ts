import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { correctText } from '../lib/editor/correct';

const path = new URL('./fixtures/diverse-release-300.json', import.meta.url);
const bytes = readFileSync(path);
const corpus = JSON.parse(bytes.toString()) as { certification: string; cases: {
  id: string; domain: string; input: string; expected: string;
  errorPairs: { input: string; expected: string }[]; provenance: string;
}[] };
const before = JSON.parse(readFileSync(new URL('../docs/performance-audit/new-before/snapshot.json', import.meta.url), 'utf8')) as {
  id: string; exact: boolean;
}[];
const previouslyExact = new Set(before.filter(row => row.exact).map(row => row.id));

test('new holdout hash, diversity and authorship remain frozen', () => {
  assert.equal(createHash('sha256').update(bytes).digest('hex'), readFileSync(new URL('./fixtures/diverse-release-300.json.sha256', import.meta.url), 'utf8').trim());
  assert.equal(corpus.certification, 'assistant-authored, not human-reviewed');
  assert.equal(corpus.cases.length, 300);
  assert.equal(new Set(corpus.cases.map(row => row.input.normalize('NFC'))).size, 300);
  assert.equal(new Set(corpus.cases.map(row => row.id)).size, 300);
  assert.ok(new Set(corpus.cases.map(row => row.domain)).size >= 20);
  assert.equal(corpus.cases.filter(row => row.input === row.expected).length, 60);
  const counts = new Map<string, number>();
  for (const row of corpus.cases) {
    assert.equal(row.provenance, 'assistant-authored, not human-reviewed');
    for (const pair of row.errorPairs) {
      const key = JSON.stringify([pair.input.toLocaleLowerCase('az-AZ'), pair.expected.toLocaleLowerCase('az-AZ')]);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  assert.ok(counts.size >= 200);
  assert.ok([...counts.values()].every(count => count <= 2));
});

test('held-out clean controls and previously exact targets never regress; all second passes are stable', () => {
  assert.equal(previouslyExact.size, 281);
  for (const row of corpus.cases) {
    const result = correctText(row.input).text;
    if (row.input === row.expected || previouslyExact.has(row.id)) assert.equal(result, row.expected, row.id);
    assert.equal(correctText(result).text, result, row.id + ' second pass');
  }
});
