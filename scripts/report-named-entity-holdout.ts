import { readFileSync, writeFileSync } from 'node:fs';
import { correctText } from '../lib/editor/correct';
import { entityInventory } from '../lib/editor/entities/resolver';

type Entry = { id: string; category: string; input: string; expected: string };
const { cases } = JSON.parse(readFileSync(new URL('../tests/fixtures/named-entity-holdout.json', import.meta.url), 'utf8')) as { cases: Entry[] };
const categories: Record<string, { total: number; passed: number }> = {};
const failures: { id: string; input: string; expected: string; actual: string; stable: boolean }[] = [];
for (const item of cases) {
  const actual = correctText(item.input).text;
  const stable = correctText(item.expected).text === item.expected;
  const group = categories[item.category] ??= { total: 0, passed: 0 };
  group.total++;
  if (actual === item.expected && stable) group.passed++;
  else failures.push({ id: item.id, input: item.input, expected: item.expected, actual, stable });
}
const report = { total: cases.length, passed: cases.length - failures.length, failed: failures.length, inventory: entityInventory, categories, failures };
writeFileSync(new URL('../docs/named-entity-holdout-results.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (cases.length < 400 || failures.length) process.exitCode = 1;
