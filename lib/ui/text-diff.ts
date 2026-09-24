export interface DiffPart { text: string; changed: boolean }

// Whole words, punctuation and whitespace. Bounded monotone alignment:
// O(tokens * WINDOW) time and O(tokens) memory, including unrelated documents.
const SEGMENTS = /[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*|\s+|[^\p{L}\p{N}\s]/gu;
const WINDOW = 32;
function fold(value: string): string {
  return value.normalize('NFC').toLocaleLowerCase('az-AZ').replace(/[əçıöüşğ]/gu,
    letter => ({ ə: 'e', ç: 'c', ı: 'i', ö: 'o', ü: 'u', ş: 's', ğ: 'g' })[letter]!);
}

export function buildAnimatedDiff(input: string, output: string): DiffPart[] {
  const before = (input.match(SEGMENTS) ?? []).filter(t => !/^\s+$/u.test(t));
  const segments = output.match(SEGMENTS) ?? [];
  const after = segments.filter(t => !/^\s+$/u.test(t));
  const left = before.map(fold);
  const right = after.map(fold);
  const changed: boolean[] = [];
  let i = 0;
  let j = 0;
  while (j < after.length) {
    if (i >= before.length) { changed[j++] = true; continue; }
    if (left[i] === right[j]) {
      changed[j] = before[i] !== after[j];
      i++; j++; continue;
    }
    let deletion = 0;
    let insertion = 0;
    for (let offset = 1; offset <= WINDOW; offset++) {
      if (!deletion && left[i + offset] === right[j]) deletion = offset;
      if (!insertion && right[j + offset] === left[i]) insertion = offset;
      if (deletion || insertion) break;
    }
    if (deletion && (!insertion || deletion <= insertion)) { i += deletion; continue; }
    if (insertion) {
      for (let k = 0; k < insertion; k++) changed[j++] = true;
      continue;
    }
    // Distant moves are conservatively displayed as changes.
    changed[j++] = true;
    i++;
  }
  let token = 0;
  return segments.map(text => ({ text, changed: /^\s+$/u.test(text) ? false : changed[token++] }));
}
