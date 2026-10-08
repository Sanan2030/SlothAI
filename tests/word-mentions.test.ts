import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import development from '../docs/stage2/development.json';
import { correctText } from '../lib/editor/correct';
import { protectWordMentions } from '../lib/editor/word-mentions';
import { applyPersonalLexicon, extractPersonalCandidates } from '../lib/editor/personal-lexicon';

test('assistant-authored development references remain frozen and distinct from training', () => {
  assert.equal(development.trainingAllowed, false);
  assert.equal(development.cases.length, 400);
  assert.equal(new Set(development.cases.map(row => row.input)).size, 400);
  const expected = readFileSync('docs/stage2/development.sha256', 'utf8').split(/\s/u)[0];
  assert.equal(createHash('sha256').update(readFileSync('docs/stage2/development.json')).digest('hex'), expected);
});

for (const row of development.cases) test(`assistant-authored correct sentence stays intact: ${row.id}`, () => {
  const output = correctText(row.input).text;
  assert.equal(output, row.expected);
  assert.equal(correctText(output).text, output);
});

test('only exact recognized words in explicit linguistic mentions are literal', () => {
  const recognized = new Set(['gül', 'el', 'uç']);
  const protect = (word: string) => `[${word}]`;
  assert.equal(protectWordMentions('Bu gül sözünün mənasıdır; uç termini işlənib.', protect, word => recognized.has(word)),
    'Bu [gül] sözünün mənasıdır; [uç] termini işlənib.');
  for (const input of ['Bu gll sözü yazılıb.', 'Bu gül sözüdür.', 'Bu gül yaxşıdır.', 'Bu gül\nsözü yazılıb.']) {
    assert.equal(protectWordMentions(input, protect, word => recognized.has(word)), input);
  }
});

test('mentions preserve valid homographs while surrounding ASCII prose still corrects', () => {
  assert.equal(correctText('lugətdə el sözü ayrica verilib').text, 'Lüğətdə el sözü ayrıca verilib.');
  assert.equal(correctText('Lüğətdə gül sözü ayrıca verilib.').text, 'Lüğətdə gül sözü ayrıca verilib.');
  assert.equal(correctText('Lüğətdə kitab sözü ayrıca verilib.').text, 'Lüğətdə kitab sözü ayrıca verilib.');
});

test('personal corrections cannot change contact addresses, comments or unfinished code', () => {
  const rules = extractPersonalCandidates('ali example', 'veli example');
  for (const input of ['ali@example.az', 'ali+tag@example.az', 'https://example.az/ali',
    '<!-- ali example -->', '```ali example', '`ali example`']) {
    assert.equal(applyPersonalLexicon(input, rules), input);
  }
  assert.equal(applyPersonalLexicon('ali example', rules), 'veli example');
});
