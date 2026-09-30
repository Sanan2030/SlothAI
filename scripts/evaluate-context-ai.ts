import { readFileSync, writeFileSync } from 'node:fs';
import { fold, tokenize } from '../lib/editor/local-ai/core';
import { createLocalPredictor } from '../lib/editor/local-ai/predict';
import corpus from '../data/local-ai/context-corpus.json';
import { correctText, formatEmail } from '../lib/editor/correct';

const split = process.argv.includes('--validation') ? 'validation' : 'test';
const rows = corpus.rows.filter(row => row.split === split).map(row => {
  const targetTokens = tokenize(row.text);
  const at = targetTokens.findIndex(token => token.word.toLocaleLowerCase('az-AZ') === row.word);
  if (at < 0) throw new Error(`Missing target in ${row.id}`);
  const input = fold(row.text).replace(/[.,!?]/gu, '');
  const tokens = tokenize(input);
  const actual = createLocalPredictor(input)(tokens[at].word, tokens[at].start);
  const textOutput = correctText(input).text;
  const mailOutput = formatEmail(input, { emailGreeting: 'Salam, hər vaxtınız xeyir.', omitSubject: true }).text;
  return { ...row, input, actual: actual ?? null, accepted: actual !== undefined, correct: actual === row.word,
    textOutput, mailOutput, textExact: textOutput === row.text, mailBodyExact: mailOutput.includes(`\n\n${row.text}\n\n`) };
});
const accepted = rows.filter(row => row.accepted).length;
const correct = rows.filter(row => row.correct).length;
const summary = { split, total: rows.length, accepted, correct, wrong: accepted - correct,
  abstained: rows.length - accepted, precision: accepted ? correct / accepted : null,
  textExact: rows.filter(row => row.textExact).length, mailBodyExact: rows.filter(row => row.mailBodyExact).length,
  scope: corpus.source };
const reportPath = `data/local-ai/context-${split}-report.json`;
const baselinePath = process.argv.find(arg => arg.startsWith('--baseline='))?.slice('--baseline='.length);
let regressions = 0;
if (baselinePath) {
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as { rows: { id: string; correct: boolean }[] };
  const protectedIds = new Set(baseline.rows.filter(row => row.correct).map(row => row.id));
  regressions = rows.filter(row => protectedIds.has(row.id) && !row.correct).length;
}
writeFileSync(reportPath, JSON.stringify({ ...summary, regressions, rows }, null, 2) + '\n');
console.log(JSON.stringify({ ...summary, regressions }, null, 2));
if (process.argv.includes('--enforce') && (summary.wrong > 0 || regressions > 0 || accepted < Math.ceil(rows.length / 2))) process.exitCode = 1;
