import { regularForms } from './morphology';
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
`.trim().split(/\s+/);

export function fold(text: string): string {
  return text.toLocaleLowerCase('az-AZ').replace(/[əçıöüşğ]/g, letter =>
    ({ ə: 'e', ç: 'c', ı: 'i', ö: 'o', ü: 'u', ş: 's', ğ: 'g' })[letter]!);
}

const candidates = new Map<string, Set<string>>();
for (const word of [...words, ...regularForms()]) {
  const key = fold(word);
  const bucket = candidates.get(key) ?? new Set<string>();
  bucket.add(word.toLocaleLowerCase('az-AZ'));
  candidates.set(key, bucket);
}
// Known spelling errors that are not simple ASCII transliterations.
const aliases: Record<string, string> = {
  qelirem: 'gəlirəm', qelir: 'gəlir', qelirsen: 'gəlirsən',
  duzewldim: 'düzəldim', duzeldim: 'düzəldim', komek: 'kömək',
  hemise: 'həmişə', zehmet: 'zəhmət', sehv: 'səhv',
  tesekkur: 'təşəkkür', tesekur: 'təşəkkür', teshekkur: 'təşəkkür',
  xais: 'xahiş', xahis: 'xahiş', xayis: 'xahiş',
  duzlet: 'düzəlt', duzeltmek: 'düzəltmək', duzeld: 'düzəlt',
  azerbaycan: 'Azərbaycan', azerbeycan: 'Azərbaycan',
  mellumat: 'məlumat', melmuat: 'məlumat', cumleni: 'cümləni',
};
const ambiguous = new Set(['et', 'el', 'un', 'uc', 'su', 'yag', 'gul', 'ali', 'sira']);
const properNames = new Map(['Azərbaycan', 'Bakı', 'Gəncə', 'Türkiyə', 'İstanbul',
  'Sənan', 'Xədicə', 'Nərmin', 'Aysel', 'Günel', 'Rəşad'].map(name => [fold(name), name]));

export function restoreWord(word: string): string {
  // Preserve camelCase identifiers and acronyms. Title case remains editable.
  if (word.length > 1 && word === word.toLocaleUpperCase('az-AZ')) return word;
  if (/[a-zəçğıöşü][A-ZƏÇĞIİÖŞÜ]/.test(word)) return word;
  const key = fold(word);
  if (ambiguous.has(key)) return word;
  const values = candidates.get(key);
  const replacement = aliases[key] ?? (values?.size === 1 ? [...values][0] : undefined);
  if (!replacement) return word;
  // Explicit diacritics are evidence: do not replace a correctly accented letter
  // with another candidate merely because both fold to the same ASCII spelling.
  if (!aliases[key] && [...word.toLocaleLowerCase('az-AZ')].some((letter, index) =>
    /[əçğıöşü]/.test(letter) && replacement[index] !== letter)) return word;
  if (properNames.has(key)) return properNames.get(key)!;
  return /^[A-ZƏÇĞIİÖŞÜ]/.test(word)
    ? replacement[0].toLocaleUpperCase('az-AZ') + replacement.slice(1) : replacement;
}
