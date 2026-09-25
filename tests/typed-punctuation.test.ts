import assert from 'node:assert/strict';
import test from 'node:test';
import { correctText } from '../lib/editor/correct';
import { analyzeClause, detectExclamation, detectQuestion } from '../lib/editor/punctuation';

const examples = [
  ['səncə bu yaxşıdır', 'Səncə, bu yaxşıdır?'],
  ['görəsən o gələcək', 'Görəsən, o gələcək?'],
  ['necə də gözəldir', 'Necə də gözəldir!'],
  ['Əli gəldi Rəşad getdi', 'Əli gəldi. Rəşad getdi.'],
  ['əgər vaxtın olsa gəl', 'Əgər vaxtın olsa, gəl.'],
  ['bilmirəm o niyə gəlmədi', 'Bilmirəm o niyə gəlmədi.'],
  ['bu doğrudurmu', 'Bu doğrudurmu?'],
  ['elə deyilmi', 'Elə deyilmi?'],
] as const;
for (const [input, expected] of examples) test(`sentence structure: ${input}`, () => {
  assert.equal(correctText(input).text, expected);
  assert.equal(correctText(expected).text, expected);
});
test('the mood detector separates embedded and direct questions', () => {
  assert.equal(detectQuestion('bilmirəm o niyə gəlmədi'), false);
  assert.equal(detectQuestion('səncə bu yaxşıdır'), true);
  assert.equal(detectExclamation('necə də gözəldir'), true);
  assert.ok(analyzeClause('Əli gəldi').finitePredicates.includes('gəldi'));
});
