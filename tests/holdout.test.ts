import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { correctText, formatEmail } from '../lib/editor/correct';

type Holdout = { id: string; mode: 'text' | 'email'; category: string; input: string; expected: string };
const { cases } = JSON.parse(readFileSync(new URL('./fixtures/holdout-corpus.json', import.meta.url), 'utf8')) as { cases: Holdout[] };
test('frozen holdout has 250 distinct cases across six language domains', () => {
  assert.ok(cases.length >= 250);
  assert.equal(new Set(cases.map(item => item.id)).size, cases.length);
  for (const domain of ['informal', 'business', 'email', 'technical', 'narrative', 'noisy']) {
    assert.ok(cases.filter(item => item.category === domain).length >= 40, domain);
  }
});
for (const item of cases) {
  test(`unseen ${item.id} [${item.category}]`, () => {
    const edit = item.mode === 'email' ? formatEmail : correctText;
    assert.equal(edit(item.input).text, item.expected);
    assert.equal(edit(item.expected).text, item.expected);
  });
}
