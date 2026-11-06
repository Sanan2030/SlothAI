import { foldLetters } from './dictionary';
import type { MorphologyEngine } from './contracts/morphology';

const upperLike = (source: string, target: string) => /^\p{Lu}/u.test(source)
  ? target[0].toLocaleUpperCase('az-AZ')+target.slice(1) : target;

/** Local grammatical/terminological evidence for genuine lexical homographs.
 * Existing explicit spellings remain intact; these are bounded word families,
 * never sentence/example matches or probabilities fitted to a reference set. */
export function contextualOrthography(text: string, original: string, morphology?: MorphologyEngine, onProof?: (wordIndex:number,selected:string)=>void): string {
  const originalWords = original.toLocaleLowerCase('az-AZ').match(/\p{L}+/gu) ?? [];
  const explicitlySpelled = (pattern: RegExp) => originalWords.some(value => pattern.test(value));
  let wordIndex=0;
  let previousWord: { word: string; end: number } | undefined;
  return text.replace(/(?<![\p{L}\p{N}_])\p{L}+(?![\p{L}\p{N}_])/gu, (word, at: number) => {
    const ordinal=wordIndex++;
    const resolvedPrior = previousWord && /^\s+$/u.test(text.slice(previousWord.end, at)) ? previousWord.word : undefined;
    previousWord = { word, end: at+word.length };
    if (word.length > 1 && word === word.toLocaleUpperCase('az-AZ')) return word;
    const lower = word.toLocaleLowerCase('az-AZ'), key = foldLetters(lower);
    const left = foldLetters(text.slice(Math.max(0, at-150), at).split(/[.!?;\n\uE000\uE001]/u).at(-1) ?? '');
    const right = foldLetters(text.slice(at+word.length, at+word.length+120).split(/[.!?;\n\uE000\uE001]/u)[0]);
    let target: string | undefined;
    if (/^suret/u.test(lower)) {
      const endings: Record<string, string> = { '': '', i: 'i', in: 'in', ini: 'ini', inin: 'inin', e: 'ə', ə: 'ə',
        de: 'də', də: 'də', den: 'dən', dən: 'dən', inde: 'ində', ində: 'ində', inden: 'indən', indən: 'indən',
        le: 'lə', lə: 'lə', ler: 'lər', lər: 'lər', leri: 'ləri', ləri: 'ləri' };
      const ending = Object.hasOwn(endings, lower.slice(5)) ? endings[lower.slice(5)] : undefined;
      const speed = /(?:yazi|oxu|hereket|yukleme|isleme|gedis|internetin|sebekenin)\s+$/u.test(left);
      const copy = /(?:sened|melumat|foto|nusxe|elave|zemanet|mektub|esli|reqemsal|qovluq|certyoj)/u.test(left+' '+right)
        && /(?:isten|gonder|saxla|teleb|veril|qaytar|cixar|gotur|teqdim|isled|ferq|esli|status|menbe|sorus|alin)/u.test(right);
      if (ending !== undefined && (speed || copy)) target = (speed ? 'sürət' : 'surət')+ending;
    }
    if (/^acar/u.test(lower) && /(?:izleme|sifre|esas|qovlugun|qapinin|menzilin|dolabin|kilidin|baglantinin|gizli|itmis)\s+$/u.test(left)) {
      const endings: Record<string, string> = { '': '', i: 'ı', ı: 'ı', in: 'ın', ın: 'ın', ini: 'ını', ını: 'ını',
        a: 'a', da: 'da', dan: 'dan', la: 'la', lar: 'lar', lari: 'ları', ları: 'ları' };
      const ending = Object.hasOwn(endings, lower.slice(4)) ? endings[lower.slice(4)] : undefined;
      if (ending !== undefined) target = 'açar'+ending;
    }
    if (key === 'isin' && /^\s+(?:evvelinde|sonunda|tekrari|menbeleri|neticəsi|gedisi|icrasi)(?=\s|$)/u.test(right)) target = 'işin';
    if (key === 'adi' && /(?:muellifin|mehsulun|fayl|qovlugun|qurgunun|senedin|kitabin|sahibinin)\s+$/u.test(left)
      && /^\s+(?:yaz|qeyd|icazesiz|qebzdeki|bosluqla|deyis|deqiq|ile|ilkin)(?=\p{L}|\s|$)/u.test(right)) target = 'adı';
    if (key === 'adi' && /\p{L}+(?:nin|nun)\s+$/u.test(left) && /^\s+(?:muayine\s+qeydine|qeyd\s+olunur|yazilir)/u.test(right)) target = 'adı';
    if (key === 'adinin' && /(?:muellif|mehsulun|faylin|qovlugun|qurgunun|senedin|kitabin)\s+$/u.test(left)
      && /^\s+(?:yazilis|deyis|qeyd)/u.test(right)) target = 'adının';
    if (/^qursaq/u.test(key) && /vaxt\s+$/u.test(left)) target = lower.replace(/^qursaq/u, 'qurşaq');
    if (key === 'kesden' && /(?:silin|oxun|cixar|basliq|obyekt|melumat)/u.test(right)) target = 'keşdən';
    if (key === 'kes' && /^\s+acar/u.test(right)) target = 'keş';
    if (/^acar/u.test(lower) && /kes\s+$/u.test(left)) target = 'açar'+lower.slice(4);
    if (key === 'el' && /^\s+(?:yazisi|isi|emeyi)(?=\s|\p{L}|$)/u.test(right)) target = 'əl';
    if (key === 'el' && /ikinci\s+$/u.test(left) && /^\s+\p{L}+/u.test(right)) target = 'əl';
    if (key === 'elde' && /^\s+(?:edil|olun)/u.test(right)) target = 'əldə';
    if (key === 'sira' && /^\s+ardicillig/u.test(right)) target = 'sıra';
    if (key === 'yas' && /^\s+(?:mehdudiyyet|hedd|qrup)/u.test(right)) target = 'yaş';
    if (key === 'seher' && !explicitlySpelled(/^(?:səhər|şəhər)$/u)) {
      if (/^\s+ve\s+axsam/u.test(right)
        || /(?:kitablar|senedler|mallar|sagirdler)\s+$/u.test(left) && /^\s+(?:sayilir|toplanir|yoxlanilir)/u.test(right)) target = 'səhər';
      else if (/^\s+(?:bagcasinda|parkinda|kucelerinde)(?=\s|$)/u.test(right)) target = 'şəhər';
    }
    if (/^deyis/u.test(lower) && /(?:saatinin|istiqametinin|unvanin|adinin|qiymetin|olcunun)\s+$/u.test(left)) target = lower.replace(/^deyis/u, 'dəyiş');
    if (key === 'deyer' && /(?:edilmis|olunmus|olculen|hesablanan)\s+$/u.test(left)) target = 'dəyər';
    if (/^serf/u.test(key) && /(?:su|enerji|yaddas|yanacaq)\s+$/u.test(left) && !explicitlySpelled(/^şərf/u)) {
      target = 'sərf'+lower.slice(4);
    }
    if (key === 'eser' && /(?:ozge|bedii|tamamlanmis|yarimciq)\s+$/u.test(left)) target = 'əsər';
    if (key === 'qarsi' && /^\s+(?:teref|iddia|numune)/u.test(right)) target = 'qarşı';
    if (/^sert/u.test(key) && !explicitlySpelled(/^şərt/u) && /^\s+(?:disk|baglanti|hedd|cisim|seth)/u.test(right)) target = 'sərt'+lower.slice(4);
    if (/^sert/u.test(key) && !explicitlySpelled(/^sərt/u) && /(?:muqavile|sigorta|odenis|zemanet)\p{L}*\s+$/u.test(left)) target = 'şərt'+lower.slice(4);
    if (/^sert(?:i|ler|leri)$/u.test(key) && /(?:bitme|legv|qaytarilma|qeyri-mueyyen)\s+$/u.test(left)) target = 'şərt'+lower.slice(4);
    if (key === 'qus' && /^\s+(?:yuvasi|yuvalari|sesi|sesleri|qanadi|qanadlari)(?=\s|$)/u.test(right)) target = 'quş';
    if (/^qasig/u.test(key) && /(?:taxta|metal|cay|yemek)\s+$/u.test(left)) {
      const ending = lower.slice(5);
      const endings: Record<string, string> = { in: 'ın', ın: 'ın', i: 'ı', ı: 'ı', ini: 'ını', ını: 'ını', inin: 'ının', ının: 'ının' };
      if (Object.hasOwn(endings, ending)) target = 'qaşığ'+endings[ending];
    }
    if (key === 'butun') target = 'bütün';
    if (key === 'isiq') target = 'işıq';
    if (key === 'olmus' && /daxil\s+$/u.test(left)) target = 'olmuş';
    if (key === 'ucun' && lower !== 'üçün') {
      // An earlier correction in this same pass is valid local POS evidence;
      // using the stale sureti snapshot here made uçun change only on pass two.
      const prior = resolvedPrior ?? text.slice(Math.max(0, at-50), at).match(/(\p{L}+)\s+$/u)?.[1];
      const nextWords = (text.slice(at+word.length).match(/\p{L}+/gu) ?? []).slice(0, 3);
      const nominal = prior && morphology?.analyzeWord(prior).some(row => row.pos === 'noun')
        && nextWords.some(value => morphology?.analyzeWord(value).some(row => row.pos === 'noun' || row.pos === 'adjective'));
      if (lower.includes('ü') || /\p{L}+(?:maq|mek)\s+$/u.test(left)
        || nominal && !/^\s+(?:ve|ya|azad|yuxari|uzaq|tez)(?=\s|$)/u.test(right)
          && /\p{L}+(?:[ıiuü]r|[ıiuü]l[ıiuü]r|mal[ıi]d[ıi]r)(?!\p{L})/u.test(text.slice(at+word.length))) target = 'üçün';
    }
    if (key === 'de' && /\p{L}+(?:sa|se)\s+$/u.test(left) && /^\s+\p{L}+\s+\p{L}+/u.test(right)) target = 'də';
    if (/^aciqlan/u.test(key) && /(?:meqsed|qayda|secim|sert|qiymet|menbe|vaxt|qerar|melumat|usul|mesele|meyar)\p{L}*\s+(?:(?:tapsiriqdan\s+evvel|evvelceden|ayrica|sonra|istirakcilara)\s+)?$/u.test(left)
      && !explicitlySpelled(/^acıqlan/u)) target = 'açıqlan'+lower.slice(7);
    if (key === 'aciq' && /(?:tarix|mebleg|muddet|qayda|esas|melumat|menbe|dovr|hesab|izah|ser t|sert)\p{L}*\s+$/u.test(left)
      && /^\s+(?:goster|yaz|saxla|bildir)/u.test(right)) target = 'açıq';
    if (key === 'aciq' && /^\s+(?:xeta|sessiya|sert|sorusulur)/u.test(right)) target = 'açıq';
    if (/^yazış[ıiuü]/u.test(lower) && /(?:ses|telim|film|video)\s+$/u.test(left)) target = lower.replace(/^yazış/u, 'yazıs');
    const result = target ? upperLike(word, target) : word;
    if(target)onProof?.(ordinal,result);
    previousWord.word = result;
    return result;
  });
}
