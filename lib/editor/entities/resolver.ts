import { places, multiwordPlaces } from './geo';
import { givenNames, surnames, ambiguousNames } from './person-names';
import { organizations, organizationEntities } from './organizations';
import { geographicEntities } from './geo';
import { culturalEntities } from './cultural';
import { namedEntity, type NamedEntity } from './types';
import { caseSuffixes } from './morphology';

const azLower = (s: string) => s.toLocaleLowerCase('az-AZ');
const fold = (s: string) => azLower(s).replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u');
export const namedEntities: readonly NamedEntity[] = [
  ...geographicEntities, ...organizationEntities, ...culturalEntities,
  ...[...new Set(givenNames)].map(name => namedEntity(name, 'person', 'contextual', 'single_word', 'reviewed-local')),
  ...surnames.map(name => namedEntity(name, 'person', 'contextual', 'single_word', 'reviewed-local')),
];
/** Single source of truth for type-aware lookup and suffix normalization. */
const typedForms = new Map<string, { entity: NamedEntity; surface: string }>();
for (const entity of namedEntities) {
  if (entity.canonical.includes(' ') || entity.inflectionPolicy === 'none' && entity.type !== 'religious_text') continue;
  for (const name of [entity.canonical, ...entity.aliases]) {
    for (const ending of entity.inflectionPolicy === 'none' ? [''] : caseSuffixes(entity.canonical)) {
      const key = fold(name + ending);
      if (!typedForms.has(key)) typedForms.set(key, { entity, surface: entity.canonical + ending });
    }
  }
}
const geographic = new Map(places.map(name => [fold(name), name]));
const persons = new Map([...givenNames, ...surnames].map(name => [fold(name), name]));
const exact = new Set([...places, ...givenNames, ...surnames, ...multiwordPlaces, ...organizations].map(azLower));
for (const item of typedForms.values()) exact.add(azLower(item.surface));
const suffixes = ['ndan', 'ndən', 'nın', 'nin', 'nun', 'nün', 'dan', 'dən', 'nda', 'ndə', 'den', 'ya', 'yə', 'ye', 'da', 'de', 'də', 'ın', 'in', 'un', 'ün', 'a', 'e', 'ə', 'ı', 'i', 'u', 'ü'];
const typoForms = new Map<string, string>();
const typoDeletes = new Map<string, Set<string>>();
for (const [key, value] of geographic) {
  if (key.length < 6) continue;
  for (const ending of caseSuffixes(value)) {
    const form = fold(value + ending);
    typoForms.set(form, value + ending);
    for (let at = 0; at < form.length; at++) {
      const signature = form.slice(0, at) + form.slice(at + 1);
      const candidates = typoDeletes.get(signature) ?? new Set<string>();
      candidates.add(form);
      typoDeletes.set(signature, candidates);
    }
  }
}
const suspiciousCommon = new Set(['saatı', 'saat', 'şəkildə', 'şəkili', 'saatla', 'qarabağlı', 'xəyal', 'ümit', 'əvvəl', 'istəyir']);
function suffixOf(name: string, tail: string): string {
  if (!tail) return '';
  // Inflected proper names retain the vowel harmony of the supplied ending;
  // normalise undiacritized case endings with the canonical word's final vowel.
  const last = [...azLower(name)].reverse().find(c => 'aəeıioöuü'.includes(c)) ?? 'a';
  const back = 'aıou'.includes(last);
  const rounded = 'oöuü'.includes(last);
  const mapping: Record<string, string> = { a: back ? 'a' : 'ə', e: back ? 'a' : 'ə', i: back ? rounded ? 'u' : 'ı' : rounded ? 'ü' : 'i',
    ya: back ? 'ya' : 'yə', ye: back ? 'ya' : 'yə', da: back ? 'da' : 'də', de: back ? 'da' : 'də', dan: back ? 'dan' : 'dən', den: back ? 'dan' : 'dən',
    nda: back ? 'nda' : 'ndə', nın: back ? rounded ? 'nun' : 'nın' : rounded ? 'nün' : 'nin' };
  return mapping[fold(tail)] ?? tail;
}
function resolveSimple(word: string, kind: 'geo' | 'person' | 'any' = 'any'): string | undefined {
  const lower = azLower(word);
  const key = fold(word);
  const entry = typedForms.get(key);
  const direct = entry && (kind === 'any' || (kind === 'geo' ? entry.entity.type !== 'person' : entry.entity.type === 'person')) ? entry.surface : undefined;
  if (direct && (entry?.entity.type === 'person') && ambiguousNames.has(entry.entity.canonical) && !word.includes(' ')) return direct;
  if (direct && suspiciousCommon.has(lower)) return undefined;
  if (direct) return direct;
  for (const suffix of suffixes) {
    if (key.length <= suffix.length + 3 || !key.endsWith(fold(suffix))) continue;
    const stem = key.slice(0, -fold(suffix).length);
    const base = (kind !== 'person' ? geographic.get(stem) : undefined) ?? (kind !== 'geo' ? persons.get(stem) : undefined);
    if (!base) continue;
    // A lexical common noun is not an inflected place name.
    if (suspiciousCommon.has(lower) || (base === 'Şəki' && stem !== 'seki')) continue;
    const tail = word.slice(word.length - suffix.length);
    return base + suffixOf(base, tail);
  }
  return undefined;
}
/** A bounded deletion index supports single insertion, deletion, substitution,
 * or adjacent transposition. Ambiguous equal-cost alternatives are rejected. */
