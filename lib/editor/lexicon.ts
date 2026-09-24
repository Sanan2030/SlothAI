import { regularForms } from './morphology';
import { narrativeWords } from './narrative';
import { extendedNarrativeWords, extendedAliases } from './extended-narrative';
import { expositoryWords, expositoryAliases } from './expository';
import { businessWords, businessAliases } from './business';
import { technicalWords, technicalAliases, technicalSpelling } from './technical';
import { dictionaryCandidates, foldLetters as fold, chooseSpelling } from './dictionary';
import type { SpellingContext } from './contracts/spelling';
// Curated forms, not a language model. Unknown/ambiguous words stay unchanged.
// Extend this list with reviewed Azerbaijani words; never blindly replace letters.
const words = `
mən sən mənim sənin bizim sizin özü özüm özün özünüz özümüz
mənə sənə bizə sizə məni səni bunu bunu belə elə nə necə niyə üçün
yaxşı yaxşıyam yaxşıdır yaxşısan pisəm pisdir necəsən necəsiniz
düşünmək düşünürəm düşünürsən düşünür düşünürük düşünürlər
gəlmək gəlirəm gəlirsən gəlir gəlirik gəlirlər gələcəm gələcəyəm gələcəyik
getmək gedirəm gedirsən gedir gedirik gedəcəyəm gedəcəyik
istəyirəm istəyirsən istəyir istəyirik istəyirsiniz istəyirlər
bilərəm bilərsən bilərik bilərsiniz edə bilər edək edəcək edəcəyəm edəcəyik
edirəm edirsən edir edirik edirsiniz edirlər etmişəm etmişik
olacağam olacaq olacağıq olmalıdır olmalı olmuşdur olmuşam
yazıram yazırsan yazır yazırıq yazın yazdım yazdığın yazdığınız
görmək görürəm görürsən görürük görünür görsənir görünəcək
baxır baxıram baxırıq baxın baxdı baxdıq baxdılar
eşitmək eşidirəm eşidir eşitdim danışmaq danışıram danışır danışın
kömək zəhmət zəhmətiniz olmasa təşəkkür təşəkkürlər xahiş
əlavə əlaqə əlaqədar uyğun müvafiq aidiyyəti üzrə haqqında barədə
əvvəl əvvəlcə əvvəlki sonra artıq hazır hazırdır hazırıq hazırda
səhər axşam gün günlər bugün bu gün bugünə sabah dünən həftə
görüş görüşə görüşdə görüşün görüşümüz görüşümüzü görüşümüzdə
iş işlər işləri işlərə işlərin işimiz işimizi işində işləyir işləyirik
mətn mətni mətnə mətndə mətnin mətnlər mətnləri mətninizi
səhv səhvlər səhvləri düzgün düzdür düzəliş düzəlişlər düzəlişləri
düzəlt düzəltmək düzəldək düzəldin düzəldim düzəldilmiş düzəldilir
qrammatika cümlə cümlələr cümlələri abzas durğu işarə işarələri
layihə layihəni layihəyə layihədə layihənin layihələr layihələri layihəmiz
məlumat məlumatı məlumatın məlumatlar məlumatları məlumatlarını məlumatlarıma
sənəd sənədi sənədin sənədlər sənədləri sənədlərin sənədlərdə
göndər göndərin göndərmək göndərirəm göndərdim göndərdik göndərildi göndərilmiş
göndərəcəyəm göndərəcəyik göndərilməsini göndərilməsi
məsələ məsələni məsələyə məsələlər məsələləri məsələlərin məsələdir
birinci ikinci üçüncü dördüncü beşinci altıncı yeddinci səkkizinci
əvvəla ikincisi üçüncüsü həm həmçinin ancaq çünki lakin bəlkə əgər
bəli xeyr əlbəttə hə həmişə heç heçnə hər hərəsi hamısı hamısını
çox azdır böyük kiçik gözəl çətin asan sürətli sürətlə sürət
qəbul qərar qərarı qərarlar qərarları nəticə nəticəni nəticələr nəticələri
sorğu sorğunu sorğuya sorğunun sorğular sorğuları sualı suallar sualları
müraciət müraciəti müraciətlər müraciətin müraciətiniz müraciətinizə
şirkət şirkəti şirkətin şirkətdə şirkətə şirkətlər şirkətlərdə
əmək əməkdaş əməkdaşlar əməkdaşları əməkdaşlarımız əməkdaşlarımızın
rəhbər rəhbəri rəhbərlik rəhbərliyə rəhbərliyin müdir müdiri
müştəri müştərilər müştərinin müştərilərə istifadə istifadəçi istifadəçilər
istifadəçinin istifadəçilərin istifadəçiyə istifadəçidən istifadəçilərə
proqram təminatı proqramın proqramı sistemin sistemdə sistemə
funksiya funksiyası funksiyanı funksionallıq funksionallığı funksionallığın
səlahiyyət səlahiyyəti səlahiyyətli səlahiyyətləri səhifə səhifəni səhifədə
xəta xətanı xətalar xətaları problemin problemi işləmə işləməsi
işləyəcək işləmir işləmədi düzgünləşdirmək yoxlama yoxlayın yoxlayırıq
planlaşdırmaq planlaşdıraq planlaşdırırıq dəqiq dəqiqləşdirmək dəqiqləşdirək
bölüşdürmək bölüşdürək bölüşdürün başlamaq başlayırıq başlayaq başlaya bilərik
vaxtı vaxtın vaxtınız vaxtınızın vaxtınızda tarixdə tarixi tarixə tarixini
ödəniş ödənişi ödənişlər ödənişləri məbləğ məbləği manat qiymət qiyməti
öyrənmək öyrənirəm öyrənirik məktəb məktəbdə məktəbə müəllim müəllimə
tələbə tələbələr tələbənin təhsil təcrübə təcrübəsi təcrübəli bilikləri
Azərbaycan azərbaycan Azərbaycanı Azərbaycana Azərbaycanda Azərbaycanın
Bakı Bakıya Bakıda Bakının Gəncə Gəncədə Türkiyə Türkiyədə İstanbul
Sənan Xədicə Əli Nərmin Aysel Günel Rəşad
hörmət hörmətlə hörmətli salamlar günaydın sağ sağol sağolun mövzu müraciət
sağlam sağlamlıq sağlamlığım özümü özünü özünüzü hiss edir hiss edirəm
dərkənar hazırlanması hazırlanmasını hazırlanıb aktivləşdirildikdə
göndərilməsi göndərilməsini qiymətləndirdi dəyərləndirdi qarşılaşdığınız
vəziyyət vəziyyəti vəziyyətin prosesdə axınında dəyişiklik dəyişikliyi
göstər göstərir göstərmək göstərilir açmaq açılır açın bağlayın
gəldim getdim etdim bitdi gözləyirəm gələndə gedəndə məndədir
harada haraya haradan niyə nədir kimdir kimsən nə vaxt üçünsə
işlədim işləyirəm işləyirsən işləyirsiniz işləyirlər işlədik
qayıdıram qayıtdım görüşərik görüşənədək danışarıq danışdıq
istədim istədik istədiyiniz istəyirdim istəyirdik
heçnə hərşey birşey zəhmətinizə diqqətinizə təşəkkürümü
hələ göndərilmədi sabahkı vaxtını dəqiqləşdirin hazırlayın hazırla
gündür işlədiyini yalnız soruşdum gətirirəm getdin görüşdük
manatdır Gəncəyə Gəncənin Bakını Bakıdan Türkiyəyə Türkiyənin
`.trim().split(/\s+/);

