import { readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { correctText, formatEmail } from '../lib/editor/correct';
import { fold } from '../lib/editor/local-ai/core';
import corpus from '../data/local-ai/fresh-holdout.json';
import expansion from '../data/local-ai/expansion.json';

const training = [...readFileSync('data/local-ai/seeds.txt', 'utf8').trim().split('\n'),
  ...readFileSync('data/local-ai/supplemental-training.txt', 'utf8').trim().split('\n'),
  ...[...expansion.forms, ...expansion.boundaries].flatMap(item => item.texts)];
const normalize = (text: string) => fold(text).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const known = new Set(training.map(normalize));
for (const pair of corpus.pairs) if (known.has(normalize(pair.input))) throw new Error(`Training overlap: ${pair.input}`);
const started = performance.now();
const rows = corpus.pairs.map(pair => {
  const baseline = correctText(pair.input, false, { useLocalModel: false }).text;
  const output = correctText(pair.input).text;
  const mail = formatEmail(pair.input, { emailGreeting: 'Salam, hər vaxtınız xeyir.', omitSubject: true }).text;
  return { ...pair, baseline, output, mail, exact: output === pair.target,
    mailContainsExpectedBody: mail.includes(pair.target), greetingPreserved: mail.startsWith('Salam, hər vaxtınız xeyir.') };
});
const report = { scope: corpus.source, total: rows.length,
  baselineExact: rows.filter(row => row.baseline === row.target).length,
  modelExact: rows.filter(row => row.exact).length,
  mailExactBody: rows.filter(row => row.mailContainsExpectedBody).length,
  greetingPreserved: rows.filter(row => row.greetingPreserved).length,
  elapsedMs: Math.round(performance.now() - started), rows };
writeFileSync('data/local-ai/fresh-report.json', JSON.stringify(report, null, 2) + '\n');
const { rows: details, ...summary } = report;
console.log(JSON.stringify({ ...summary, failures: details.filter(row => !row.exact).map(row => ({ input: row.input, expected: row.target, actual: row.output })) }, null, 2));
