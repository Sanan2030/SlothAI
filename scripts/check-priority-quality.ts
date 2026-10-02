import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { correctText } from '../lib/editor/correct';
import { qualityReport } from './nlp/metrics';
import { atomicWriteSync } from './atomic-files.mjs';
import regression from '../data/nlp/priority-regressions.json';
const option = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const baselinePath = option('baseline'), input = option('input');
async function main() {
const baseline = baselinePath ? await import(pathToFileURL(resolve(baselinePath)).href) as { correctText: typeof correctText } : undefined;
const rows = input ? readFileSync(input, 'utf8').split(/\r?\n/u).filter(Boolean).map(line => JSON.parse(line) as { id: string; input: string; target: string; category: string }) : regression.cases;
const scored = rows.map(row => ({ ...row, actual: correctText(row.input, !input).text }));
const old = baseline ? rows.map(row => ({ ...row, actual: baseline.correctText(row.input, !input).text })) : undefined;
const report = { source: input ? 'Provided source/synthetic targets' : regression.provenance, annotationStatus: input ? 'provided-unverified-reference' : 'assistant-reference',
  current: qualityReport(scored), baseline: old ? qualityReport(old) : null,
  gains: old ? scored.filter((row, at) => old[at].actual !== row.target && row.actual === row.target).map(row => row.id) : [],
  regressions: old ? scored.filter((row, at) => old[at].actual === row.target && row.actual !== row.target) : [],
  failures: scored.filter(row => row.actual !== row.target) };
const output = option('output'); if (output) atomicWriteSync(output, JSON.stringify(report, null, 2) + '\n');
console.log({ rows: rows.length, exact: report.current.overall.exact, baselineExact: report.baseline?.overall.exact, regressions: report.regressions.length, failures: report.failures.length, cer: report.current.overall.cer, precision: report.current.overall.precision });
if (process.argv.includes('--enforce') && (report.regressions.length || !input && report.failures.length)) throw new Error('Priority quality gate failed.');

}
void main().catch(error => { console.error(error); process.exitCode = 1; });
