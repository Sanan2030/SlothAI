import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { correctText } from '../lib/editor/correct';
import { analyzeClause, detectExclamation, detectQuestion, punctuateCommas } from '../lib/editor/punctuation';
import { segmentParagraphs } from '../lib/editor/paragraph-segmentation';

const { cases } = JSON.parse(readFileSync(new URL('./fixtures/punctuation-holdout.json', import.meta.url), 'utf8')) as {
  cases: { id: string; category: string; input: string; expected: string }[];
};
test('punctuation holdout has 250 independent cases across five categories', () => {
  assert.ok(cases.length >= 250);
  assert.equal(new Set(cases.map(item => item.id)).size, cases.length);
  for (const category of ['question', 'exclamation', 'comma', 'runon', 'paragraph'])
    assert.ok(cases.filter(item => item.category === category).length >= 35);
});
for (const item of cases) test(`punctuation ${item.id}`, () => {
  assert.equal(correctText(item.input).text, item.expected);
  assert.equal(correctText(item.expected).text, item.expected);
});
test('clause analysis and punctuation modules expose grammatical evidence', () => {
  assert.equal(detectQuestion('Niyə server işləmir'), true);
  assert.equal(detectQuestion('Bilmirəm niyə server işləmir'), false);
  assert.equal(detectExclamation('Vay, nə gözəl mənzərədir'), true);
  assert.equal(punctuateCommas('Getmədim çünki vaxtım yox idi'), 'Getmədim, çünki vaxtım yox idi');
  assert.equal(analyzeClause('Mən gələndə müdir danışırdı').mood, 'declarative');
  assert.equal(segmentParagraphs('Mətn hazırdır.'), 'Mətn hazırdır.');
});
