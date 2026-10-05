/** Evaluation only; no targets are loaded by the runtime editor. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { correctText } from '../lib/editor/correct';
import { parseReviewCorpus } from '../lib/editor/review-corpus';
import { qualityReport } from './nlp/metrics';
const path = 'tests/fixtures/release-holdout-300.json';
const bytes = readFileSync(path);
const hash = createHash('sha256').update(bytes).digest('hex');
if (hash !== readFileSync(path + '.sha256', 'utf8').trim()) throw new Error('Frozen holdout hash changed.');
const raw = JSON.parse(bytes.toString()) as { cases: { id: string; category: string }[] };
const corpus = parseReviewCorpus(bytes.toString());
const rows = corpus.cases.map(row => ({ id: row.id, input: row.input, target: row.expected, actual: correctText(row.input).text,
  category: raw.cases.find(item => item.id === row.id)!.category }));
const lexical = rows.map(row => ({ ...row, input: (row.input.match(/\p{L}+/gu) ?? []).join(' '), target: (row.target.match(/\p{L}+/gu) ?? []).join(' '), actual: (row.actual.match(/\p{L}+/gu) ?? []).join(' ') }));
const full = qualityReport(rows), words = qualityReport(lexical);
let needed = 0, abstained = 0;
for (const row of lexical) {
  const input = row.input.split(' '), target = row.target.split(' '), output = row.actual.split(' ');
  // Defined only for aligned one-word corrections; spacing changes use edit-span metrics above.
  if (input.length !== target.length || output.length !== target.length) continue;
  for (let at = 0; at < target.length; at++) if (input[at] !== target[at]) { needed++; abstained += Number(input[at] === output[at]); }
}
const jsonBytes = (directory: string): number => readdirSync(directory).reduce((sum, name) => {
  const file = directory + '/' + name;
  return sum + (statSync(file).isDirectory() ? jsonBytes(file) : name.endsWith('.json') ? statSync(file).size : 0);
}, 0);
const report = { hash, certification: 'assistant-authored compositional heldout; not a blind real-user benchmark',
  overall: full.overall, lexical: words.overall, categories: full.byCategory,
  lexicalAbstention: { definition: 'unaltered erroneous tokens / reference-error tokens in equal-length word alignments', needed, abstained, rate: needed ? abstained / needed : null },
  idempotencyFailures: rows.filter(row => correctText(row.actual).text !== row.actual).map(row => row.id),
  editorJsonBytes: jsonBytes('lib/editor'), rows, failures: full.failures };
const output = process.argv.find(arg => arg.startsWith('--output='))?.slice(9) ?? '/tmp/slothai-release-holdout.json';
writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ hash, output, rows: rows.length, editorJsonBytes: report.editorJsonBytes }));
