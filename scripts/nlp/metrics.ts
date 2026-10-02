/** Single-reference, deterministic edit-span metrics, not the CoNLL M2 scorer. */
export interface QualityRow { id: string; input: string; target: string; actual: string; category: string }
export interface Edit { start: number; end: number; replacement: string[] }
const words = (text: string) => text.normalize('NFC').match(/\S+/gu) ?? [];
export function distance(left: readonly string[], right: readonly string[]): number {
  let start = 0, endA = left.length, endB = right.length;
  while (start < endA && start < endB && left[start] === right[start]) start++;
  while (endA > start && endB > start && left[endA - 1] === right[endB - 1]) { endA--; endB--; }
  const a = left.slice(start, endA), b = right.slice(start, endB);
  if (a.length < b.length) return distance(b, a);
  let previous = Uint32Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = new Uint32Array(b.length + 1); current[0] = i;
    for (let j = 1; j <= b.length; j++) current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + Number(a[i - 1] !== b[j - 1]));
    previous = current;
  }
  return previous[b.length];
}
export function edits(source: readonly string[], target: readonly string[]): Edit[] {
  const width = target.length + 1, cells = (source.length + 1) * width;
  if (cells > 4_000_000) throw new Error('Edit alignment exceeds 4 million cells; evaluate sentence-sized rows.');
  const matrix = new Uint32Array(cells), get = (i: number, j: number) => matrix[i * width + j];
  for (let i = 0; i <= source.length; i++) matrix[i * width] = i;
  for (let j = 0; j <= target.length; j++) matrix[j] = j;
  for (let i = 1; i <= source.length; i++) for (let j = 1; j <= target.length; j++) {
    matrix[i * width + j] = Math.min(get(i - 1, j) + 1, get(i, j - 1) + 1, get(i - 1, j - 1) + Number(source[i - 1] !== target[j - 1]));
  }
  const steps: { operation: 'equal' | 'replace' | 'delete' | 'insert'; value?: string }[] = [];
  let i = source.length, j = target.length;
  while (i || j) {
    if (i && j && source[i - 1] === target[j - 1] && get(i, j) === get(i - 1, j - 1)) { steps.push({ operation: 'equal' }); i--; j--; }
    else if (i && j && get(i, j) === get(i - 1, j - 1) + 1) { steps.push({ operation: 'replace', value: target[j - 1] }); i--; j--; }
    else if (i && get(i, j) === get(i - 1, j) + 1) { steps.push({ operation: 'delete' }); i--; }
    else { steps.push({ operation: 'insert', value: target[j - 1] }); j--; }
  }
  const result: Edit[] = []; let position = 0, active: Edit | undefined;
  for (const step of steps.reverse()) {
    if (step.operation === 'equal') { if (active) result.push(active); active = undefined; position++; continue; }
    if (step.operation === 'replace') {
      if (active) result.push(active); active = undefined;
      result.push({ start: position, end: position + 1, replacement: [step.value!] }); position++; continue;
    }
    active ??= { start: position, end: position, replacement: [] };
    if (step.operation !== 'insert') { position++; active.end = position; }
    if (step.value !== undefined) active.replacement.push(step.value);
  }
  if (active) result.push(active);
  return result;
}
const ratio = (numerator: number, denominator: number) => denominator ? numerator / denominator : null;
export function quality(rows: readonly QualityRow[]) {
  let charErrors = 0, wordErrors = 0, chars = 0, wordCount = 0, exact = 0, tp = 0, fp = 0, fn = 0;
  let identity = 0, identityChanged = 0;
  for (const row of rows) {
    const input = row.input.normalize('NFC'), target = row.target.normalize('NFC'), actual = row.actual.normalize('NFC');
    const sourceWords = words(input), goldWords = words(target), predictedWords = words(actual);
    charErrors += distance([...actual], [...target]); chars += [...target].length;
    wordErrors += distance(predictedWords, goldWords); wordCount += goldWords.length;
    exact += Number(actual === target);
    identity += Number(input === target); identityChanged += Number(input === target && actual !== target);
    const gold = new Set(edits(sourceWords, goldWords).map(edit => JSON.stringify(edit)));
    const predicted = new Set(edits(sourceWords, predictedWords).map(edit => JSON.stringify(edit)));
    const matched = [...predicted].filter(edit => gold.has(edit)).length;
    tp += matched; fp += predicted.size - matched; fn += gold.size - matched;
  }
  return { rows: rows.length, exact, accuracy: ratio(exact, rows.length), cer: ratio(charErrors, chars), wer: ratio(wordErrors, wordCount),
    precision: ratio(tp, tp + fp), recall: ratio(tp, tp + fn), f05: ratio(1.25 * tp, 1.25 * tp + 0.25 * fn + fp),
    truePositiveEdits: tp, falsePositiveEdits: fp, missedEdits: fn,
    identityRows: identity, identityChanged, identityFalseChangeRate: ratio(identityChanged, identity),
    charErrors, referenceChars: chars, wordErrors, referenceWords: wordCount };
}
export function qualityReport(rows: readonly QualityRow[]) {
  const categories = [...new Set(rows.map(row => row.category))].sort();
  return { overall: quality(rows), byCategory: Object.fromEntries(categories.map(category => [category, quality(rows.filter(row => row.category === category))])),
    failures: rows.filter(row => row.actual.normalize('NFC') !== row.target.normalize('NFC')),
    convention: 'NFC exact output; Unicode code-point CER; whitespace-token WER; exact source-token-span correction precision/recall/F0.5 with deterministic single-reference alignment. Whitespace-only errors affect CER/accuracy but not token edits. Null means undefined denominator, not perfect accuracy.' };
}
