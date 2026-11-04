/** Explicit local diagnostics for saved development disagreements, no telemetry. */
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { correctText, formatEmail } from '../../lib/editor/correct';
import type { EditorDiagnostic } from '../../lib/editor/diagnostics';
import { loadNovelCorpus } from './corpus';

const argument = (key: string) => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length+3);
const resultPath = argument('results'), out = argument('out');
if (!resultPath || !out) throw new Error('--results=/path/results.jsonl --out=/path/traces.jsonl.gz required');
const comparable = (value: string) => value.normalize('NFC').replace(/\s+/gu, ' ').trim();
const saved = readFileSync(resultPath, 'utf8').trim().split('\n').map(line => JSON.parse(line))
  .filter(row => row.mode === 'default' && (!row.exact || !row.stable));
const corpus = new Map(loadNovelCorpus('data/qa/novel-10000-2026-11-04').rows.map(row => [row.id, row]));
const records = saved.map(result => {
  const row = corpus.get(result.id); if (!row) throw new Error('Unknown ID');
  const decisions: EditorDiagnostic[] = [], runtime = { diagnostics: (event: EditorDiagnostic) => decisions.push(event) };
  const actual = row.module === 'mail' ? formatEmail(row.input, row.options, runtime).text
    : correctText(row.input, row.options.preserveFormatting, runtime).text;
  if (comparable(actual) !== comparable(result.actual)) throw new Error('Source no longer reproduces saved output: '+row.id);
  return { id: row.id, input: row.input, expected: row.expected, actual, decisions,
    scope: 'Observed stages and candidate decisions; relative model scores are not correctness probabilities.' };
});
writeFileSync(out, gzipSync(records.map(row => JSON.stringify(row)).join('\n')+'\n'));
console.log(JSON.stringify({ cases: records.length, out }));
