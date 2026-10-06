/** Offline, output-first audit. Targets are read unchanged, never derived from predictions. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import type { CorrectionRuntime } from '../lib/editor/correct';

type Row = { id?: string; input?: string; expected?: string; preserveFormatting?: boolean; category?: string };
const argument = (name: string, fallback: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
async function main() {
const outputDirectory = resolve(argument('out', 'docs/performance-audit/current'));
mkdirSync(outputDirectory, { recursive: true });
const started = performance.now();
const { correctText } = await import(pathToFileURL(resolve(argument('editor', 'lib/editor/correct.ts'))).href) as typeof import('../lib/editor/correct');
const moduleLoadMs = performance.now() - started;
const sentence = 'bu gun yeni layiheni yoxladim ve butun senedleri hazirladim';
const sample = (count: number) => Array.from({ length: count }, (_, index) => sentence.split(' ')[index % sentence.split(' ').length]).join(' ');
const small = sample(200), large = sample(900);
const firstStarted = performance.now(); correctText(small); const firstCallMs = performance.now() - firstStarted;
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const measure = (text: string, runtime: CorrectionRuntime = {}) => {
  correctText(text, false, runtime);
  return median(Array.from({ length: 5 }, () => { const start = performance.now(); correctText(text, false, runtime); return performance.now() - start; }));
};
const ablations: Record<string, CorrectionRuntime> = {
  default: {}, noLocal: { useLocalModel: false }, noAttention: { useAttention: false }, noBounded: { useBounded: false },
  noObserved: { useObservedChannel: false }, noBoundary: { useNeuralBoundary: false },
  rulesOnly: { useLocalModel: false, useAttention: false, useBounded: false, useObservedChannel: false, useNeuralBoundary: false },
};
const activeRuntime = ablations[argument('runtime', 'default')];
if (!activeRuntime) throw new Error('Unknown runtime');
const timings = Object.fromEntries(Object.entries(ablations).map(([name, runtime]) => [name, { words200Ms: measure(small, runtime), words900Ms: measure(large, runtime) }]));
const inputById = new Map<string, string>();
const fixtures = readdirSync('tests/fixtures').filter(name => name.endsWith('.json') && (!argument('only', '') || name === argument('only', ''))).sort().map(name => {
  const data = JSON.parse(readFileSync(`tests/fixtures/${name}`, 'utf8'));
  const rows: Row[] = Array.isArray(data) ? data : data.cases ?? data.rows ?? (data.input ? [data] : []);
  for (const row of rows) if (row.id && row.input) inputById.set(row.id, row.input);
  return { name, rows };
});
const snapshot: { fixture: string; id: string; input: string; expected?: string; output: string; exact?: boolean; identity: boolean; idempotent: boolean }[] = [];
for (const { name, rows } of fixtures) {
  let count = 0;
  for (const row of rows) {
    const input = row.input ?? (row.id ? inputById.get(row.id) : undefined);
    if (!input) continue;
    const output = correctText(input, row.preserveFormatting ?? false, activeRuntime).text;
    snapshot.push({ fixture: name, id: row.id ?? String(++count), input, expected: row.expected, output,
      exact: row.expected === undefined ? undefined : output === row.expected, identity: input === row.expected,
      idempotent: correctText(output, row.preserveFormatting ?? false, activeRuntime).text === output });
  }
  console.error(`${name}: ${snapshot.filter(row => row.fixture === name).length} text-mode rows`);
}
const previousPath = argument('compare', '');
const previous = previousPath ? previousPath.split(',').flatMap(path => JSON.parse(readFileSync(path, 'utf8')) as typeof snapshot) : undefined;
const previousByKey = new Map(previous?.map(row => [`${row.fixture}/${row.id}`, row]));
const differences = previous ? snapshot.filter(row => previousByKey.has(`${row.fixture}/${row.id}`) && previousByKey.get(`${row.fixture}/${row.id}`)!.output !== row.output) : [];
const corpora = Object.fromEntries(fixtures.map(({ name }) => {
  const rows = snapshot.filter(row => row.fixture === name);
  return [name, { total: rows.length, targets: rows.filter(row => row.expected !== undefined).length, exact: rows.filter(row => row.exact).length,
    identityFalsePositives: rows.filter(row => row.identity && row.output !== row.input).length, idempotencyFailures: rows.filter(row => !row.idempotent).length }];
}));
const realRows = (JSON.parse(readFileSync('data/nlp/logs/log-2026-10-05-training.json', 'utf8')).sentences as { id: string; input: string; target: string }[]).map(row => ({ ...row, default: correctText(row.input).text, rulesOnly: correctText(row.input, false, ablations.rulesOnly).text, active: correctText(row.input, false, activeRuntime).text }));
writeFileSync(`${outputDirectory}/observed-pairs.json`, JSON.stringify(realRows, null, 2) + '\n');
const report = { comparedRows: snapshot.filter(row => previousByKey.has(`${row.fixture}/${row.id}`)).length, runtime: argument('runtime', 'default'), observedDiagnostic: { total: realRows.length, defaultExact: realRows.filter(row => row.default === row.target).length, rulesOnlyExact: realRows.filter(row => row.rulesOnly === row.target).length, activeExact: realRows.filter(row => row.active === row.target).length, note: 'Observed inputs already used in training; this is a diagnostic, not an independent evaluation.' }, provenance: 'offline audit; project fixtures do not constitute independent human evaluation', moduleLoadMs, firstCallMs, timings, corpora,
  snapshotSha256: createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'), changedOutputs: differences.length,
  modelJsonBytes: readdirSync('lib/editor', { recursive: true }).filter(name => String(name).endsWith('.json')).reduce((sum, name) => sum + Buffer.byteLength(readFileSync(`lib/editor/${name}`)), 0) };
writeFileSync(`${outputDirectory}/snapshot.json`, JSON.stringify(snapshot, null, 2) + '\n');
writeFileSync(`${outputDirectory}/report.json`, JSON.stringify(report, null, 2) + '\n');
writeFileSync(`${outputDirectory}/differences.json`, JSON.stringify(differences, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (process.argv.includes('--require-identical') && differences.length) process.exitCode = 1;

}
void main().catch(error => { console.error(error); process.exitCode = 1; });
