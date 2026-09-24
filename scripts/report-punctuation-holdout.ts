import { readFileSync, writeFileSync } from 'node:fs';
import { correctText } from '../lib/editor/correct';

type Entry = { id: string; category: string; mode: 'text'; input: string; expected: string };
const { cases } = JSON.parse(readFileSync(new URL('../tests/fixtures/punctuation-holdout.json', import.meta.url), 'utf8')) as { cases: Entry[] };
const categories: Record<string, { passed: number; total: number }> = {};
const failures: { id: string; input: string; expected: string; actual: string; stable: boolean }[] = [];
for (const entry of cases) {
  const actual = correctText(entry.input).text;
  const stable = correctText(entry.expected).text === entry.expected;
  const group = categories[entry.category] ??= { passed: 0, total: 0 };
  group.total++;
  if (actual === entry.expected && stable) group.passed++;
  else failures.push({ id: entry.id, input: entry.input, expected: entry.expected, actual, stable });
}
const report = { total: cases.length, passed: cases.length - failures.length, failed: failures.length, categories, failures };
writeFileSync(new URL('../docs/punctuation-holdout-results.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (cases.length < 250 || failures.length ||
  ['question', 'exclamation', 'comma', 'runon', 'paragraph'].some(category => !categories[category])) process.exitCode = 1;
