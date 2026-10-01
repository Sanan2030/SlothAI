import { readFileSync } from 'node:fs';
import { correctText, formatEmail } from '../lib/editor/correct';
import additions from '../data/local-ai/paired-additions.json';
import challenge from '../data/local-ai/challenge-v2.json';
import { atomicWriteSync } from './atomic-files.mjs';
const partition = process.argv.includes('--validation') ? 'validation' : 'test';
const rows = [
  ...additions.rows.filter(row => row.split === partition).map(row => ({ id: row.id, input: row.input, expected: row.target,
    actual: correctText(row.input).text, corpus: 'authored-synthetic', mode: 'text' })),
  ...(partition === 'test' ? challenge.rows : []).map(row => ({ id: row.id, input: row.input, expected: row.target,
    actual: row.mode === 'mail' ? formatEmail(row.input, { emailGreeting: 'Salam, hər vaxtınız xeyir.', omitSubject: true }).text
      : correctText(row.input, row.preserveFormatting).text, corpus: 'challenge', mode: row.mode })),
];
const distance = (a: string, b: string) => {
  const x = a.split(/\s+/u), y = b.split(/\s+/u); let row = Array.from({ length: y.length + 1 }, (_, i) => i);
  x.forEach((value, i) => { const next = [i + 1]; y.forEach((target, j) => next.push(Math.min(next[j] + 1, row[j + 1] + 1, row[j] + Number(value !== target)))); row = next; });
  return row.at(-1)!;
};
const baselinePath = process.argv.find(value => value.startsWith('--baseline='))?.slice('--baseline='.length);
const baseline = baselinePath ? JSON.parse(readFileSync(baselinePath, 'utf8')) as { rows: typeof rows } : undefined;
const previous = new Map(baseline?.rows.map(row => [row.id, row]) ?? []);
if (baseline && (previous.size !== rows.length || rows.some(row => {
  const old = previous.get(row.id); return !old || old.input !== row.input || old.expected !== row.expected;
}))) throw new Error('Baseline inputs, targets and IDs must match the frozen evaluation corpus.');
const compared = rows.map(row => ({ ...row, exact: row.actual === row.expected, distance: distance(row.actual, row.expected),
  ...(previous.has(row.id) ? { previous: previous.get(row.id)!.actual, previousDistance: distance(previous.get(row.id)!.actual, row.expected) } : {}) }));
const corpora = ['authored-synthetic', 'challenge'].map(corpus => ({ corpus, total: compared.filter(row => row.corpus === corpus).length,
  exact: compared.filter(row => row.corpus === corpus && row.exact).length,
  previousExact: previous.size ? compared.filter(row => row.corpus === corpus && row.previous === row.expected).length : null }));
const regressions = compared.filter(row => row.previousDistance !== undefined && row.distance > row.previousDistance);
const summary = { partition, total: rows.length, exact: compared.filter(row => row.exact).length, regressions: regressions.length, corpora };
const out = process.argv.find(value => value.startsWith('--out='))?.slice('--out='.length) ?? `data/local-ai/paired-${partition}-report.json`;
atomicWriteSync(out, JSON.stringify({ ...summary, rows: compared }, null, 2) + '\n');
console.log(JSON.stringify({ ...summary, regressions: regressions.map(row => row.id) }, null, 2));
if (process.argv.includes('--enforce') && (regressions.length || !baseline || compared.filter(row => row.exact).length <= baseline.rows.filter(row => row.actual === row.expected).length)) process.exitCode = 1;
