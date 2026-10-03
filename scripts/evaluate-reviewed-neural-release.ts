import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { correctText } from '../lib/editor/correct';
import { qualityReport } from './nlp/metrics';
import { atomicWriteSync } from './atomic-files.mjs';
const option = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
interface Review { id: string; input: string; expected: string; module: string; preserveFormatting: boolean }
async function main() {
  const baselinePath = option('baseline'), destination = option('output');
  if (!baselinePath || !destination) throw new Error('Use --baseline=previous-correct.ts --output=report.json');
  const baseline = await import(pathToFileURL(resolve(baselinePath)).href) as { correctText: typeof correctText };
  const batch = 'data/nlp/reviews/az-batch-001-effective.json';
  const { cases } = JSON.parse(readFileSync(batch, 'utf8')) as { cases: Review[] };
  const splits = ['train', 'validation', 'test'] as const;
  const ownership = new Map<string, string>();
  for (const split of splits) for (const line of readFileSync(`data/nlp/reviews/az-batch-001-splits/${split}.jsonl`, 'utf8').split(/\r?\n/u).filter(Boolean)) {
    const row = JSON.parse(line) as { documentId: string };
    ownership.set(row.documentId, split);
  }
  const rows = cases.map(row => ({ ...row, split: ownership.get(row.id),
    before: baseline.correctText(row.input, row.preserveFormatting).text,
    actual: correctText(row.input, row.preserveFormatting).text,
    identityBefore: baseline.correctText(row.expected, row.preserveFormatting).text,
    identityAfter: correctText(row.expected, row.preserveFormatting).text }));
  if (rows.some(row => !row.split)) throw new Error('Reviewed example missing its frozen document split.');
  const summarize = (split: string, before: boolean) => qualityReport(rows.filter(row => row.split === split).map(row => ({
    id: row.id, input: row.input, target: row.expected, actual: before ? row.before : row.actual, category: row.module,
  }))).overall;
  const regressions = rows.filter(row => row.before === row.expected && row.actual !== row.expected);
  const identityRegressions = rows.filter(row => row.identityBefore === row.expected && row.identityAfter !== row.expected);
  const report = { batch, policy: '48 training cases are descriptive only; five validation and seven test cases keep their frozen document ownership. Email references score the shared body editor, without generated greetings/signatures. Synthetic owner-approved targets are not blind real-text gold.',
    partitions: Object.fromEntries(splits.map(split => [split, { before: summarize(split, true), after: summarize(split, false) }])),
    exactBefore: rows.filter(row => row.before === row.expected).length,
    exactAfter: rows.filter(row => row.actual === row.expected).length,
    regressions, identityRegressions, rows };
  atomicWriteSync(destination, JSON.stringify(report, null, 2) + '\n');
  console.log({ exactBefore: report.exactBefore, exactAfter: report.exactAfter, regressions: regressions.length, identityRegressions: identityRegressions.length });
  if (regressions.length || identityRegressions.length) throw new Error('Reviewed regression gate failed.');
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
