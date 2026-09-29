/** Conservative sentence-wide evidence for high-frequency Azerbaijani homographs.
 * Return undefined on weak/conflicting evidence; never guess from a bare word.
 */
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
