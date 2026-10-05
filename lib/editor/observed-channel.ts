import { restoreWord } from './lexicon';
import { preservesDiacritics } from './neural/diacritics';
import { dictionaryCandidates, foldLetters } from './dictionary';
import { productiveMorphology } from './productive-morphology';
import { canonicalProtectedTerm } from './protected-terminology';
import { isCanonicalEntity } from './entities/resolver';
import model from './observed-channel-model.json';

export interface ChannelRule { from: string; to: string; left: string; right: string; count: number }
export interface ObservedChannelModel { version: 1; vocabulary: string[]; rules: ChannelRule[]; accentRules: ChannelRule[]; trainingSHA256: string; documents: number; examples: number }
const compiled = new WeakMap<ObservedChannelModel, Map<string, string[]>>();
const cache = new Map<string, string | null>();
const lower = (word: string) => word.normalize('NFC').toLocaleLowerCase('az-AZ');
export function isKnownSurface(word: string): boolean {
  return Boolean(canonicalProtectedTerm(word) || isCanonicalEntity(word) || dictionaryCandidates(word)?.has(lower(word)) || productiveMorphology.isValidWordForm(word));
}
function vocabularyIndex(artifact: ObservedChannelModel): Map<string, string[]> {
  const cached = compiled.get(artifact); if (cached) return cached;
  if (artifact.version !== 1 || !/^[a-f0-9]{64}$/u.test(artifact.trainingSHA256)
    || !Number.isInteger(artifact.documents) || artifact.documents < 1 || !Number.isInteger(artifact.examples) || artifact.examples < 1
    || artifact.vocabulary.length > 10000 || artifact.rules.length > 1000 || artifact.accentRules.length > 1000
    || [...artifact.rules, ...artifact.accentRules].some(rule => !Number.isInteger(rule.count) || rule.count < 1
      || !rule.from && !rule.to || rule.from.length > 3 || rule.to.length > 3 || rule.left.length !== 1 || rule.right.length !== 1)) {
    throw new Error('Unsupported or malformed observed spelling channel.');
  }
  const index = new Map<string, string[]>();
  for (const surface of artifact.vocabulary) {
    if (!/^[a-zəçğıöşü]{2,32}$/u.test(surface)) throw new Error('Invalid observed spelling vocabulary.');
    const key = foldLetters(surface), values = index.get(key) ?? []; values.push(surface); index.set(key, values);
  }
  compiled.set(artifact, index); return index;
}
function matches(value: string, at: number, rule: ChannelRule): boolean {
  return value.slice(at, at + rule.from.length) === rule.from
    && (at === 0 ? '^' : value[at - 1]) === rule.left
    && (at + rule.from.length === value.length ? '$' : value[at + rule.from.length]) === rule.right;
}
/** Learned local edit channels propose spellings, not arbitrary word rewrites.
 * Explicit valid surfaces and competing candidates veto a decision. Work is
 * bounded to two edits, 128 proposals and 32 characters; scores are not probabilities. */
