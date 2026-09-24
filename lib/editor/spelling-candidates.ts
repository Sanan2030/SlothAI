import dictionary from './generated/az-words.json';
import { dictionaryCandidates, foldLetters } from './dictionary';
import type { SpellingCandidateGenerator } from './contracts/spelling';

const buckets = new Map<string, number[]>();
const shortBuckets = new Map<string, number[]>();
const resolutionCache = new Map<string, string | null>();
const candidateCache = new Map<string, readonly string[]>();

// An indexed (initial letter, length) neighborhood keeps each lookup bounded;
// no query may walk the complete dictionary or construct a full edit matrix.
for (let index = 0; index < dictionary.length; index++) {
  const raw = dictionary[index];
  const spelling = raw.toLocaleLowerCase('az-AZ');
  if (!/^[a-zəçğıöşü]{4,17}$/u.test(spelling)) continue;
  const folded = foldLetters(spelling);
  const key = folded.slice(0, 2) + ':' + folded.length;
  const bucket = buckets.get(key) ?? [];
  bucket.push(index);
  buckets.set(key, bucket);
  if (folded.length <= 6) {
    const shortKey = folded[0] + ':' + folded.length;
    const short = shortBuckets.get(shortKey) ?? [];
    short.push(index);
    shortBuckets.set(shortKey, short);
  }
}

export function boundedEditDistance(left: string, right: string, max = 2): number {
  if (Math.abs(left.length - right.length) > max) return max + 1;
  let previous = Array.from({ length: right.length + 1 }, (_, i) => i);
  let previousPrevious = previous;
  for (let i = 1; i <= left.length; i++) {
    const row = [i];
    let minimum = i;
    for (let j = 1; j <= right.length; j++) {
      let value = Math.min(row[j - 1] + 1, previous[j] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && left[i - 1] === right[j - 2]
        && left[i - 2] === right[j - 1]) value = Math.min(value, previousPrevious[j - 2] + 1);
      row.push(value);
      minimum = Math.min(minimum, value);
    }
    if (minimum > max) return max + 1;
    previousPrevious = previous;
    previous = row;
  }
  return previous[right.length];
}

export const spellingCandidates: SpellingCandidateGenerator = {
  candidates(word, limit) {
    const input = word.toLocaleLowerCase('az-AZ');
    if (!/^[a-zəçğıöşü]{4,17}$/u.test(input)) return [];
    const capped = Math.max(0, Math.min(limit, 12));
    if (!capped) return [];
    const cached = candidateCache.get(input);
    if (cached) return cached.slice(0, capped);
    const folded = foldLetters(input);
    const found: { value: string; distance: number }[] = [];
    let inspected = 0;
    for (const length of [folded.length, folded.length + 1, folded.length - 1]) {
      const neighborhood = folded.length <= 5
        ? shortBuckets.get(folded[0] + ':' + length)
        : buckets.get(folded.slice(0, 2) + ':' + length);
      for (const reference of neighborhood ?? []) {
        if (++inspected > 120) break;
        const spelling = dictionary[reference].toLocaleLowerCase('az-AZ');
        const candidateFolded = foldLetters(spelling);
        // Diacritics already present in the input are strong evidence.
        if ([...input].some(letter => /[əçğıöşü]/u.test(letter) && !spelling.includes(letter))) continue;
        const distance = boundedEditDistance(folded, candidateFolded, 1);
        if (distance === 1) found.push({ value: spelling, distance });
      }
      if (inspected > 120) break;
    }
    found.sort((a, b) => a.distance - b.distance || a.value.localeCompare(b.value, 'az'));
    const values = [...new Set(found.map(item => item.value))].slice(0, 12);
    if (candidateCache.size >= 2048) candidateCache.clear();
    candidateCache.set(input, values);
    return values.slice(0, capped);
  },
};

/** Only an unambiguous nearest edit is applied; unknown names stay intact. */
export function chooseIndexedTypo(word: string): string | undefined {
  if (!/^[a-zəçğıöşü]{5,17}$/u.test(word)) return undefined;
  if (resolutionCache.has(word)) return resolutionCache.get(word) ?? undefined;
  // A valid surface form must never be rewritten just because another word is
  // one edit away. This includes the imported dictionary's inflected forms.
  if (dictionaryCandidates(word)?.has(word)) return undefined;
  // An insertion is safer than a substitution or deletion without frequency
  // and part-of-speech metadata (olaraq/olacaq and render/rəndə are near ties).
  const alternatives = spellingCandidates.candidates(word, 12).filter(candidate => {
    if (candidate.length !== word.length + 1) return false;
    const folded = foldLetters(candidate);
    const input = foldLetters(word);
    for (let at = 2; at < input.length; at++) {
      if (/[aıoueəiöü]/u.test(candidate[at])
        && folded.slice(0, at) + folded.slice(at + 1) === input) return true;
    }
    return false;
  });
  const sameFold = new Set(alternatives.map(foldLetters));
  let resolved = sameFold.size === 1 ? alternatives[0] : undefined;
  if (!resolved && word.length >= 6) {
    // Swapping neighboring keys is a high confidence edit only when the
    // resulting spelling is unique. Other substitution/deletion candidates
    // remain suggestions: they can change valid names or grammatical forms.
    const transpositions = spellingCandidates.candidates(word, 12).filter(candidate => {
      if (candidate.length !== word.length) return false;
      const input = foldLetters(word);
      const target = foldLetters(candidate);
      for (let at = 2; at < input.length - 1; at++) {
        if (input[at] !== input[at + 1] && input.slice(0, at) + input[at + 1] + input[at] + input.slice(at + 2) === target) return true;
      }
      return false;
    });
    if (new Set(transpositions.map(foldLetters)).size === 1) resolved = transpositions[0];
  }
  if (resolutionCache.size >= 2048) resolutionCache.clear();
  resolutionCache.set(word, resolved ?? null);
  return resolved;
}
