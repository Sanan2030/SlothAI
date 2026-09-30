/** Full-text comparison. Frozen editorial targets are never derived here from engine output. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import rsd from '../tests/fixtures/rsd-it-holdout.json';
import mail from '../tests/fixtures/email-holdout.json';
import baseline from '../tests/fixtures/independent-gold-baseline.json';
import gold from '../tests/fixtures/independent-gold-v2.json';
import { correctText, formatEmail } from '../lib/editor/correct';
const inputs = new Map([...rsd, ...mail].map(row => [row.id, row.input]));
if (gold.cases.length !== 800 || new Set(gold.cases.map(row => row.id)).size !== inputs.size) {
  throw new Error('Expected complete, unique editorial targets for all 800 inputs.');
}
const rows = gold.cases.map(row => {
  const input = inputs.get(row.id);
  if (!input || createHash('sha256').update(input).digest('hex') !== row.inputSha256) {
    throw new Error(`Frozen input changed: ${row.id}`);
  }
  const output = row.id.startsWith('mail-') ? formatEmail(input).text : correctText(input).text;
  return { id: row.id, input, expected: row.expected, output, exact: output === row.expected };
});
const protectedIds = new Set(baseline.protectedIds);
const regressions = rows.filter(row => protectedIds.has(row.id) && !row.exact).map(row => row.id);
const domains = Object.fromEntries(['rsd-it-', 'mail-'].map(prefix => {
  const selected = rows.filter(row => row.id.startsWith(prefix));
  return [prefix, { total: selected.length, exact: selected.filter(row => row.exact).length }];
}));
const report = { review: gold.review, total: rows.length, exact: rows.filter(row => row.exact).length,
  remaining: rows.filter(row => !row.exact).length, baselineExact: baseline.exact, regressions, domains, rows };
writeFileSync('docs/independent-gold-v2-results.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ total: report.total, exact: report.exact, remaining: report.remaining, domains }, null, 2));
if (process.argv.includes('--require-exact') && report.remaining) process.exitCode = 1;

if (process.argv.includes('--enforce-baseline')) {
  const digest = createHash('sha256').update(readFileSync('tests/fixtures/independent-gold-v2.json')).digest('hex');
  if (digest !== baseline.goldSha256) throw new Error('Editorial targets changed: baseline requires an explicit review.');
  if (regressions.length) { console.error('Previously correct cases regressed:', regressions); process.exitCode = 1; }
}
