import { readFileSync, writeFileSync } from 'node:fs';
import { correctText, formatEmail } from '../lib/editor/correct';

type Holdout = { id: string; category: string; mode: 'text' | 'email'; input: string; expected: string };
const cases = (JSON.parse(readFileSync(new URL('../tests/fixtures/holdout-corpus.json', import.meta.url), 'utf8')) as { cases: Holdout[] }).cases;
const categories: Record<string, { passed: number; failed: number }> = {};
const failures: { id: string; expected: string; actual: string }[] = [];
for (const entry of cases) {
  const edit = entry.mode === 'email' ? formatEmail : correctText;
  const output = edit(entry.input).text;
  const stable = edit(entry.expected).text === entry.expected;
  const result = categories[entry.category] ?? { passed: 0, failed: 0 };
  if (output === entry.expected && stable) result.passed++;
  else {
    result.failed++;
    failures.push({ id: entry.id, expected: entry.expected, actual: output });
  }
  categories[entry.category] = result;
}
const report = { total: cases.length, passed: cases.length - failures.length, failed: failures.length,
  categories, failures };
writeFileSync(new URL('../docs/holdout-results.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (cases.length < 250 || failures.length ||
  ['informal', 'business', 'email', 'technical', 'narrative', 'noisy'].some(name =>
    (categories[name]?.passed ?? 0) < 40)) process.exitCode = 1;
