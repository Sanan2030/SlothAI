// Generated data is MPL-2.0; see public/dictionaries/az/LICENSE and metadata.json.
import words from './generated/az-words.json';

export function foldLetters(text: string): string {
  return text.toLocaleLowerCase('az-AZ').replace(/[əçıöüşğ]/g, letter =>
    ({ ə: 'e', ç: 'c', ı: 'i', ö: 'o', ü: 'u', ş: 's', ğ: 'g' })[letter]!);
}

const index = new Map<string, Set<string>>();
for (const word of words) {
  if (!/^[A-Za-zƏəÇçĞğİıÖöŞşÜü]+(?:[- ’'][A-Za-zƏəÇçĞğİıÖöŞşÜü]+)*$/.test(word)) continue;
  const key = foldLetters(word);
  const values = index.get(key) ?? new Set<string>();
  values.add(word.toLocaleLowerCase('az-AZ'));
  index.set(key, values);
}

export function dictionaryCandidates(word: string): ReadonlySet<string> | undefined {
  return index.get(foldLetters(word));
}

export function dictionaryReplacement(word: string): string | undefined {
  return chooseSpelling(word, dictionaryCandidates(word));
}

export function chooseSpelling(word: string, values?: ReadonlySet<string>): string | undefined {
  const lower = word.toLocaleLowerCase('az-AZ');
  // Existing valid spellings win over alternate meanings with missing accents.
  if (values?.has(lower)) return lower;
  const compatible = [...(values ?? [])].filter(value =>
    [...lower].every((letter, i) => !/[əçğıöşü]/.test(letter) || value[i] === letter));
  return compatible.length === 1 ? compatible[0] : undefined;
}
