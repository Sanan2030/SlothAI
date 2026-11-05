/** Fixed export/application verification; never fits weights or tunes thresholds. */
import { createReadStream, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { performance } from 'node:perf_hooks';
import { correctText } from '../lib/editor/correct';
import { getStrategyRegistry } from '../lib/strategies/bootstrap';
import { loadPunctCase } from '../lib/editor/punctcase/load';
import { PUNCTCASE_POLICY } from '../lib/editor/punctcase/edit';
import info from '../lib/editor/punctcase/model-info.json';
import golden from '../tests/fixtures/punctcase-golden.json';

async function main() {
  const model = await loadPunctCase(), strategy = getStrategyRegistry().get('text-corrector');
  let maximumError = 0, compared = 0;
  for (const example of golden.examples) {
    const predicted = model.predict(example.words);
    for (const head of ['punctuation', 'case'] as const) for (let word = 0; word < example.words.length; word++) {
      for (let label = 0; label < example[head][word].length; label++) {
        maximumError = Math.max(maximumError, Math.abs(predicted[head][word][label] - example[head][word][label])); compared++;
      }
    }
  }
  const quality: Record<string, unknown> = {};
  for (const name of ['holdout-500', 'no-harm-2000']) {
    const corpus = JSON.parse(readFileSync(`data/evaluation/phase0/${name}.json`, 'utf8')) as { cases: { id: string; input: string; expected: string }[] };
    let baselineExact = 0, automaticExact = 0;
    const changedIds: string[] = [], regressedIds: string[] = [], unstableIds: string[] = [];
    for (const row of corpus.cases) {
      const baseline = correctText(row.input).text;
      const enhanced = await strategy.transform({ text: row.input });
      baselineExact += Number(baseline === row.expected); automaticExact += Number(enhanced.transformedText === row.expected);
      if (enhanced.transformedText !== baseline) changedIds.push(row.id);
      if (baseline === row.expected && enhanced.transformedText !== row.expected) regressedIds.push(row.id);
      if (enhanced.metadata.punctCase?.applied && correctText(enhanced.transformedText).text !== enhanced.transformedText) unstableIds.push(row.id);
    }
    quality[name] = { cases: corpus.cases.length, baselineExact, automaticExact, changedIds, regressedIds, unstableIds,
      scope: 'Frozen engineering references; not independent human-reviewed real-user quality.' };
  }
  const data = process.argv.find(value => value.startsWith('--data='))?.slice(7);
  let validation: unknown = 'not requested';
  if (data) {
    const prepared = JSON.parse(readFileSync(`${data}/prepared.json`, 'utf8'));
    const filename = `${data}/punctcase-validation.jsonl.gz`;
    const digest = createHash('sha256');
    for await (const bytes of createReadStream(filename)) digest.update(bytes);
    if (digest.digest('hex') !== prepared.files['punctcase-validation.jsonl.gz'].sha256) throw new Error('Validation artifact integrity mismatch');
    const input = createReadStream(filename), stream = input.pipe(createGunzip());
    const lines = createInterface({ input: stream, crlfDelay: Infinity });
    let rows = 0, punctuationLabels = 0, punctuationCorrect = 0, caseLabels = 0, caseCorrect = 0;
    let truePositive = 0, predictedPositive = 0, actualPositive = 0, transformed = 0, applied = 0, proposed = 0, rejected = 0;
    const changedIds: string[] = [];
    const started = performance.now();
    try {
      for await (const line of lines) {
        const row = JSON.parse(line) as { id: string; words: string[]; punctuation: number[]; case: number[] };
        const result = model.predict(row.words);
        for (let at = 0; at < row.words.length; at++) {
          const p = result.punctuation[at].indexOf(Math.max(...result.punctuation[at]));
          const c = result.case[at].indexOf(Math.max(...result.case[at]));
          if (row.punctuation[at] !== -100) {
            punctuationLabels++; punctuationCorrect += Number(p === row.punctuation[at]);
            truePositive += Number(p !== 0 && p === row.punctuation[at]);
            predictedPositive += Number(p !== 0); actualPositive += Number(row.punctuation[at] !== 0);
          }
          if (row.case[at] !== -100) { caseLabels++; caseCorrect += Number(c === row.case[at]); }
        }
        if (rows < 128) {
          const text = row.words.join(' '), baseline = correctText(text).text;
          const enhanced = await strategy.transform({ text });
          transformed++; applied += enhanced.metadata.punctCase?.applied ?? 0;
          proposed += enhanced.metadata.punctCase?.proposed ?? 0;
          rejected += Number(enhanced.metadata.punctCase?.rejectedUnstable);
          if (enhanced.transformedText !== baseline) {
            changedIds.push(row.id);
            console.log(JSON.stringify({ validationChangedId: row.id, before: baseline, after: enhanced.transformedText }));
          }
        }
        rows++; if (rows === 512) break;
      }
    } finally { lines.close(); stream.destroy(); input.destroy(); }
    validation = { samplePolicy: 'First 512 validation chunks, unchanged fixed policy; only first 128 used for app smoke.',
      rows, punctuationLabels, punctuationAccuracy: punctuationCorrect / punctuationLabels,
      punctuationMicroF1: 2 * truePositive / (predictedPositive + actualPositive), caseLabels,
      caseAccuracy: caseCorrect / caseLabels, transformed, applied, proposed, rejected, changedIds,
      elapsedMs: performance.now() - started, scope: 'Source-derived labels and deliberately depunctuated validation smoke; not real-user quality.' };
  }
  const report = { sourceCheckpointSHA256: info.sourceCheckpointSHA256, exportSHA256: info.sha256,
    precision: 'Original float32, no int8 quantization', golden: { comparedLogits: compared, maximumAbsoluteLogitError: maximumError, tolerance: 1e-3 },
    policy: PUNCTCASE_POLICY, defaultEnabled: true, mode: 'automatic', quality, validation,
    calibrationUsed: false, testSplitRead: false, source: 'Existing validation and frozen references only; no training or policy fitting.' };
  const output = process.argv.find(value => value.startsWith('--output='))?.slice(9)
    ?? 'docs/training/punctcase-automatic-validation-2026-11-05.json';
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (maximumError > 1e-3 || Object.values(quality).some(value => {
    const row = value as { regressedIds: string[]; unstableIds: string[] };
    return row.regressedIds.length || row.unstableIds.length;
  })) process.exitCode = 1;
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
