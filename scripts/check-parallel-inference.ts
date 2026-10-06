/** Compare speculative execution against an unchanged base snapshot and targets. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { correctText, formatEmail } from '../lib/editor/correct';
import { isEstablishedSurface } from '../lib/editor/lexicon';
import { createInferenceRunner } from '../lib/editor/inference-cache';
import { runExpert } from '../lib/workers/expert-runner';

async function main() {
  const argument = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  const baseline = argument('baseline');
  if (!baseline) throw new Error('Pass --baseline=/path/to/pre-change/snapshot.json');
  const rows = JSON.parse(readFileSync(baseline, 'utf8')) as { fixture: string; id: string; input: string; output: string }[];
  const cache = new Map<string, Awaited<ReturnType<typeof runExpert>>>();
  let reused = 0, recomputed = 0, rejected = 0;
  let textCases = 0, mailCases = 0;
  const started = performance.now();
  for (const row of rows) {
    if (!cache.has(row.input)) cache.set(row.input, (await Promise.all((['log-spelling', 'sentence-boundary'] as const).map(stage => runExpert({ revision: 1, text: row.input, stage })))).flat());
    const prepared = { revision: 1, text: row.input, proposals: cache.get(row.input)! };
    // Check both formatting paths against the original output snapshot. Rows with
    // preserveFormatting=true are covered by direct A/B plus existing gold gates.
    const { run, stats } = createInferenceRunner(prepared, row.input, isEstablishedSurface);
    const actual = correctText(row.input, false, { inference: run }).text;
    const direct = correctText(row.input).text;
    assert.equal(actual, direct, `${row.fixture}/${row.id}: speculative mismatch`);
    // Baseline snapshots carry the existing formatting option implicitly; for
    // those few rows, compare the preserved path instead of changing the target.
    if (direct !== row.output) assert.equal(correctText(row.input, true, { inference: run }).text, row.output, `${row.fixture}/${row.id}: baseline mismatch`);
    else assert.equal(actual, row.output, `${row.fixture}/${row.id}: baseline mismatch`);
    assert.equal(correctText(actual).text, actual, `${row.fixture}/${row.id}: idempotency`);
    textCases++;
    if (/mail|email/u.test(row.fixture)) {
      const options = { emailGreeting: 'Salam, hər vaxtınız xeyir.', omitSubject: true };
      assert.equal(formatEmail(row.input, options, { inference: run }).text, formatEmail(row.input, options).text, `${row.fixture}/${row.id}: email mismatch`);
      mailCases++;
    }
    reused += stats.reused; recomputed += stats.recomputed; rejected += stats.rejected;
  }
  const sentence = 'bu gun yeni layiheni yoxladim ve butun senedleri hazirladim'.split(' ');
  const timings: Record<string, { directMs: number; preparedFinalMs: number; preparationMs: number }> = {};
  const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
  for (const count of [200, 900]) {
    const text = Array.from({ length: count }, (_, index) => sentence[index % sentence.length]).join(' ');
    const start = performance.now();
    const proposals = (await Promise.all((['log-spelling', 'sentence-boundary'] as const).map(stage => runExpert({ revision: 1, text, stage })))).flat();
    const preparationMs = performance.now() - start;
    const { run } = createInferenceRunner({ revision: 1, text, proposals }, text, isEstablishedSurface);
    const measure = (prepared: boolean) => median(Array.from({ length: 7 }, () => {
      const start = performance.now(); correctText(text, false, prepared ? { inference: run } : {}); return performance.now() - start;
    }));
    timings[count] = { directMs: measure(false), preparedFinalMs: measure(true), preparationMs };
  }
  const report = { textCases, mailCases, distinctInputs: cache.size, reused, recomputed, rejected, changedOutputs: 0,
    elapsedMs: performance.now() - started, timings,
    note: 'Node timings exclude browser worker startup and serialization; preparation is additional CPU work. No speedup claim for end-to-end browser latency.' };
  console.log(JSON.stringify(report, null, 2));
  const output = argument('out'); if (output) writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
