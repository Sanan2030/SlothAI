import { readFileSync, writeFileSync } from 'node:fs';
import { correctText, formatEmail } from '../lib/editor/correct';

const corpus = JSON.parse(readFileSync('tests/fixtures/hybrid-regression-corpus.json', 'utf8'));
const categories: Record<string, { passed: number; failed: number }> = {};
const failures = [];
for (const item of corpus.cases) {
  const correct = item.mode === 'email' ? formatEmail : correctText;
  const actual = correct(item.input).text;
  const repeated = correct(actual).text;
  const pass = actual === item.expected && repeated === actual;
  const counts = categories[item.errorCategory] ??= { passed: 0, failed: 0 };
  counts[pass ? 'passed' : 'failed']++;
  if (!pass) failures.push({ ...item, actual, repeated, idempotent: actual === repeated });
}
const result = { total: corpus.cases.length, passed: corpus.cases.length - failures.length,
  failed: failures.length, categories, failures };
writeFileSync('docs/stabilization-regressions.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ ...result, failures: undefined }, null, 2));
process.exitCode = failures.length ? 1 : 0;
