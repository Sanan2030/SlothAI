/** Full-text comparison. Frozen editorial targets are never derived here from engine output. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import rsd from '../tests/fixtures/rsd-it-holdout.json';
import mail from '../tests/fixtures/email-holdout.json';
import additional from '../tests/fixtures/additional-gold-200.json';
import baseline from '../tests/fixtures/independent-gold-baseline.json';
import gold from '../tests/fixtures/independent-gold-v2.json';
import { correctText, formatEmail } from '../lib/editor/correct';
const inputs = new Map([...rsd, ...mail, ...additional.cases].map(row => [row.id, row.input]));
if (gold.cases.length + additional.cases.length !== 1000 || new Set([...gold.cases, ...additional.cases].map(row => row.id)).size !== inputs.size) {
  throw new Error('Expected complete, unique editorial targets for all 1000 inputs.');
}
const rows = [...gold.cases, ...additional.cases].map(row => {
  const input = inputs.get(row.id);
  if (!input || createHash('sha256').update(input).digest('hex') !== row.inputSha256) {
    throw new Error(`Frozen input changed: ${row.id}`);
  }
  const output = row.id.startsWith('mail-') || row.id.startsWith('fresh-mail-') ? formatEmail(input).text : correctText(input).text;
  return { id: row.id, input, expected: row.expected, output, exact: output === row.expected };
});
const protectedIds = new Set(baseline.protectedIds);
const regressions = rows.filter(row => protectedIds.has(row.id) && !row.exact).map(row => row.id);
const domains = Object.fromEntries(['rsd-it-', 'mail-', 'fresh-text-', 'fresh-mail-'].map(prefix => {
  const selected = rows.filter(row => row.id.startsWith(prefix));
  return [prefix, { total: selected.length, exact: selected.filter(row => row.exact).length }];
}));
const report = { review: gold.review, additionalReview: additional.review, total: rows.length, exact: rows.filter(row => row.exact).length,
  remaining: rows.filter(row => !row.exact).length, baselineExact: baseline.exact, regressions, domains, rows };
writeFileSync('docs/independent-gold-v2-results.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ total: report.total, exact: report.exact, remaining: report.remaining, domains }, null, 2));
if (process.argv.includes('--require-exact') && report.remaining) process.exitCode = 1;

if (process.argv.includes('--enforce-baseline')) {
  const digest = createHash('sha256').update(readFileSync('tests/fixtures/independent-gold-v2.json')).digest('hex');
  const additionalDigest = createHash('sha256').update(readFileSync('tests/fixtures/additional-gold-200.json')).digest('hex');
  if (additionalDigest !== baseline.additionalGoldSha256) throw new Error('Additional editorial targets changed without review.');
  if (digest !== baseline.goldSha256) throw new Error('Editorial targets changed: baseline requires an explicit review.');
  if (regressions.length) { console.error('Previously correct cases regressed:', regressions); process.exitCode = 1; }
}