const candidates = new Map<string, Set<string>>();
for (const word of [...words, ...regularForms(), ...narrativeWords, ...extendedNarrativeWords, ...expositoryWords, ...businessWords, ...technicalWords]) {
  const key = fold(word);
  const bucket = candidates.get(key) ?? new Set<string>();
  bucket.add(word.toLocaleLowerCase('az-AZ'));
  candidates.set(key, bucket);
}
// Known spelling errors that are not simple ASCII transliterations.
const aliases: Record<string, string> = {
  ...extendedAliases,
  ...expositoryAliases,
  ...businessAliases,
  ...technicalAliases,
  qelirem: 'gəlirəm', qelir: 'gəlir', qelirsen: 'gəlirsən',
  duzewldim: 'düzəldim', duzeldim: 'düzəldim', komek: 'kömək',
  hemise: 'həmişə', zehmet: 'zəhmət', sehv: 'səhv',
  tesekkur: 'təşəkkür', tesekur: 'təşəkkür', teshekkur: 'təşəkkür',
  xais: 'xahiş', xahis: 'xahiş', xayis: 'xahiş',
  duzlet: 'düzəlt', duzeltmek: 'düzəltmək', duzeld: 'düzəlt',
  azerbaycan: 'Azərbaycan', azerbeycan: 'Azərbaycan',
  mellumat: 'məlumat', melmuat: 'məlumat', cumleni: 'cümləni',
  ubuuntu: 'Ubuntu', ubuntu: 'Ubuntu', fastpiai: 'FastAPI', fastapi: 'FastAPI',
  pydantic: 'Pydantic', linuxda: 'Linuxda', linux: 'Linux',
  pdf: 'PDF', cv: 'CV', json: 'JSON', llm: 'LLM', srs: 'SRS',
  nike: 'Nike', jordan: 'Jordan',
  hamsi: 'hamısı', hamsini: 'hamısını', tevil: 'təhvil',
  dushdu: 'düşdü', ashagi: 'aşağı', shey: 'şey', yaxshidir: 'yaxşıdır',
  shahmat: 'şahmat', gunortan: 'günorta', yataqa: 'yatağa',
  hemen: 'həmin', dedim: 'dedim', eledi: 'elədi', pointleri: 'pointləri',
  xyir: 'xeyir', hardasan: 'haradasan', birazdan: 'birazdan',
};
const ambiguous = new Set(['et', 'el', 'un', 'uc', 'su', 'yag', 'gul', 'ali', 'sira', 'suret']);
const properNames = new Map(['Azərbaycan', 'Bakı', 'Gəncə', 'Türkiyə', 'İstanbul',
  'Azərbaycanı', 'Azərbaycana', 'Azərbaycanda', 'Azərbaycanın',
  'Bakıya', 'Bakıda', 'Bakının', 'Bakını', 'Bakıdan',
  'Gəncəyə', 'Gəncədə', 'Gəncənin', 'Türkiyəyə', 'Türkiyədə', 'Türkiyənin',
  'Sənan', 'Xədicə', 'Nərmin', 'Aysel', 'Günel', 'Rəşad'].map(name => [fold(name), name]));