export function resolveEntityTypo(word: string): string | undefined {
  const key = fold(word);
  if (key.length < 6 || key.length > 28 || suspiciousCommon.has(azLower(word)) || typoForms.has(key)) return undefined;
  const matches = new Set<string>();
  for (const form of typoDeletes.get(key) ?? []) matches.add(form);
  for (let at = 0; at < key.length; at++) {
    const shorter = key.slice(0, at) + key.slice(at + 1);
    if (typoForms.has(shorter)) matches.add(shorter);
    for (const form of typoDeletes.get(shorter) ?? []) if (form.length === key.length) matches.add(form);
    if (at + 1 < key.length && key[at] !== key[at + 1]) {
      const swapped = key.slice(0, at) + key[at + 1] + key[at] + key.slice(at + 2);
      if (typoForms.has(swapped)) matches.add(swapped);
    }
    if (matches.size > 8) return undefined;
  }
  if (matches.size === 1) return typoForms.get([...matches][0]);
  // A duplicated final consonant is unambiguously the base name even when
  // it also resembles several different inflected forms.
  if (key.at(-1) === key.at(-2) && typoForms.has(key.slice(0, -1))) return typoForms.get(key.slice(0, -1));
  const sameEnding = [...matches].filter(form => form.slice(-3) === key.slice(-3));
  return sameEnding.length === 1 ? typoForms.get(sameEnding[0]) : undefined;
}
export function isCanonicalEntity(word: string): boolean { return exact.has(azLower(word)); }
const wordCache = new Map<string, string | undefined>();
export function resolveEntityWord(word: string, personContext = false, allowTypo = true): string | undefined {
  const cacheKey = `${word}:${personContext ? 1 : 0}:${allowTypo ? 1 : 0}`;
  if (wordCache.has(cacheKey)) return wordCache.get(cacheKey);
  const resolved = resolveSimple(word);
  let answer = resolved;
  if (resolved && !personContext && (ambiguousNames.has(resolved)
    || !persons.has(fold(word)) && [...ambiguousNames].some(name => resolved.startsWith(name)
      && resolved.length <= name.length + 4))) answer = undefined;
  if (!resolved && allowTypo) answer = resolveEntityTypo(word);
  if (wordCache.size >= 4096) wordCache.clear();
  wordCache.set(cacheKey, answer);
  return answer;
}
const multiword = namedEntities.filter(item => item.canonical.includes(' '));
const alternatives: Record<string, string> = { e: '[eə]', i: '[iıİ]', c: '[cç]', g: '[gğ]', o: '[oö]', s: '[sş]', u: '[uü]' };
const patterns = multiword.sort((a, b) => b.canonical.length - a.canonical.length).map(entity => {
  const pattern = [...fold(entity.canonical)].map(c => c === ' ' ? '\\s+' : alternatives[c] ?? c).join('');
  const suffixes = new Map<string, string>();
  if (entity.inflectionPolicy === 'last_word') {
    const last = entity.canonical.split(' ').at(-1)!;
    for (const suffix of caseSuffixes(last).slice(1)) suffixes.set(fold(suffix), suffix);
    if (/[ıiuü]$/iu.test(last)) {
      const vowel = last.at(-1)!.toLocaleLowerCase('az-AZ');
      const low = 'ıu'.includes(vowel) ? 'a' : 'ə';
      // The generic word in an official name is already possessive:
      // Universiteti -> Universitetinə, Respublikası -> Respublikasında.
      // Accept both ASCII vowels in the user's ending; restore vowel harmony.
      for (const raw of ['nda', 'nde']) suffixes.set(raw, 'nd' + low);
      for (const raw of ['ndan', 'nden']) suffixes.set(raw, 'nd' + low + 'n');
      for (const raw of ['na', 'ne']) suffixes.set(raw, 'n' + low);
      for (const raw of ['nın', 'nin', 'nun', 'nün']) suffixes.set(fold(raw), 'n' + vowel + 'n');
      for (const raw of ['nı', 'ni', 'nu', 'nü']) suffixes.set(fold(raw), 'n' + vowel);
    }
  }
  const tail = [...suffixes.keys()].sort((a, b) => b.length - a.length).map(s =>
    [...s].map(c => alternatives[c] ?? c).join('')).join('|');
  return { entity, suffixes, firstWord: fold(entity.canonical.split(' ')[0]),
    regex: new RegExp(`(^|[^\\p{L}])(${pattern})(${tail ? `(?:${tail})?` : ''})(?=$|[^\\p{L}])`, 'giu') };
});
export function protectMultiwordEntities(text: string, protect: (word: string) => string): string {
  const searchable = fold(text);
  for (const { entity, suffixes, regex, firstWord } of patterns) {
    if (!searchable.includes(firstWord)) continue;
    text = text.replace(regex, (_all, prefix: string, _name: string, ending: string) =>
      prefix + protect(entity.canonical + (suffixes.get(fold(ending)) ?? ending)));
  }
  return text;
}
export function resolveEntitiesInText(text: string): string {
  const words = [...text.matchAll(/[\p{L}]+/gu)];
  let cursor = 0;
  return text.replace(/[\p{L}]+/gu, word => {
    if (/^[\p{Lu}]{2,}$/u.test(word)) return word;
    const previous = cursor++;
    const next = words[previous + 1]?.[0] ?? '';
    const prior = words[previous - 1]?.[0] ?? '';
    const personContext = /^(?:xanım|xanımı|xanimi|bəy|bəyi|beyi|müəllim|müəllimə)$/iu.test(next) || /^(?:hörmətli|cənab)$/iu.test(prior)
      || Boolean(resolveSimple(next, 'person') && surnames.some(s => fold(s) === fold(next)));
    const context = [prior, next, words[previous + 2]?.[0] ?? ''].map(fold).join(' ');
    const geographicContext = /(?:haqqinda|barede|seher|seher|rayon|gedir|gedek|sefer|səfər|olke|bolge|erazi|geldim|geldi)/u.test(context);
    const direct = resolveEntityWord(word, personContext, geographicContext || /(?:dan|dən|da|də|nın|nin|nun|nün|ya|yə)$/iu.test(word) && word.length > 8);
    return direct ?? word;
  });
}
export const entityInventory = { geography: new Set(places).size, givenNames: new Set(givenNames).size, surnames: surnames.length, organizations: organizations.length, multiword: multiword.length, typed: namedEntities.length };