export function observedSpelling(raw: string, artifact: ObservedChannelModel = model as ObservedChannelModel): string | undefined {
  const vocabulary = vocabularyIndex(artifact);
  const input = lower(raw);
  if (!/^[a-zəçğıöşü]{3,32}$/u.test(input) || /\p{Ll}\p{Lu}/u.test(raw) || /^[\p{Lu}]+$/u.test(raw) || isKnownSurface(input)) return undefined;
  // A uniquely recognized inflection with missing accents must go through
  // diacritic restoration, not a structural channel (sənəd -> sənət).
  if (productiveMorphology.findByFoldedForm(input) || restoreWord(input) !== input) return undefined;
  if (artifact === model && cache.has(input)) return cache.get(input) ?? undefined;
  const query = foldLetters(input), queries = new Set([query]), candidates = new Set<string>();
  let frontier = [query];
  for (let depth = 0; depth < 2; depth++) {
    const next: string[] = [];
    for (const word of frontier) for (const rule of artifact.rules) for (let at = 0; at <= word.length - rule.from.length; at++) {
      if (queries.size >= 128) break;
      if (!matches(word, at, rule)) continue;
      if (!rule.from && /^(?:n|d|l)$/u.test(rule.to) && at > word.length - 4) continue;
      const changed = word.slice(0, at) + rule.to + word.slice(at + rule.from.length);
      if (!queries.has(changed)) { queries.add(changed); next.push(changed); }
    }
    frontier = next;
  }
  for (const word of queries) {
    const morphological = productiveMorphology.findByFoldedForm(word);
    const values = new Set([...(vocabulary.get(word) ?? []), ...(dictionaryCandidates(word) ?? []), ...(morphological ? [morphological] : [])]);
    for (const candidate of values) {
      if (word === query && !vocabulary.get(word)?.includes(candidate)) continue;
      if (candidate === input || candidate.length > 32 || canonicalProtectedTerm(candidate) || isCanonicalEntity(candidate)) continue;
      // Only position-aligned learned accent replacements are allowed here.
      // Structural edits containing explicit accents use the existing DP guard.
      const conflicts = [...input].some((letter, at) => /[əıçğöşü]/u.test(letter) && candidate[at] !== letter);
      if (conflicts && !preservesDiacritics(input, candidate) && (candidate.length !== input.length || [...input].some((letter, at) => /[əıçğöşü]/u.test(letter) && candidate[at] !== letter
        && !artifact.accentRules.some(rule => rule.from === letter && rule.to === candidate[at] && matches(input, at, rule))))) continue;
      candidates.add(candidate);
    }
  }
  const selected = candidates.size === 1 ? [...candidates][0] : undefined;
  if (artifact === model) { if (cache.size >= 2048) cache.clear(); cache.set(input, selected ?? null); }
  return selected;
}
/** Join only two individually unrecognized fragments into a verified word.
 * Legitimate pairs, suffix particles (də/ki), punctuation and newlines survive. */
export function repairObservedSpacing(text: string): string {
  const split = text.replace(/(?<![\p{L}\p{N}_])([a-zəçğıöşü]{9,32})(?![\p{L}\p{N}_])/gu, raw => {
    if (isKnownSurface(raw)) return raw;
    const candidates = new Set<string>();
    for (let at = 4; at <= raw.length - 4; at++) {
      const left = productiveMorphology.findByFoldedForm(raw.slice(0, at)) ?? raw.slice(0, at);
      const right = productiveMorphology.findByFoldedForm(raw.slice(at)) ?? raw.slice(at);
      const a = productiveMorphology.analyzeWord(left), b = productiveMorphology.analyzeWord(right);
      const possessed = a.some(row => row.pos === 'noun' && row.features.case === 'genitive')
        && b.some(row => row.pos === 'noun' && row.features.possessivePerson === 3);
      const objectVerb = a.some(row => row.pos === 'noun' && row.features.case === 'accusative')
        && b.some(row => row.pos === 'verb' && row.features.tense && !row.features.mood);
      if (possessed || objectVerb) candidates.add(left + ' ' + right);
    }
    return candidates.size === 1 ? [...candidates][0] : raw;
  });
  return split.replace(/(?<![\p{L}\p{N}_])([a-zəçğıöşü]{3,16}) +([a-zəçğıöşü]{3,16})(?![\p{L}\p{N}_])/gu, (whole, left: string, right: string) => {
    if (isKnownSurface(left) || isKnownSurface(right) || isKnownSurface(restoreWord(left)) || isKnownSurface(restoreWord(right))
      || /^(?:ile|ucun|kimi|de|da|ki|ve|ya|ise)$/u.test(foldLetters(right))) return whole;
    const joined = left + right;
    const recognized = productiveMorphology.findByFoldedForm(joined) ?? observedSpelling(joined);
    if (recognized) return recognized;
    const candidates = new Set<string>();
    for (let at = 2; at < joined.length - 2; at++) for (const vowel of 'aeiou') {
      const candidate = productiveMorphology.findByFoldedForm(joined.slice(0, at) + vowel + joined.slice(at));
      if (candidate && productiveMorphology.analyzeWord(candidate).some(row => row.source === 'rule')) candidates.add(candidate);
    }
    return candidates.size === 1 ? [...candidates][0] : whole;
  });
}
