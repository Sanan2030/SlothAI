import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { correctText } from '../lib/editor/correct';
import { logSpelling } from '../lib/editor/neural/log-runtime';
import { tokenize } from '../lib/editor/local-ai/core';
import training from '../data/nlp/logs/log-2026-10-05-training.json';
import { quality, type QualityRow } from './nlp/metrics';
import { atomicWriteSync } from './atomic-files.mjs';

const raw = readFileSync('data/nlp/logs/log-unseen-test.json', 'utf8');
const sha = createHash('sha256').update(raw).digest('hex');
if (sha !== readFileSync('data/nlp/logs/log-unseen-test.json.sha256', 'utf8').trim()) throw new Error('Frozen log evaluation hash changed.');
const data = JSON.parse(raw) as { cases: Omit<QualityRow, 'actual'>[] };
if (data.cases.some(row => training.sentences.some(train => train.target === row.target))) throw new Error('Exact target overlap with training.');
const lexical = (text: string) => tokenize(text).map(token => token.word.toLocaleLowerCase('az-AZ')).join(' ');
const evaluate = (rows: Omit<QualityRow, 'actual'>[]) => {
  const cases = rows.map(row => ({ ...row, actual: correctText(row.input).text }));
  let needed = 0, abstained = 0;
  for (const row of cases) {
    const input = tokenize(row.input), target = tokenize(row.target), predicted = tokenize(logSpelling(row.input));
    if (input.length !== target.length || input.length !== predicted.length) continue;
    for (let at = 0; at < input.length; at++) if (input[at].word !== target[at].word) {
      needed++; abstained += Number(predicted[at].word === input[at].word);
    }
  }
  return { fullOutput: quality(cases), lexical: quality(cases.map(row => ({ ...row, input: lexical(row.input), target: lexical(row.target), actual: lexical(row.actual) }))),
    idempotencyFailures: cases.filter(row => correctText(row.actual).text !== row.actual).map(row => row.id),
    rankerAbstention: { requiredTokenEdits: needed, unchangedTokens: abstained, rate: needed ? abstained / needed : null,
      definition: 'Tokens requiring reference changes left unchanged by the added ranker alone; existing heads may still fix them. Includes case and punctuation-independent lexical tokens.' },
    failures: cases.filter(row => row.actual !== row.target), cases };
};
const baselinePath = process.argv.find(value => value.startsWith('--baseline='))?.slice(11);
const baseline = baselinePath ? JSON.parse(readFileSync(baselinePath, 'utf8')) as { training: QualityRow[]; unseen: QualityRow[] } : undefined;
const summarize = (cases: QualityRow[]) => ({ fullOutput: quality(cases), lexical: quality(cases.map(row => ({ ...row, input: lexical(row.input), target: lexical(row.target), actual: lexical(row.actual) }))) });
const result = { testSHA256: sha, baselineCommit: baseline ? '39fbdf3cdf351d9b1de200d7c766ebb42bffe16c' : null,
  before: baseline ? { trainingDiagnostics: summarize(baseline.training), unseen: summarize(baseline.unseen) } : null,
  after: { trainingDiagnostics: evaluate(training.sentences.map(row => ({ ...row, category: 'observed-redacted' }))), unseen: evaluate(data.cases) },
  caveat: 'Training diagnostics are not independent accuracy. The separate 20-case evaluation is assistant-authored and synthetic, not human-reviewed. OCR reference snippets are generic tokens; truncated/unclear fields and proper names excluded from training. No claim of semantic understanding.' };
atomicWriteSync('data/nlp/logs/log-evaluation-report.json', JSON.stringify(result, null, 2) + '\n');
console.log({ before: result.before, after: { training: result.after.trainingDiagnostics.fullOutput, unseen: result.after.unseen.fullOutput, lexical: result.after.unseen.lexical,
  idempotencyFailures: result.after.unseen.idempotencyFailures, abstention: result.after.unseen.rankerAbstention } });
