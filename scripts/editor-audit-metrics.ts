/** Word-aligned edit precision/recall. Punctuation is measured separately by sentence exactness. */
export interface AuditRow { input: string; output: string; expected?: string; fixture: string; id: string }
const words = (text: string) => text.match(/\p{L}+(?:[-’']\p{L}+)*/gu) ?? [];
/** Align source words to target positions using minimum edit distance. */
function align(source: string[], target: string[]): { aligned: (string | undefined)[]; inserted: number } {
  const width = target.length + 1;
  const costs = new Uint16Array((source.length + 1) * width);
  for (let i = 0; i <= source.length; i++) costs[i * width] = i;
  for (let j = 0; j <= target.length; j++) costs[j] = j;
  for (let i = 1; i <= source.length; i++) for (let j = 1; j <= target.length; j++) {
    costs[i * width + j] = Math.min(costs[(i - 1) * width + j - 1] + Number(source[i - 1] !== target[j - 1]),
      costs[(i - 1) * width + j] + 1, costs[i * width + j - 1] + 1);
  }
  const aligned: (string | undefined)[] = Array(target.length);
  let i = source.length, j = target.length, inserted = 0;
  while (i || j) {
    const cost = costs[i * width + j];
    if (i && j && cost === costs[(i - 1) * width + j - 1] + Number(source[i - 1] !== target[j - 1])) aligned[--j] = source[--i];
    else if (i && cost === costs[(i - 1) * width + j] + 1) { i--; inserted++; }
    else j--;
  }
  return { aligned, inserted };
}
export function scoreAuditRows(rows: AuditRow[]) {
  let tp = 0, fp = 0, fn = 0, unchangedErrors = 0, required = 0, correctWords = 0, changedCorrectWords = 0;
  const targeted = rows.filter(row => row.expected !== undefined);
  for (const row of targeted) {
    const target = words(row.expected!), input = align(words(row.input), target), output = align(words(row.output), target);
    for (let at = 0; at < target.length; at++) {
      const before = input.aligned[at], after = output.aligned[at], expected = target[at];
      if (before !== expected) {
        required++;
        if (after === expected) tp++;
        else { fn++; if (after === before) unchangedErrors++; }
      } else { correctWords++; if (after !== expected) changedCorrectWords++; }
      if (after !== before && after !== expected) fp++;
    }
    fp += Math.max(0, output.inserted - input.inserted);
  }
  const ratio = (numerator: number, denominator: number) => denominator ? numerator / denominator : null;
  const precision = ratio(tp, tp + fp), recall = ratio(tp, tp + fn);
  return { sentences: targeted.length, exact: targeted.filter(row => row.output === row.expected).length,
    identitySentences: targeted.filter(row => row.input === row.expected).length,
    identityFalsePositives: targeted.filter(row => row.input === row.expected && row.output !== row.input).length,
    wordEdits: { tp, fp, fn, precision, recall, f05: precision !== null && recall !== null && precision + recall ? 1.25 * precision * recall / (0.25 * precision + recall) : null,
      required, abstainedErrors: unchangedErrors, errorAbstentionRate: ratio(unchangedErrors, required), correctWords, changedCorrectWords,
      falsePositiveRateOnCorrectWords: ratio(changedCorrectWords, correctWords), note: 'Case-sensitive word alignment; punctuation and whitespace are evaluated by sentence exactness. Abstention counts erroneous words left unchanged, not a calibrated confidence probability.' } };
}
