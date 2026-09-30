import { readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { correctText } from '../lib/editor/correct';
interface Pair { id: string; groupId: string; split: string; input: string; target: string; variant: number }
const corpus = JSON.parse(readFileSync('data/local-ai/pairs.json', 'utf8')) as { pairs: Pair[] };
const test = corpus.pairs.filter(pair => pair.split === 'test');
function distance(a: string, b: string): number {
  const left = a.split(/\s+/u), right = b.split(/\s+/u);
  let row = Array.from({ length: right.length + 1 }, (_, index) => index);
  left.forEach((word, index) => {
    const next = [index + 1];
    right.forEach((target, j) => { next.push(Math.min(next[j] + 1, row[j + 1] + 1, row[j] + Number(word !== target))); });
    row = next;
  });
  return row.at(-1)!;
}
const started = performance.now();
const rows = test.map(pair => {
  const baseline = correctText(pair.input, false, { useLocalModel: false }).text;
  const output = correctText(pair.input).text;
  return { ...pair, baseline, output, baselineDistance: distance(baseline, pair.target), distance: distance(output, pair.target) };
});
const report = { scope: '100 synthetic held-out pairs from 20 separate authored gold groups',
  exact: { baseline: rows.filter(row => row.baseline === row.target).length, model: rows.filter(row => row.output === row.target).length, total: rows.length },
  changed: rows.filter(row => row.baseline !== row.output).length,
  improved: rows.filter(row => row.distance < row.baselineDistance).length,
  regressed: rows.filter(row => row.distance > row.baselineDistance).length,
  wordEditDistance: { baseline: rows.reduce((sum, row) => sum + row.baselineDistance, 0), model: rows.reduce((sum, row) => sum + row.distance, 0) },
  elapsedMs: Math.round(performance.now() - started), rows };
writeFileSync('data/local-ai/evaluation-report.json', JSON.stringify(report, null, 2) + '\n');
const { rows: details, ...summary } = report;
console.log(JSON.stringify({ ...summary, failures: details.filter(row => row.output !== row.target).length }, null, 2));
if (report.regressed) process.exitCode = 1;
