import { fold } from '../local-ai/core';
/** Explicit diacritics may shift with inserted/deleted letters, but may not
 * themselves be erased or replaced. ASCII diacritic restoration is not a
 * structural edit; long inflections may need more than four accents.
 * Work is bounded by the token length. */
export function preservesDiacritics(raw: string, target: string): boolean {
  const a = [...raw.toLocaleLowerCase('az-AZ')], b = [...target.toLocaleLowerCase('az-AZ')];
  const foldedA = a.map(fold), foldedB = b.map(fold);
  const protectedLetter = (letter: string) => /[əıçğöşü]/u.test(letter);
  let previous = b.map((_, at) => at + 1); previous.unshift(0);
  for (let i = 1; i <= a.length; i++) {
    const current = [protectedLetter(a[i - 1]) ? Infinity : previous[0] + 1];
    for (let j = 1; j <= b.length; j++) current[j] = Math.min(
      current[j - 1] + 1, protectedLetter(a[i - 1]) ? Infinity : previous[j] + 1,
      previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : protectedLetter(a[i - 1]) ? Infinity
        : foldedA[i - 1] === foldedB[j - 1] ? 0 : 1));
    previous = current;
  }
  return previous[b.length] <= 4;
}

