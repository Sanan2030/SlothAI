import { dictionaryCandidates } from '../dictionary';
import { productiveMorphology } from '../productive-morphology';
import { canonicalProtectedTerm } from '../protected-terminology';
import { isCanonicalEntity } from '../entities/resolver';
import { fold } from '../local-ai/core';
import { preservesDiacritics } from './diacritics';
import type { PairedModel } from '../local-ai/paired';
const alphabet = 'abcdefghijklmnopqrstuvwxyz';
const MAX_LOOKUPS = 1600, MAX_RESULTS = 24;
const caches = new WeakMap<Map<string, string[]>, Map<string, string[]>>();
/** Sources supply candidates, never unconditional edits. Preserve valid surfaces. */
export function boundedCandidates(model: PairedModel, index: Map<string, string[]>, raw: string): string[] {
  const input = fold(raw), lower = raw.toLocaleLowerCase('az-AZ');
  if (!/^[a-z]{4,24}$/u.test(input) || canonicalProtectedTerm(raw) || isCanonicalEntity(raw)
    || dictionaryCandidates(lower)?.has(lower) || productiveMorphology.isValidWordForm(lower)
    || Object.hasOwn(model.words, lower)) return [];
  let cache = caches.get(index); if (!cache) { cache = new Map(); caches.set(index, cache); }
  const cached = cache.get(lower); if (cached) return cached;
  const queries = new Map<string, number>([[input, 0]]);
  const add = (word: string, cost: number) => { if (queries.size < MAX_LOOKUPS && cost < (queries.get(word) ?? Infinity)) queries.set(word, cost); };
  for (let at = 0; at < input.length; at++) for (const gap of [1, 2]) {
    if (at + gap >= input.length || input[at] === input[at + gap]) continue;
    const letters = [...input]; [letters[at], letters[at + gap]] = [letters[at + gap], letters[at]]; add(letters.join(''), 1);
  }
  for (let at = 0; at < input.length; at++) add(input.slice(0, at) + input.slice(at + 1), 1);
  for (let at = 0; at < input.length; at++) for (const letter of alphabet) if (letter !== input[at]) add(input.slice(0, at) + letter + input.slice(at + 1), 1);
  for (let at = 0; at <= input.length; at++) for (const letter of alphabet) add(input.slice(0, at) + letter + input.slice(at), 1);
  for (const [from, to] of [['a', 'e'], ['e', 'a'], ['i', 'u'], ['u', 'i']]) {
    const changes = [...input].filter(letter => letter === from).length;
    if (changes >= 2 && changes <= 4) add(input.split(from).join(to), 2);
  }
  const found = new Map<string, number>();
  for (const [query, cost] of queries) {
    const morphology = productiveMorphology.findByFoldedForm(query);
    for (const word of [...(index.get(query) ?? []), ...(dictionaryCandidates(query) ?? []), ...(morphology ? [morphology] : [])]) {
      if (word === lower || canonicalProtectedTerm(word) || isCanonicalEntity(word) || !/^[a-zəçğıöşü]{4,24}$/u.test(word) || !preservesDiacritics(raw, word)) continue;
      if (cost === 2 && !productiveMorphology.isValidWordForm(word)) continue;
      found.set(word, Math.min(cost, found.get(word) ?? Infinity));
    }
  }
  const result = [...found].sort(([a, costA], [b, costB]) => costA - costB
    || (model.words[b]?.count ?? 0) - (model.words[a]?.count ?? 0) || a.localeCompare(b, 'az'))
    .slice(0, MAX_RESULTS).map(([word]) => word);
  if (cache.size >= 4096) cache.delete(cache.keys().next().value!);
  cache.set(lower, result); return result;
}
