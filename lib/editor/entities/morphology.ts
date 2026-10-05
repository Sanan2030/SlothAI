/** Azerbaijani vowel harmony for proper-name case suffixes. */
const vowels = 'aəeıioöuü';
const lower = (word: string) => word.toLocaleLowerCase('az-AZ');
/** Third-person nominal predicate: Bakı-dır, Bakı-da-dır, Gəncə-dir. */
export function copulaSuffix(surface: string): string {
  const vowel = [...lower(surface)].reverse().find(c => vowels.includes(c)) ?? 'a';
  const high: Record<string, string> = { a: 'ı', ı: 'ı', o: 'u', u: 'u', ə: 'i', e: 'i', i: 'i', ö: 'ü', ü: 'ü' };
  return 'd' + high[vowel] + 'r';
}
export function caseSuffixes(name: string): readonly string[] {
  const stem = lower(name).split(/\s+/u).at(-1) ?? name;
  const vowel = [...stem].reverse().find(letter => vowels.includes(letter)) ?? 'a';
  const back = 'aıou'.includes(vowel);
  const rounded = 'oöuü'.includes(vowel);
  const low = back ? 'a' : 'ə';
  const high = back ? rounded ? 'u' : 'ı' : rounded ? 'ü' : 'i';
  const endsVowel = vowels.includes(stem.at(-1) ?? '');
  // Proper place names use written d in the common local case ending (Sumqayıtdan).
  const d = 'd';
  return ['', endsVowel ? `n${high}n` : `${high}n`, endsVowel ? `y${low}` : low,
    endsVowel ? `n${high}` : high, `${d}${low}`, `${d}${low}n`,
    endsVowel ? `n${high}n${low}` : `${high}n${low}`, `${d}${low}k${high}`];
}