function uniqueDictionaryCandidate(word: string, services?: SpellingContext): string | undefined {
  const values = services
    ? new Set(services.lemmaDictionary.findByFoldedForm(word).entries.map(entry => entry.lemma))
    : dictionaryCandidates(word);
  return chooseSpelling(word, values);
}

function lastVowel(word: string): string | undefined {
  return word.toLocaleLowerCase('az-AZ').match(/[aıoueəiöü]/gu)?.at(-1);
}

function harmonyI(stem: string): string {
  const vowel = lastVowel(stem);
  if (vowel === 'a' || vowel === 'ı') return 'ı';
  if (vowel === 'o' || vowel === 'u') return 'u';
  if (vowel === 'ö' || vowel === 'ü') return 'ü';
  return 'i';
}

function harmonyA(stem: string): string {
  return /[eəiöü]/u.test(lastVowel(stem) ?? '') ? 'ə' : 'a';
}

type ProductiveSuffixRule = {
  raw: string;
  apply: (stem: string) => string | undefined;
};

const productiveSuffixRules: readonly ProductiveSuffixRule[] = [
  { raw: 'lerinizden', apply: stem => stem + 'lərinizdən' },
  { raw: 'larinizdan', apply: stem => stem + 'larınızdan' },
  { raw: 'lerimizin', apply: stem => stem + 'lərimizin' },
  { raw: 'larimizin', apply: stem => stem + 'larımızın' },
  { raw: 'lerinizin', apply: stem => stem + 'lərinizin' },
  { raw: 'larinizin', apply: stem => stem + 'larınızın' },
  { raw: 'lerinizi', apply: stem => stem + 'lərinizi' },
  { raw: 'larinizi', apply: stem => stem + 'larınızı' },
  { raw: 'lerimiz', apply: stem => stem + 'lərimiz' },
  { raw: 'larimiz', apply: stem => stem + 'larımız' },
  { raw: 'leriniz', apply: stem => stem + 'ləriniz' },
  { raw: 'lariniz', apply: stem => stem + 'larınız' },
  { raw: 'leri', apply: stem => stem + 'ləri' },
  { raw: 'lari', apply: stem => stem + 'ları' },
  { raw: 'deyem', apply: stem => stem + 'd' + harmonyA(stem) + 'y' + (harmonyA(stem) === 'ə' ? 'əm' : 'am') },
  { raw: 'dedir', apply: stem => stem + 'd' + harmonyA(stem) + 'dir' },
  { raw: 'dadir', apply: stem => stem + 'd' + harmonyA(stem) + 'dır' },
  { raw: 'den', apply: stem => stem + 'dən' },
  { raw: 'dan', apply: stem => stem + 'dan' },
  { raw: 'de', apply: stem => stem + 'də' },
  { raw: 'da', apply: stem => stem + 'da' },
  { raw: 'imi', apply: stem => /[aıoueəiöü]$/u.test(stem) ? undefined : stem + harmonyI(stem) + 'm' + harmonyI(stem) },
  { raw: 'nin', apply: stem => /[aıoueəiöü]$/u.test(stem) ? stem + 'n' + harmonyI(stem) + 'n' : undefined },
  { raw: 'in', apply: stem => /[aıoueəiöü]$/u.test(stem) ? undefined : stem + harmonyI(stem) + 'n' },
  { raw: 'ecek', apply: stem => harmonyA(stem) === 'ə' ? stem + 'əcək' : undefined },
  { raw: 'acaq', apply: stem => harmonyA(stem) === 'a' ? stem + 'acaq' : undefined },
  { raw: 'ecem', apply: stem => harmonyA(stem) === 'ə' ? stem + 'əcəyəm' : undefined },
  { raw: 'acam', apply: stem => harmonyA(stem) === 'a' ? stem + 'acağam' : undefined },
  { raw: 'eceyiniz', apply: stem => harmonyA(stem) === 'ə' ? stem + 'əcəyiniz' : undefined },
  { raw: 'acaginiz', apply: stem => harmonyA(stem) === 'a' ? stem + 'acağınız' : undefined },
  { raw: 'irem', apply: stem => stem + harmonyI(stem) + 'r' + (harmonyA(stem) === 'ə' ? 'əm' : 'am') },
  { raw: 'irsen', apply: stem => stem + harmonyI(stem) + 'rs' + (harmonyA(stem) === 'ə' ? 'ən' : 'an') },
  { raw: 'ir', apply: stem => stem + harmonyI(stem) + 'r' },
  { raw: 'dim', apply: stem => stem + 'd' + harmonyI(stem) + 'm' },
  { raw: 'din', apply: stem => stem + 'd' + harmonyI(stem) + 'n' },
  { raw: 'diq', apply: stem => stem + 'd' + harmonyI(stem) + 'q' },
];

