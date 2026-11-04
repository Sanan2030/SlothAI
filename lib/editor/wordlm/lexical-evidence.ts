import artifact from './model.json';
import { dictionaryCandidates, foldLetters, chooseSpelling } from '../dictionary';
import stemClasses from '../generated/az-stem-classes.json';

const nominalRoots = new Set(stemClasses.noun.split(' '));

// Source-derived lexical attestation, separate from contextual LM ranking.
// No sentence/reference lookup and no new model fitting or tuned probabilities.
let index: Map<string, Set<string>> | undefined;
function vocabulary(): Map<string, Set<string>> {
  if (index) return index;
  index = new Map();
  for (const word of artifact.words) {
    if (!/^[a-zəçğıöşü]{3,40}$/u.test(word)) continue;
    const key = foldLetters(word), values = index.get(key) ?? new Set<string>();
    values.add(word); index.set(key, values);
  }
  return index;
}

/** A unique ASCII spelling or an explicitly accented attested spelling is
 * lexical evidence, not a contextual sense or linguistic POS annotation. */
export function isUniqueAttestedSurface(raw: string): boolean {
  const lower = raw.normalize('NFC').toLocaleLowerCase('az-AZ');
  const values = vocabulary().get(foldLetters(lower));
  return Boolean(values?.has(lower) && (values.size === 1 || /[əçğıöşü]/u.test(lower)));
}

function uniqueBase(raw: string): string | undefined {
  const lexical = chooseSpelling(raw, dictionaryCandidates(raw));
  if (lexical) return lexical;
  const values = vocabulary().get(foldLetters(raw));
  if (values?.has(raw) && (values.size === 1 || /[əçğıöşü]/u.test(raw))) return raw;
  const compatible = [...(values ?? [])].filter(value => [...raw].every((letter, at) =>
    !/[əçğıöşü]/u.test(letter) || value[at] === letter));
  return compatible.length === 1 ? compatible[0] : undefined;
}

/** Bounded productive suffixes over attested whole bases, not invented lemmas. */
function derivedAttestation(raw: string): string | undefined {
  const low = (stem: string) => /[eəiöü]/u.test(stem.match(/[aəeıioöuü]/gu)?.at(-1) ?? '') ? 'ə' : 'a';
  const high = (stem: string) => ({ a: 'ı', ı: 'ı', o: 'u', u: 'u', ö: 'ü', ü: 'ü', e: 'i', ə: 'i', i: 'i' })[stem.match(/[aəeıioöuü]/gu)?.at(-1) ?? 'a'];
  if (raw.length > 7 && /[aəe]d[əe]k$/u.test(raw)) {
    const stem = uniqueBase(raw.slice(0, -4));
    if (stem && !/[aəeıioöuü]$/u.test(stem)) return stem+low(stem)+'dək';
  }
  if (raw.length > 7 && /k[ıi]$/u.test(raw)) {
    const base = uniqueBase(raw.slice(0, -2));
    if (base && /d[əa]$/u.test(base)) return base+'k'+(base.endsWith('a') ? 'ı' : 'i');
  }
  if (raw.length > 7 && /l[ıiuü]$/u.test(raw)) {
    const stem = uniqueBase(raw.slice(0, -2));
    if (stem && nominalRoots.has(stem)) return stem+'l'+high(stem);
  }
  if (raw.length >= 7 && /s[ıiuü]z$/u.test(raw)) {
    const stem = uniqueBase(raw.slice(0, -3));
    if (stem && nominalRoots.has(stem)) return stem+'s'+high(stem)+'z';
  }
  if (raw.length >= 6 && /l[aəe]$/u.test(raw)) {
    const stem = uniqueBase(raw.slice(0, -2));
    if (stem && nominalRoots.has(stem) && stem.length >= 4 && !/[aəeıioöuü]$/u.test(stem)) return stem+'l'+low(stem);
  }
  return undefined;
}

export function restoreAttestedSuffix(raw: string): string | undefined {
  if (!/^[\p{L}]{6,40}$/u.test(raw) || /\p{Ll}\p{Lu}/u.test(raw) || /^[\p{Lu}]+$/u.test(raw)) return undefined;
  const lower = raw.toLocaleLowerCase('az-AZ'), result = derivedAttestation(lower);
  if (!result || result === lower) return undefined;
  return /^\p{Lu}/u.test(raw) ? result[0].toLocaleUpperCase('az-AZ')+result.slice(1) : result;
}

export function restoreAttestedDiacritics(raw: string): string | undefined {
  if (!/^[\p{L}]{3,40}$/u.test(raw) || /\p{Ll}\p{Lu}/u.test(raw) || /^[\p{Lu}]+$/u.test(raw)) return undefined;
  const lower = raw.normalize('NFC').toLocaleLowerCase('az-AZ');
  const derived = derivedAttestation(lower);
  if (derived && derived !== lower) return /^\p{Lu}/u.test(raw) ? derived[0].toLocaleUpperCase('az-AZ')+derived.slice(1) : derived;
  // Keep an explicitly valid whole spelling; homographs require context.
  if (dictionaryCandidates(lower)?.has(lower)) return undefined;
  const values = vocabulary().get(foldLetters(lower));
  if (values?.has(lower)) return undefined;
  const compatible = [...(values ?? [])].filter(value => [...lower].every((letter, at) =>
    !/[əçğıöşü]/u.test(letter) || value[at] === letter));
  const result = compatible.length === 1 ? compatible[0] : !values?.size ? derivedAttestation(lower) : undefined;
  if (!result || result === lower) return undefined;
  return /^\p{Lu}/u.test(raw) ? result[0].toLocaleUpperCase('az-AZ')+result.slice(1) : result;
}

/** Deleting one accidental repeated key is allowed only with a unique attested
 * whole word. Valid doubled-letter words and multiple candidates survive. */
export function restoreRepeatedKey(raw: string, known: (word: string) => boolean): string | undefined {
  if (!/^[a-zəçğıöşü]{6,40}$/iu.test(raw) || /\p{Ll}\p{Lu}/u.test(raw) || /^[\p{Lu}]+$/u.test(raw)) return undefined;
  const lower = raw.toLocaleLowerCase('az-AZ');
  if (known(lower) || dictionaryCandidates(lower)?.has(lower) || isUniqueAttestedSurface(lower) || derivedAttestation(lower) === lower) return undefined;
  const choices = new Set<string>();
  for (let at = 1; at < lower.length; at++) {
    if (lower[at] !== lower[at-1]) continue;
    const value = lower.slice(0, at)+lower.slice(at+1);
    if (known(value) || dictionaryCandidates(value)?.has(value) || isUniqueAttestedSurface(value)) choices.add(value);
  }
  if (choices.size !== 1) return undefined;
  const result = [...choices][0];
  return /^\p{Lu}/u.test(raw) ? result[0].toLocaleUpperCase('az-AZ')+result.slice(1) : result;
}
