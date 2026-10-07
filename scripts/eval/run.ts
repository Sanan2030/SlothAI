import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dataset } from './datasets';
import { bootstrap, metrics, type EvaluationRow } from './metrics';
import { correctText, type CorrectionRuntime } from '../../lib/editor/correct';
const outputDirectory = process.argv.find(value => value.startsWith('--out='))?.slice(6) ?? 'docs/evaluation/phase0';
export const policies: Record<string, CorrectionRuntime> = { default: {}, always: { modelPolicy: 'always' }, noLocal: { useLocalModel: false }, noAttention: { useAttention: false }, noBounded: { useBounded: false }, noObserved: { useObservedChannel: false }, noBoundary: { useNeuralBoundary: false }, rulesOnly: { useLocalModel: false, useAttention: false, useBounded: false, useObservedChannel: false, useNeuralBoundary: false } };
export function evaluate(name: string, runtime: CorrectionRuntime = {}): EvaluationRow[] {
  return dataset(name).cases.map(row => { const output = correctText(row.input, false, runtime).text; return { ...row, output, idempotent: correctText(output, false, runtime).text === output }; });
}
export function summarized(rows: EvaluationRow[]) { return { overall: metrics(rows), byCategory: Object.fromEntries([...new Set(rows.map(row => row.category))].map(category => [category, metrics(rows.filter(row => row.category === category))])), failures: rows.filter(row => row.output !== row.expected) }; }
function main() {
  const names = ['holdout-500', 'no-harm-2000'];
  const evaluated = Object.fromEntries(names.map(name => [name, evaluate(name)]));
  const report = Object.fromEntries(names.map(name => [name, summarized(evaluated[name])]));
  const probes = dataset('no-harm-2000').cases;
  const probeChanges = evaluated['no-harm-2000'].map((row, at) => Number(row.output.match(/\p{L}+/gu)?.[1] !== probes[at].probeWord));
  const noHarmProbe = { forms: probes.length, changedForms: probeChanges.reduce((sum, value) => sum + value, 0), falseChangeRate: bootstrap(probeChanges, values => values.reduce((sum, value) => sum + value, 0) / values.length), convention: 'Second letter-word token is the mentioned probe; wrapper words do not dilute this denominator. References may include proper-name casing disputes.' };
  // Existing user-derived evaluation rows stay evaluation-only; do not duplicate their raw text in a new report.
  const path = 'data/nlp/user-input-evaluation.jsonl';
  const observed = readFileSync(path, 'utf8').trim().split('\n').map(line => JSON.parse(line) as { id: string; input: string; target: string; category?: string });
  const rows = observed.map(row => ({ id: row.id, documentId: row.id, domain: 'user-derived-development', category: row.category ?? 'mixed', input: row.input, expected: row.target, output: correctText(row.input).text }));
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(`${outputDirectory}/quality.json`, JSON.stringify({ ...report, noHarmProbe, existingUserDerived: { provenance: 'User-derived development references, assistant targets not blind human-reviewed; independence from earlier tuning not proven.', overall: metrics(rows), failedIds: rows.filter(row => row.output !== row.expected).map(row => row.id) }, calibrationUsed: false, runtimeChanged: false }, null, 2) + '\n');
  console.log(JSON.stringify(Object.fromEntries(Object.entries(report).map(([name, result]) => [name, result.overall])), null, 2));
}
if (process.argv[1]?.endsWith('/run.ts')) main();
