import { places, multiwordPlaces } from './geo';
import { givenNames, surnames, ambiguousNames } from './person-names';
import { organizations } from './organizations';

const azLower = (s: string) => s.toLocaleLowerCase('az-AZ');
const fold = (s: string) => azLower(s).replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u');
const geographic = new Map(places.map(name => [fold(name), name]));
const persons = new Map([...givenNames, ...surnames].map(name => [fold(name), name]));
const exact = new Set([...places, ...givenNames, ...surnames, ...multiwordPlaces, ...organizations].map(azLower));
const suffixes = ['ndan', 'ndən', 'nın', 'nin', 'nun', 'nün', 'dan', 'dən', 'nda', 'ndə', 'den', 'ya', 'yə', 'ye', 'da', 'de', 'də', 'ın', 'in', 'un', 'ün', 'a', 'e', 'ə', 'ı', 'i', 'u', 'ü'];
const typoIndex = new Map<string, string[]>();
for (const [key, value] of geographic) {
  if (key.length < 5) continue;
  const bucket = typoIndex.get(key[0]) ?? [];
  bucket.push(value);
  typoIndex.set(key[0], bucket);
}
const suspiciousCommon = new Set(['saatı', 'saat', 'şəkildə', 'şəkili', 'saatla', 'qarabağlı', 'xəyal', 'ümit', 'əvvəl', 'istəyir']);
function oneEdit(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let edits = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) {
    if (a[i + 1] === b[i] && a[i] === b[i + 1] && a.slice(i + 2) === b.slice(i + 2)) return true;
    if (++edits > 1) return false;
  }
  return edits === 1;
}
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
  const direct = (kind !== 'person' ? geographic.get(key) : undefined) ?? (kind !== 'geo' ? persons.get(key) : undefined);
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
/** Bounded typo lookup: one character change or adjacent transposition, only place names >=6 characters. */
export function resolveEntityTypo(word: string): string | undefined {
  const key = fold(word);
  if (key.length < 6 || suspiciousCommon.has(azLower(word))) return undefined;
  for (const candidate of typoIndex.get(key[0]) ?? []) if (oneEdit(key, fold(candidate))) return candidate;
  // The first two letters can be swapped by a neighbouring-key typing error.
  if (key.length > 7 && key[0] !== key[1]) for (const candidate of typoIndex.get(key[1]) ?? [])
    if (oneEdit(key, fold(candidate))) return candidate;
  return undefined;
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
const multiword = [...multiwordPlaces, ...organizations];
export function protectMultiwordEntities(text: string, protect: (word: string) => string): string {
  for (const phrase of multiword) {
    const alternatives: Record<string, string> = { e: '[eə]', i: '[iıİ]', c: '[cç]', g: '[gğ]', o: '[oö]', s: '[sş]', u: '[uü]' };
    const pattern = [...fold(phrase)].map(c => c === ' ' ? '\\s+' : alternatives[c] ?? c).join('');
    // Match ASCII transliteration as well as original spelling, without altering surrounding text.
    text = text.replace(new RegExp(`(^|[^\\p{L}])(${pattern})(?=$|[^\\p{L}])`, 'giu'), (_all, prefix: string) => prefix + protect(phrase));
  }
  return text;
}
export function resolveEntitiesInText(text: string): string {
  const words = [...text.matchAll(/[\p{L}]+/gu)];
  let cursor = 0;
  return text.replace(/[\p{L}]+/gu, (word, offset: number) => {
    if (/^[\p{Lu}]{2,}$/u.test(word)) return word;
    const previous = cursor++;
    const next = words[previous + 1]?.[0] ?? '';
    const prior = words[previous - 1]?.[0] ?? '';
    const personContext = /^(?:xanım|xanımı|xanimi|bəy|bəyi|beyi|müəllim|müəllimə)$/iu.test(next) || /^(?:hörmətli|cənab)$/iu.test(prior)
      || Boolean(resolveSimple(next, 'person') && surnames.some(s => fold(s) === fold(next)));
    const context = [prior, next, words[previous + 2]?.[0] ?? ''].map(fold).join(' ');
    const geographicContext = /(?:haqqinda|seher|rayon|gedir|gedek|sefer|olke|bolge|erazi|geldim|geldi)/u.test(context);
    const direct = resolveEntityWord(word, personContext, geographicContext);
    return direct ?? word;
  });
}
export const entityInventory = { geography: new Set(places).size, givenNames: new Set(givenNames).size, surnames: surnames.length, organizations: organizations.length, multiword: multiword.length };
