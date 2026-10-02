import { readFileSync } from 'node:fs';
import pairs from '../data/neural/expansion-pairs.json';
import { correctText } from '../lib/editor/correct';
import { neuralSpelling } from '../lib/editor/neural/runtime';
import { atomicWriteSync } from './atomic-files.mjs';
const rows = pairs.rows.filter(row => row.split === 'test').map(row => ({ ...row,
  actual: correctText(row.input).text, neuralActual: neuralSpelling(row.input) }));
const report = { source: pairs.source, total: rows.length,
  exact: rows.filter(row => row.actual === row.target).length,
  neuralExact: rows.filter(row => row.neuralActual === row.target).length, rows };
if (process.argv.includes('--baseline')) {
  atomicWriteSync('data/neural/expansion-baseline.json', JSON.stringify(report, null, 2) + '\n');
} else {
  const baseline = JSON.parse(readFileSync('data/neural/expansion-baseline.json', 'utf8')) as typeof report;
  const regressions = rows.filter(row => baseline.rows.some(old => old.id === row.id && old.actual === old.target) && row.actual !== row.target);
  const neuralRegressions = rows.filter(row => baseline.rows.some(old => old.id === row.id && old.neuralActual === old.target) && row.neuralActual !== row.target);
  const gains = rows.filter(row => baseline.rows.some(old => old.id === row.id && old.actual !== old.target) && row.actual === row.target);
  const neuralGains = rows.filter(row => baseline.rows.some(old => old.id === row.id && old.neuralActual !== old.target) && row.neuralActual === row.target);
  const controlFailures = rows.filter(row => row.input === row.target && row.actual !== row.target);
  atomicWriteSync('data/neural/expansion-evaluation.json', JSON.stringify({ ...report, baselineExact: baseline.exact,
    baselineNeuralExact: baseline.neuralExact, gains: gains.map(row => row.id), neuralGains: neuralGains.map(row => row.id),
    regressions: regressions.map(row => row.id), neuralRegressions: neuralRegressions.map(row => row.id),
    controlFailures: controlFailures.map(row => row.id),
    caveat: 'Frozen authored holdout, shared lexical error families with training, not real-user or semantic comprehension accuracy.' }, null, 2) + '\n');
  if (process.argv.includes('--enforce') && (regressions.length || neuralRegressions.length || controlFailures.length)) {
    throw new Error('Expansion changed a previously correct output or a valid control.');
  }
}
console.log({ total: report.total, exact: report.exact, neuralExact: report.neuralExact });
