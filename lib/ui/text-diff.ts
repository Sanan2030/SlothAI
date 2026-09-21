export interface DiffPart {
  text: string;
  changed: boolean;
}

const WORD_RE = /[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*/gu;
const SEGMENT_RE = /[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*|[^\p{L}\p{N}]+/gu;
const WORD_SEGMENT_RE = /^[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*$/u;

function fold(value: string): string {
  return value
    .normalize('NFC')
    .toLocaleLowerCase('az-AZ')
    .replace(/[əçıöüşğ]/gu, (letter) =>
      ({ ə: 'e', ç: 'c', ı: 'i', ö: 'o', ü: 'u', ş: 's', ğ: 'g' } as Record<string, string>)[letter] ?? letter,
    );
}

function substitutionCost(left: string, right: string): number {
  if (left === right) return 0;
  if (left.toLocaleLowerCase('az-AZ') === right.toLocaleLowerCase('az-AZ')) return 1;
  if (fold(left) === fold(right)) return 1;
  return 2;
}

function alignWords(inputWords: string[], outputWords: string[]): Array<number | null> {
  const rows = inputWords.length + 1;
  const cols = outputWords.length + 1;
  const matrix = new Uint16Array(rows * cols);
  const cell = (i: number, j: number) => i * cols + j;

  for (let i = 1; i < rows; i++) matrix[cell(i, 0)] = i * 2;
  for (let j = 1; j < cols; j++) matrix[cell(0, j)] = j * 2;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const replace = matrix[cell(i - 1, j - 1)] + substitutionCost(inputWords[i - 1], outputWords[j - 1]);
      const remove = matrix[cell(i - 1, j)] + 2;
      const insert = matrix[cell(i, j - 1)] + 2;
      matrix[cell(i, j)] = Math.min(replace, remove, insert);
    }
  }

  const mapping: Array<number | null> = Array(outputWords.length).fill(null);
  let i = inputWords.length;
  let j = outputWords.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const cost = substitutionCost(inputWords[i - 1], outputWords[j - 1]);
      if (matrix[cell(i, j)] === matrix[cell(i - 1, j - 1)] + cost) {
        mapping[j - 1] = i - 1;
        i--;
        j--;
        continue;
      }
    }

    if (j > 0 && matrix[cell(i, j)] === matrix[cell(i, j - 1)] + 2) {
      j--;
      continue;
    }

    if (i > 0) {
      i--;
      continue;
    }

    j--;
  }

  return mapping;
}

export function buildAnimatedDiff(input: string, output: string): DiffPart[] {
  if (!output) return [];

  const inputWords = input.match(WORD_RE) ?? [];
  const outputWords = output.match(WORD_RE) ?? [];
  const mapping = alignWords(inputWords, outputWords);
  const segments = output.match(SEGMENT_RE) ?? [output];
  const parts: DiffPart[] = [];
  let outputWordIndex = 0;

  for (const segment of segments) {
    if (!WORD_SEGMENT_RE.test(segment)) {
      parts.push({ text: segment, changed: false });
      continue;
    }

    const inputIndex = mapping[outputWordIndex];
    const changed = inputIndex === null || inputWords[inputIndex] !== segment;

    parts.push({ text: segment, changed });
    outputWordIndex++;
  }

  return parts;
}
