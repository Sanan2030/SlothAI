import { readFileSync } from 'node:fs';
import pairs from '../data/neural/diverse-pairs.json';
import { correctText } from '../lib/editor/correct';
import { neuralSpelling } from '../lib/editor/neural/runtime';
import { atomicWriteSync } from './atomic-files.mjs';
const rows = pairs.rows.filter(row => row.split === 'test').map(row => ({ ...row,
  actual: correctText(row.input).text, neuralActual: neuralSpelling(row.input) }));
const report = { source: pairs.source, total: rows.length, exact: rows.filter(row => row.actual === row.target).length,
  neuralExact: rows.filter(row => row.neuralActual === row.target).length, rows };
if (process.argv.includes('--baseline')) atomicWriteSync('data/neural/diverse-baseline.json', JSON.stringify(report, null, 2) + '\n');
else {
  const baseline = JSON.parse(readFileSync('data/neural/diverse-baseline.json', 'utf8')) as typeof report;
  const regressions = rows.filter(row => baseline.rows.some(old => old.id === row.id && old.actual === old.target) && row.actual !== row.target);
  const gained = rows.filter(row => baseline.rows.some(old => old.id === row.id && old.actual !== old.target) && row.actual === row.target);
  atomicWriteSync('data/neural/diverse-evaluation.json', JSON.stringify({ ...report, baselineExact: baseline.exact, gained: gained.map(row => row.id), regressions: regressions.map(row => row.id) }, null, 2) + '\n');
  if (process.argv.includes('--enforce') && (regressions.length || report.exact !== report.total)) throw new Error('Diverse context outputs must remain exact, including the six repaired cases.');
}
console.log({ total: report.total, exact: report.exact, neuralExact: report.neuralExact });
