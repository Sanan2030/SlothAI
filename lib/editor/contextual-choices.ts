/** Conservative sentence-wide evidence for high-frequency Azerbaijani homographs.
 * Return undefined on weak/conflicting evidence; never guess from a bare word.
 */
import { places } from './entities/geo';
import { dictionaryCandidates } from './dictionary';
import { productiveMorphology } from './productive-morphology';
const evidence: Record<string, { alternatives: readonly [string, readonly string[]][] }> = {
  seher: { alternatives: [
    ['səhər', ['oyandım', 'oyandim', 'tezdən', 'tezden', 'saat', 'yeməyi', 'yemeyi', 'günəş', 'gunes', 'hava', 'nahar', 'axşam', 'axsam', 'gecə', 'gece', 'sübh', 'subh']],
    ['şəhər', ['küçə', 'kuce', 'küçələr', 'kuceler', 'mərkəz', 'merkez', 'bina', 'binalar', 'əhalisi', 'ehalisi', 'nəqliyyat', 'neqliyyat', 'rayon', 'paytaxt']],
  ] },
  suret: { alternatives: [
    ['surət', ['sənəd', 'sened', 'məktub', 'mektub', 'nüsxə', 'nusxe', 'arxiv', 'imza', 'əsli', 'esli', 'çıxarış', 'cixaris', 'fayl', 'qərar', 'sərəncam', 'əmr', 'protokol']],
    ['sürət', ['saniyə', 'saniye', 'tezlik', 'internet', 'şəbəkə', 'sebeke', 'performans', 'artdı', 'artdi', 'azaldı', 'azaldi', 'yavaş', 'yavas', 'km', 'cavablandır', 'emal', 'yüklən', 'işlən']],
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
  if ((key !== 'uc' && key !== 'adi' && key !== 'suret') || /[əıçğöşü]/iu.test(word)) return undefined;
  if (key === 'suret') {
    // A measuring participle selects the speed sense before a statistical guess.
    if (/^ölç(?:ən|ür|ülən)$/iu.test(nextWord)) return /^\p{Lu}/u.test(word) ? 'Sürət' : 'sürət';
    return undefined;
  }
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

const placeKeys = new Set(places.map(fold));
const cityForms = new Map(productiveMorphology.generateForms({ lemma: 'şəhər', pos: 'noun', limit: 256 })
  .map(surface => [fold(surface), surface]));
/** Resolve a declined city homograph only after an explicitly recognized place. */
export function chooseInflectedPlace(word: string, previousWord: string): string | undefined {
  if (!/^seher/iu.test(word) || /[əçğıöşü]/iu.test(word)
    || !placeKeys.has(fold(previousWord))) return undefined;
  return cityForms.get(fold(word));
}


// Scope the existing semantic cues to verified inflections of the same noun.
// A literal accented word is never changed to the competing lexical meaning.
const inflectedHomographs = new Map<string, { base: string; surfaces: Map<string, string> }>();
for (const [base, entry] of Object.entries(evidence)) for (const [lemma] of entry.alternatives) {
  if (base !== 'suret') continue;
  for (const surface of [...productiveMorphology.generateForms({ lemma, pos: 'noun', limit: 256 }), lemma + 'lə']) {
    const key = fold(surface), family = inflectedHomographs.get(key) ?? { base, surfaces: new Map<string, string>() };
    family.surfaces.set(lemma, surface); inflectedHomographs.set(key, family);
  }
}
export function chooseInflectedHomograph(word: string, surrounding: () => ReadonlySet<string>, nextWord: () => string): string | undefined {
  if (/[əçğıöşü]/iu.test(word)) return undefined;
  const family = inflectedHomographs.get(fold(word));
  if (family && family.surfaces.size > 1 && fold(word) !== family.base) {
    const selected = chooseBySentence(family.base, surrounding());
    const surface = selected ? family.surfaces.get(selected.toLocaleLowerCase('az-AZ')) : undefined;
    if (surface) return /^\p{Lu}/u.test(word) ? surface[0].toLocaleUpperCase('az-AZ') + surface.slice(1) : surface;
  }
  // The locative əl-də versus el-də is resolved by the established light-verb
  // construction, not by declaring the standalone noun "el" a spelling error.
  if (fold(word) === 'elde' && productiveMorphology.analyzeWord(nextWord()).some(row => row.lemma === 'et' && row.pos === 'verb')) {
    return /^\p{Lu}/u.test(word) ? 'Əldə' : 'əldə';
  }
  return undefined;
}
