/** Validation-only policy selection. Frozen holdouts are read only AFTER selection. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { correctText } from '../lib/editor/correct';
import { type WordLMSelectionPolicy } from '../lib/editor/wordlm/selection';
import { dataset } from './eval/datasets';
import { metrics, type EvaluationRow } from './eval/metrics';

const directory = process.argv.find(value => value.startsWith('--out='))?.slice(6) ?? 'docs/wordlm-experiment';
const source = 'data/local-ai/pairs.json';
const bytes = readFileSync(source);
const pairs = (JSON.parse(bytes.toString()) as { pairs: { id: string; groupId: string; split: string; input: string; target: string }[] }).pairs;
const validation = pairs.filter(row => row.split === 'validation');
const rows: EvaluationRow[] = validation.map(row => ({ id: row.id, documentId: row.groupId, domain: 'validation', category: 'synthetic', input: row.input, expected: row.target, output: '' }));
for (const row of new Map(validation.map(row => [row.groupId, row])).values()) rows.push({ id: row.groupId + '-identity', documentId: row.groupId,
  domain: 'validation', category: 'identity', input: row.target, expected: row.target, output: '' });
const evaluate = (cases: EvaluationRow[], policy?: WordLMSelectionPolicy) => cases.map(row => ({ ...row,
  output: correctText(row.input, false, policy ? { wordLMMode: 'experimental', wordLMPolicy: policy } : {}).text }));
const baseline = evaluate(rows);
const summarize = (outputs: EvaluationRow[], reference: EvaluationRow[]) => ({ counts: metrics(outputs, 0).counts,
  improvedIds: outputs.filter((row, at) => row.output === row.expected && reference[at].output !== row.expected).map(row => row.id),
  regressedIds: outputs.filter((row, at) => row.output !== row.expected && reference[at].output === row.expected).map(row => row.id),
  newFalseEditIds: outputs.filter((row, at) => {
    if (row.output === reference[at].output) return false;
    const before = metrics([reference[at]], 0).counts, after = metrics([row], 0).counts;
    return after.fp > before.fp || after.harmedWords > before.harmedWords;
  }).map(row => row.id) });
const base = summarize(baseline, baseline);
const trials = [];
for (const lmWeight of [0.5, 1]) for (const editPenalty of [2, 4]) for (const minimumMargin of [Math.log(20), Math.log(100)]) {
  const policy = { lmWeight, editPenalty, changePenalty: 1, minimumMargin };
  const report = summarize(evaluate(rows, policy), baseline);
  trials.push({ policy, ...report, safe: report.regressedIds.length === 0 && report.newFalseEditIds.length === 0
    && report.counts.fp <= base.counts.fp && report.counts.harmedWords <= base.counts.harmedWords });
}
trials.sort((a, b) => Number(b.safe) - Number(a.safe) || a.counts.fp - b.counts.fp || b.counts.tp - a.counts.tp
  || b.counts.exact - a.counts.exact || b.policy.minimumMargin - a.policy.minimumMargin || b.policy.editPenalty - a.policy.editPenalty);
const selected = trials[0];
// Freeze the chosen values before opening any acceptance reference.
mkdirSync(directory, { recursive: true });
writeFileSync(`${directory}/validation.json`, JSON.stringify({ source, sourceSHA256: createHash('sha256').update(bytes).digest('hex'),
  provenance: 'Existing assistant-authored synthetic validation families; not real-error probability calibration.',
  validationRows: rows.length, validationFamilies: new Set(rows.map(row => row.documentId)).size,
  baseline: base, trials, selected: selected.policy, validationGate: selected.safe }, null, 2) + '\n');
if (!selected.safe) throw new Error('No validation-safe policy; acceptance sets were not opened and active policy was not changed.');
writeFileSync('lib/editor/wordlm/selection-policy.json', JSON.stringify(selected.policy, null, 2) + '\n');
const acceptance: Record<string, unknown> = {};
let acceptanceGate = true, improvements = 0;
for (const name of ['holdout-500', 'no-harm-2000']) {
  const cases = dataset(name).cases.map(row => ({ ...row, output: '' }));
  const before = evaluate(cases), after = evaluate(cases, selected.policy);
  const comparison = summarize(after, before);
  const unstable = after.filter(row => correctText(row.output, false, { wordLMMode: 'experimental', wordLMPolicy: selected.policy }).text !== row.output).map(row => row.id);
  acceptanceGate &&= comparison.regressedIds.length === 0 && comparison.newFalseEditIds.length === 0 && unstable.length === 0;
  improvements += comparison.improvedIds.length;
  acceptance[name] = { baseline: summarize(before, before), experimental: comparison, unstable };
}
const report = { status: 'experimental-only', validationGate: selected.safe, acceptanceGate,
  promotionEligible: acceptanceGate && improvements > 0, selected: selected.policy, acceptance,
  constraints: 'No model weights fitted, no frozen target modified, no test-based threshold adjustment. Default application remains on the legacy fallback.' };
writeFileSync(`${directory}/acceptance.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (!acceptanceGate) process.exitCode = 1;