function restoreProductiveSuffix(word: string, services?: SpellingContext): string | undefined {
  const lower = word.toLocaleLowerCase('az-AZ');
  if (!/^[a-zəçğıöşü]+$/u.test(lower) || lower.length < 5) return undefined;

  for (const rule of productiveSuffixRules) {
    if (!lower.endsWith(rule.raw) || lower.length <= rule.raw.length + 1) continue;
    const rawStem = lower.slice(0, -rule.raw.length);
    let stem = uniqueDictionaryCandidate(rawStem, services);

    // Azerbaijani k -> y before a vowel is productive in words such as
    // "kömək" -> "köməyin". Only use it when the underlying k-stem is a
    // uniquely recognized dictionary form.
    if (!stem && rawStem.endsWith('y')) {
      const underlying = uniqueDictionaryCandidate(rawStem.slice(0, -1) + 'k', services);
      if (underlying?.endsWith('k')) stem = underlying.slice(0, -1) + 'y';
    }
    if (!stem) continue;

    const result = rule.apply(stem);
    if (result) return result;
  }
  return undefined;
}

function restoreDigraphTransliteration(word: string, services?: SpellingContext): string | undefined {
  if (!/(?:sh|ch|gh)/i.test(word)) return undefined;
  const variant = word
    .replace(/sh/gi, match => match[0] === 'S' ? 'Ş' : 'ş')
    .replace(/ch/gi, match => match[0] === 'C' ? 'Ç' : 'ç')
    .replace(/gh/gi, match => match[0] === 'G' ? 'Ğ' : 'ğ');
  return uniqueDictionaryCandidate(variant, services) ?? restoreProductiveSuffix(variant, services);
}

export function restoreWord(word: string, services?: SpellingContext): string {
  const technical = technicalSpelling(word);
  if (technical !== undefined) return technical;
  // Preserve camelCase identifiers and acronyms. Title case remains editable.
  if (word.length > 1 && word === word.toLocaleUpperCase('az-AZ')) return word;
  if (/[a-zəçğıöşü][A-ZƏÇĞIİÖŞÜ]/.test(word)) return word;
  const key = fold(word);
  if (ambiguous.has(key)) return word;
  const values = candidates.get(key);
  const imported = word.length > 2 ? (services
    ? new Set(services.lemmaDictionary.findByFoldedForm(word).entries.map(entry => entry.lemma))
    : dictionaryCandidates(word)) : undefined;
  // Reviewed common-word choices keep their established behavior (necə, sən,
  // üçün). Imported candidates are conservative fallback, not frequency data.
  const alias = Object.hasOwn(aliases, key) ? aliases[key] : undefined;
  const morphologyCandidates = services?.morphology.analyzeWord(word).map(analysis => analysis.surface);
  const replacement = alias ?? properNames.get(key) ?? chooseSpelling(word, values) ?? chooseSpelling(word, imported)
    ?? chooseSpelling(word, new Set(morphologyCandidates))
    ?? restoreDigraphTransliteration(word, services)
    ?? restoreProductiveSuffix(word, services);
  if (!replacement) return word;
  // Explicit diacritics are evidence: do not replace a correctly accented letter
  // with another candidate merely because both fold to the same ASCII spelling.
  if (!alias && [...word.toLocaleLowerCase('az-AZ')].some((letter, index) =>
    /[əçğıöşü]/.test(letter) && replacement[index] !== letter)) return word;
  if (properNames.has(key)) return properNames.get(key)!;
  return /^[A-ZƏÇĞIİÖŞÜ]/.test(word)
    ? replacement[0].toLocaleUpperCase('az-AZ') + replacement.slice(1) : replacement;
}
