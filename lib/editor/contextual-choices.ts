/** Conservative sentence-wide evidence for high-frequency Azerbaijani homographs.
 * Return undefined on weak/conflicting evidence; never guess from a bare word.
 */
import { dictionaryCandidates } from './dictionary';
import { productiveMorphology } from './productive-morphology';
const evidence: Record<string, { alternatives: readonly [string, readonly string[]][] }> = {
  seher: { alternatives: [
    ['səhər', ['oyandım', 'oyandim', 'tezdən', 'tezden', 'saat', 'yeməyi', 'yemeyi', 'günəş', 'gunes', 'hava', 'nahar', 'axşam', 'axsam', 'gecə', 'gece', 'sübh', 'subh']],
    ['şəhər', ['küçə', 'kuce', 'küçələr', 'kuceler', 'mərkəz', 'merkez', 'bina', 'binalar', 'əhalisi', 'ehalisi', 'nəqliyyat', 'neqliyyat', 'rayon', 'paytaxt']],
  ] },
  suret: { alternatives: [
    ['surət', ['sənəd', 'sened', 'məktub', 'mektub', 'nüsxə', 'nusxe', 'arxiv', 'imza', 'əsli', 'esli', 'çıxarış', 'cixaris', 'fayl']],
    ['sürət', ['saniyə', 'saniye', 'tezlik', 'internet', 'şəbəkə', 'sebeke', 'performans', 'artdı', 'artdi', 'azaldı', 'azaldi', 'yavaş', 'yavas', 'km']],
  ] },
};

const fold = (text: string) => text.toLocaleLowerCase('az-AZ').replace(/[əıçğöşü]/gu,
  value => ({ ə: 'e', ı: 'i', ç: 'c', ğ: 'g', ö: 'o', ş: 's', ü: 'u' })[value]!);

export function sentenceEvidence(sentence: string): ReadonlySet<string> {
  return new Set((sentence.match(/\p{L}+/gu) ?? []).map(fold));
}

export function chooseBySentence(word: string, surrounding: ReadonlySet<string>): string | undefined {
  const entry = evidence[fold(word)];
  if (!entry || /[əıçğöşü]/iu.test(word)) return undefined;
  const scores = entry.alternatives.map(([, cues]) =>
    [...surrounding].filter(token => cues.some(cue => {
      const target = fold(cue);
      return token === target || (target.length >= 4 && token.startsWith(target));
    })).length);
  const winner = scores[0] > scores[1] ? 0 : scores[1] > scores[0] ? 1 : -1;
  if (winner < 0 || scores[winner] === 0
    || (winner === 1 && fold(word) === 'seher' && scores[winner] < 2)
    || (surrounding.size > 35 && scores[winner] - scores[1 - winner] < 2)) return undefined;
  const selected = entry.alternatives[winner][0];
  return /^[A-ZƏÇĞIİÖŞÜ]/u.test(word)
    ? selected[0].toLocaleUpperCase('az-AZ') + selected.slice(1) : selected;
}

/** Select an ambiguous surface only when its POS fits an independently parsed neighbour. */
export function chooseByGrammar(word: string, nextWord: string, previousWord = ''): string | undefined {
  const key = fold(word);
  if ((key !== 'uc' && key !== 'adi') || /[əıçğöşü]/iu.test(word)) return undefined;
  const forms = dictionaryCandidates(word);
  if (key === 'adi') {
    if (!forms?.has('adi') || !forms.has('adı')) return undefined;
    const previous = productiveMorphology.analyzeWord(previousWord);
    // A preceding genitive licenses the possessed noun "adı"; without this
    // evidence, the already-valid adjective "adi" remains unchanged.
    if (!previous.some(item => item.pos === 'noun' && item.features.case === 'genitive')) return undefined;
    return /^[A-ZƏÇĞIİÖŞÜ]/u.test(word) ? 'Adı' : 'adı';
  }
  if (!forms?.has('üç') || !forms.has('uç')) return undefined;
  if (nextWord.toLocaleLowerCase('az-AZ') === 'min') return /^[A-ZƏÇĞIİÖŞÜ]/u.test(word) ? 'Üç' : 'üç';
  const next = productiveMorphology.analyzeWord(nextWord);
  // Bare nouns in the nominative can follow a numeral; declined objects and
  // unknown technical names do not provide sufficient evidence.
  if (!next.some(item => item.pos === 'noun' && item.features.case === 'nominative'
    && !item.features.possessivePerson)) return undefined;
  return /^[A-ZƏÇĞIİÖŞÜ]/u.test(word) ? 'Üç' : 'üç';
}
