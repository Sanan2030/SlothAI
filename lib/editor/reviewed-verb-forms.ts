import { foldLetters } from './dictionary';

const high = (stem: string) => ({ a: 'ı', ı: 'ı', o: 'u', u: 'u', ö: 'ü', ü: 'ü', e: 'i', ə: 'i', i: 'i' })[stem.match(/[aəeıioöuü]/gu)?.at(-1) ?? 'a']!;
const low = (stem: string) => /[əeiöü]/u.test(stem.match(/[aəeıioöuü]/gu)?.at(-1) ?? 'a') ? 'ə' : 'a';
const forms = new Map<string, Set<string>>();
// Reviewed verbal stems license verbal endings only. In particular, noun çek
// and its cases cannot be relabelled çək by a global folded-root alias.
for (const [lemma, passive] of [['çək', true], ['sayıl', false], ['rəqəmsallaşdır', true],
  ['indekslən', false], ['sürtün', false], ['qarışdır', true]] as const) {
  const stems = [lemma, ...(passive ? [lemma+high(lemma)+'l'] : [])];
  for (const stem of stems) for (const negative of [false, true]) {
    const base = stem+(negative ? 'm'+low(stem) : ''), i = high(base), a = low(base);
    const present = negative ? stem+'m'+high(stem)+'r' : stem+high(stem)+'r';
    const surfaces = [present, base+'m'+i+'ş', base+'d'+i, base+'d'+i+'m', base+'d'+i+'n',
      base+(negative ? 'y' : '')+i+'b', base+(negative ? 'y' : '')+a+'n'];
    const participle = base+'d'+i+(a === 'ə' ? 'y' : 'ğ')+i;
    surfaces.push(participle, participle+'n'+i, participle+'n'+i+'n');
    for (const surface of surfaces) {
      const key = foldLetters(surface), bucket = forms.get(key) ?? new Set<string>();
      bucket.add(surface); forms.set(key, bucket);
    }
  }
}

export function restoreReviewedVerb(raw: string): string | undefined {
  if (/\p{Ll}\p{Lu}/u.test(raw) || /^[\p{Lu}]+$/u.test(raw)) return undefined;
  const lower = raw.toLocaleLowerCase('az-AZ');
  const values = [...(forms.get(foldLetters(lower)) ?? [])].filter(target => [...lower].every((letter, at) =>
    !/[əçğıöşü]/u.test(letter) || target[at] === letter));
  if (values.length !== 1) return undefined;
  const value = values[0];
  return /^\p{Lu}/u.test(raw) ? value[0].toLocaleUpperCase('az-AZ')+value.slice(1) : value;
}
