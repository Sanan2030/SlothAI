/** Offline diagnostics. Cluster bootstrap is not proof of generalization. */
import { scoreAuditRows } from '../editor-audit-metrics';
import { distance } from '../nlp/metrics';
export interface EvaluationRow { id: string; documentId: string; domain: string; category: string; input: string; expected: string; output: string; idempotent?: boolean }
export interface Estimate { value: number | null; ci95: [number, number] | null }
export function random(seed: number) { let state = seed >>> 0; return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; }; }
export function quantile(values: readonly number[], fraction: number) { const sorted = [...values].sort((a, b) => a - b); const position = (sorted.length - 1) * fraction, lower = Math.floor(position); return sorted[lower] + (sorted[Math.ceil(position)] - sorted[lower]) * (position - lower); }
export function bootstrap(values: readonly number[], statistic: (values: readonly number[]) => number, repetitions = 1000): Estimate {
  if (!values.length) return { value: null, ci95: null };
  const next = random(20261007), estimates: number[] = [];
  for (let repeat = 0; repeat < repetitions; repeat++) estimates.push(statistic(values.map(() => values[Math.floor(next() * values.length)])));
  return { value: statistic(values), ci95: [quantile(estimates, .025), quantile(estimates, .975)] };
}
function counts(row: EvaluationRow): number[] {
  const score = scoreAuditRows([{ ...row, fixture: row.domain }]).wordEdits;
  const targetWords = row.expected.match(/\p{L}+(?:[-’']\p{L}+)*/gu) ?? [], actualWords = row.output.match(/\p{L}+(?:[-’']\p{L}+)*/gu) ?? [];
  return [score.tp, score.fp, score.fn, score.abstainedErrors, score.required, score.correctWords, score.changedCorrectWords,
    Number(row.output === row.expected), 1, Number(row.input === row.expected), Number(row.input === row.expected && row.output !== row.input),
    distance([...row.output.normalize('NFC')], [...row.expected.normalize('NFC')]), [...row.expected.normalize('NFC')].length,
    distance(actualWords, targetWords), targetWords.length, Number(row.idempotent === false), Number(row.idempotent !== undefined)];
}
const ratio = (numerator: number, denominator: number) => denominator ? numerator / denominator : null;
function values(c: readonly number[]) {
  const [tp, fp, fn, abstained, required, correct, changed, exact, total, identity, harmed, charErrors, chars, wordErrors, words, unstable, idempotencyMeasured] = c;
  return { precision: ratio(tp, tp + fp), recall: ratio(tp, tp + fn), f05: ratio(1.25 * tp, 1.25 * tp + .25 * fn + fp),
    falsePositiveRate: ratio(changed, correct), errorAbstentionRate: ratio(abstained, required), sentenceExact: ratio(exact, total), identityFalseChangeRate: ratio(harmed, identity),
    cer: ratio(charErrors, chars), wer: ratio(wordErrors, words), idempotencyFailureRate: ratio(unstable, idempotencyMeasured) };
}
export function metrics(rows: readonly EvaluationRow[], repetitions = 1000) {
  const documents = new Map<string, number[]>();
  for (const row of rows) { const group = documents.get(row.documentId) ?? Array(17).fill(0); counts(row).forEach((v, i) => group[i] += v); documents.set(row.documentId, group); }
  const groups = [...documents.values()], total = groups.reduce((sum, group) => sum.map((v, i) => v + group[i]), Array(17).fill(0) as number[]);
  const point = values(total), distributions = Object.fromEntries(Object.keys(point).map(key => [key, [] as number[]])), next = random(20261007);
  for (let repeat = 0; repeat < repetitions && groups.length; repeat++) {
    const resampled = Array(17).fill(0) as number[];
    for (let i = 0; i < groups.length; i++) { const group = groups[Math.floor(next() * groups.length)]; for (let at = 0; at < group.length; at++) resampled[at] += group[at]; }
    for (const [key, value] of Object.entries(values(resampled))) if (value !== null) distributions[key].push(value);
  }
  return { rows: rows.length, documents: groups.length, counts: { tp: total[0], fp: total[1], fn: total[2], abstainedErrors: total[3], required: total[4], correctWords: total[5], harmedWords: total[6], exact: total[7], identity: total[9], harmedIdentitySentences: total[10], unstable: total[15] },
    estimates: Object.fromEntries(Object.entries(point).map(([key, value]) => [key, { value, ci95: distributions[key].length ? [quantile(distributions[key], .025), quantile(distributions[key], .975)] : null } as Estimate])),
    bootstrap: { repetitions, seed: 20261007, unit: 'documentId', method: 'percentile', warning: 'All-zero events give a degenerate bootstrap interval; this does not establish zero population risk.' },
    convention: 'Case-sensitive letter-word alignment; CER by NFC Unicode code points. Punctuation/spacing are covered by CER and sentence exactness, not word precision. Error abstention is an erroneous word left unchanged, not a model confidence decision.' };
}
