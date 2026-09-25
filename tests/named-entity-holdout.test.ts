import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { correctText } from '../lib/editor/correct';
import { entityInventory, resolveEntityWord } from '../lib/editor/entities/resolver';
const { cases } = JSON.parse(readFileSync(new URL('./fixtures/named-entity-holdout.json', import.meta.url), 'utf8')) as { cases: { id: string; input: string; expected: string }[] };
test('named entity holdout has over 400 distinct frozen examples', () => {
  assert.ok(cases.length >= 400);
  assert.equal(new Set(cases.map((item) => item.id)).size, cases.length);
  assert.ok(entityInventory.geography > 70 && entityInventory.givenNames > 100);
});
for (const item of cases) test(`entity ${item.id}`, () => {
  assert.equal(correctText(item.input).text, item.expected);
  assert.equal(correctText(item.expected).text, item.expected);
});
test('entity resolver has no external dependency', () => {
  assert.equal(resolveEntityWord('naxcivana'), 'Naxçıvana');
  assert.equal(resolveEntityWord('sumqayitdan'), 'Sumqayıtdan');
});
