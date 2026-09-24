// Reviewed business vocabulary. Amounts, deadlines and commercial commitments
// stay as written; spelling correction must not revise the offer itself.
export const businessWords = `
nümayəndəsi şirkətimizin xidmətlər bölməsi adından salamlayırıq göndərdiyiniz
sistemlərimizdə alındı ekspertlərimiz tərəfindən qaldırdığınız şirkətinizin
prosesində məktubda tələblərə hazırladığımız planını çatdırırıq məqsədimiz
proseslərinizi optimallaşdırmaq hədəfləriniz yaratmaqdır üzə məqamları
ehtiyaclarını nəzərdən keçirmək ekspertlərimizin keçirdiyi göstəricilərə
vermədiyi yüklənmələr ləngimələrin yarandığı edilmişdir növ gecikmələr
təcrübəsinə proseslərinin sürətinə arxitekturası bazalarınızın emalı
performansında ediləcəkdir artdığı mexanizmləri düşəcəkdir saatlarında
kəsinti yaşamadan etdirə biləcəksiniz mərhələsində yetirəcəyimiz sistemlər
protokolları üzərindən qovşaqları hazırlanacaqdır axını sistemdəki
köçürüləcəkdir fəaliyyətinə yaratmayacaqdır sinxronlaşdırılması keçiriləcək
mərhələdən skriptləri dəqiqlik yoxlanılacaqdır olunduğu modulların
olacaqdır sistemlərin inteqrasiyası verəcəkdir konfidensiallıq
münasibətlərimizdə postulatdır alqoritmlərindən olunacaqdır kibertəhlükələrə
qarşı testləri keçiriləcəkdir icazələrin əsaslanan nəzarəti daxilində
şəxslərin girişinin alacaqdır çərçivədə doğrulama ünvanlarına əməliyyatları
qeydləri arxivləşdiriləcək qarşısına aktivləşdiriləcəkdir ehtiyatlandırma
məkanlarda yerləşən mərkəzlərində saxlanılacaqdır kəsintisi baş təqdirdə
serverlərə xidmətlərin dayanmasının itkilərinin almağa nüsxələrin fəlakətdən
hazırlanaraq heyətinizə səviyyəsi sərhədlərinin sualınıza bildirmək şirkətimiz
qarşılaşa biləcəyiniz zəmanəti xəttimiz xidmətinizdə müraciətlərə müddəti
müraciətinizin izləyə kökünü araşdırıb qısa qaldırmaq addımları layihənizə
paketlərinin lisenziyalaşdırılması əməkdaşlarınızın mərhələsi planımıza
lisenziyaları səviyyələrində paylanacaqdır sistemdən olunmasını personalınız
sessiyaları proqramını bitirən testindən keçərək sertifikatlandırılacaqlar
kitabçaları müddətini endirəcək faydalanmasına yaradacaqdır ehtiyaclarına
imkanların təklifimiz çərçivəsində mümkündür məntiqinizə uyğunlaşdırılacaq
hesabatlılıq modulları panelləri analitiklərimiz işləyərək tələblər mühitində
yoxlanılacaq təsdiqinizdən etdirilməsi qrafikinə şərtləri təklifini hazırlamışıq
xərcləri əsasda keçirilə seçildiyi məbləğə güzəştlər böyüdükcə sayı artdıqca
planınızı tənzimləyə resursları artıra sənədləşməsi ödənişlərdə prinsipləri
götürülmüşdür ibarətdir mərhələdə hazırlığı köçürüləcək yekunlaşdırılacaq
aparılacaq personalın təlimləri tutacaqdır müddətinin xəritəyə tamamlanması
planlaşdırılır şəxslər yenilənmiş rejimində hesabatların alınması panellərin
yaradılması panellər göstəricilərini anlıq xülasədən göndəriləcəkdir qəbulu
sürətləndirəcək qabiliyyətini artıracaqdır formasında əks idarəetməni
edəcəkdir həllərin verəcəyinə edəcəyinə məktubda məsələlərlə suallarınız
bizimlə saxlamağınızı sizinlə etməkdən dəstəyimiz yanınızdadır diqqətiniz
etibarınız əlaqələri komandası kəsintisiz kəsintisizliyi
yenilənməsi sistemlərinə mühiti
`.trim().split(/\s+/);

export const businessAliases: Record<string, string> = {
  muafiq: 'müvafiq', bizm: 'bizim', terfdas: 'tərəfdaş',
  buyuk: 'böyük', mennunluq: 'məmnunluq', texnki: 'texniki',
  gelecekdki: 'gələcəkdəki', tekliflerimizi: 'təkliflərimizi',
  altyapinizin: 'infrastrukturunuzun', altyapisi: 'infrastrukturu',
  altyapinin: 'infrastrukturun', sayesinde: 'sayəsində',
  infrastrukturdaki: 'infrastrukturdakı', faliyyetinizi: 'fəaliyyətinizi',
  faliyyetinin: 'fəaliyyətinin', faliyyet: 'fəaliyyət',
  oturulmesidir: 'ötürülməsidir', maneclik: 'maneə', mefhi: 'məxfi',
  kisitlamalar: 'məhdudiyyətlər', melumatlariniz: 'məlumatlarınız',
  edilmesil: 'edilməsi ilə', doqsan: 'doxsan', suresi: 'müddəti',
  mutesessislerimiz: 'mütəxəssislərimiz', emeliytlarin: 'əməliyyatların',
  mutesessislerinizle: 'mütəxəssislərinizlə', formasdiracaqlar: 'formalaşdıracaqlar',
  sineq: 'sınaq', integrasiya: 'inteqrasiya', hacmi: 'həcmi',
  altiinci: 'altıncı', bazardaki: 'bazardakı',
  deqiqliq: 'dəqiqlik', faleketden: 'fəlakətdən',
  lisenziyalandirilmasi: 'lisenziyalaşdırılması', hesabatliq: 'hesabatlılıq',
  hormetli: 'hörmətli', musteri: 'müştəri', numayendesi: 'nümayəndəsi',
  terefdasimiz: 'tərəfdaşımız', istifadeci: 'istifadəçi', xidmet: 'xidmət',
  sorgunuz: 'sorğunuz', muracietiniz: 'müraciətiniz', telebiniz: 'tələbiniz',
  qebul: 'qəbul', qeydiyyata: 'qeydiyyata', arasdirilir: 'araşdırılır',
  tezlikle: 'tezliklə', cavablandirilacaq: 'cavablandırılacaq',
  zehmet: 'zəhmət', tesekkur: 'təşəkkür', elaqe: 'əlaqə',
  aidiyyati: 'aidiyyəti', meyarlarinin: 'meyarlarının', gunudur: 'günüdür',
};

export function businessPhrases(text: string): string {
  return text
    .replace(/(^|[^\p{L}])daha verimli(?=$|[^\p{L}])/giu, '$1daha səmərəli')
    .replace(/(^|[^\p{L}])tespit edilmişdir(?=$|[^\p{L}])/giu, '$1müəyyən edilmişdir')
    .replace(/(^|[^\p{L}])böyük artış(?=$|[^\p{L}])/giu, '$1böyük artım')
    .replace(/(^|[^\p{L}])mexanizmləri ise düşəcəkdir(?=$|[^\p{L}])/giu, '$1mexanizmləri işə düşəcəkdir')
    .replace(/(^|[^\p{L}])gecikmələr ise(?=$|[^\p{L}])/giu, '$1gecikmələr isə')
    .replace(/(^|[^\p{L}])mərhələdə ise(?=$|[^\p{L}])/giu, '$1mərhələdə isə')
    .replace(/(^|[^\p{L}])pique saatlarında(?=$|[^\p{L}])/giu, '$1pik saatlarında')
    .replace(/(^|[^\p{L}])rest və grpc protokolları(?=$|[^\p{L}])/giu, '$1REST və gRPC protokolları')
    .replace(/(^|[^\p{L}])(biri|meneceri|mərhələsi|rəhbərlər) de(?=$|[^\p{L}])/giu, '$1$2 də')
    .replace(/(^|[^\p{L}])giriş çıxış(?=$|[^\p{L}])/giu, '$1giriş-çıxış')
    .replace(/(məlumat itkisinin tamamilə) qarşısına almaq/giu, '$1 qarşısını almaq')
    .replace(/(^|[^\p{L}])hesab fakturalar(?=$|[^\p{L}])/giu, '$1hesab-fakturalar')
    .replace(/(^|[^\p{L}])e poçt(?=$|[^\p{L}])/giu, '$1e-poçt')
    .replace(/(^|[^\p{L}])qat qat(?=$|[^\p{L}])/giu, '$1qat-qat')
    .replace(/(^|[^\p{L}])daha simplified(?=$|[^\p{L}])/giu, '$1daha sadə')
    .replace(/(^|[^\p{L}])məhdudiyyətlər da(?=$|[^\p{L}])/giu, '$1məhdudiyyətlər də')
    .replace(/(^|[^\p{L}])video rəhbərlər(?=$|[^\p{L}])/giu, '$1video təlimatlar')
    .replace(/(^|[^\p{L}])video təlimatlar de(?=$|[^\p{L}])/giu, '$1video təlimatlar da')
    .replace(/(^|[^\p{L}])video təlimatlar də(?=$|[^\p{L}])/giu, '$1video təlimatlar da')
    .replace(/(^|[^\p{L}])proqram təminatı inkişaf etdirilməsi/giu, '$1proqram təminatının inkişaf etdirilməsi')
    .replace(/(^|[^\p{L}])sizin tərəfdən(?=$|[^\p{L}])/giu, '$1sizin tərəfinizdən');
}

const predicates = [
  'salamlayırıq', 'edildi', 'edir', 'duyuruq', 'çatdırırıq', 'istəyirik',
  'edilmişdir', 'göstərir', 'ediləcəkdir', 'düşəcəkdir', 'ötürülməsidir',
  'hazırlanacaqdır', 'yaratmayacaqdır', 'yoxlanılacaqdır', 'olacaqdır', 'postulatdır',
  'olunacaqdır', 'keçiriləcəkdir', 'alacaqdır', 'bilər', 'aktivləşdiriləcəkdir',
  'saxlanılacaqdır', 'verir', 'biləcəksiniz', 'atacaqlar', 'paylanacaqdır',
  'sertifikatlandırılacaqlar', 'mümkündür', 'formalaşdıracaqlar', 'hazırlamışıq',
  'daxildir', 'bilərsiniz', 'ibarətdir', 'keçiriləcək', 'köçürüləcək',
  'yekunlaşdırılacaq', 'aparılacaq', 'tamamlanacaq', 'tutacaqdır', 'planlaşdırılır',
  'göndəriləcəkdir', 'artıracaqdır', 'eminik', 'edirik', 'yanınızdadır',
].join('|');
const starters = [
  'göndərdiyiniz', 'texnoloji', 'şirkətinizin', 'bu məktubda', 'məqsədimiz',
  'ekspertlərimizin', 'bu növ', 'təklif etdiyimiz', 'infrastrukturdakı', 'beləliklə',
  'bunun üçün', 'avtomatlaşdırılmış', 'məlumatların', 'mikroservis', 'sistemlərin',
  'məxfi', 'statik', 'habelə', 'bu isə', 'bu çərçivədə', 'bütün giriş-çıxış',
  'geo ehtiyatlandırma', 'hər hansı', 'bu mexanizm', 'ehtiyat nüsxələrin',
  'fəlakətdən', 'qarşılaşa biləcəyiniz', 'kritik', 'müraciətinizin',
  'mütəxəssislərimiz', 'əməliyyatların', 'istifadəçi lisenziyaları', 'sistemdən',
  'təlim proqramını', 'bu addımlar', 'daxili biznes', 'biznes analitiklərimiz',
  'müvafiq funksiyalar', 'xüsusi proqram', 'təklif olunan', 'ödənişlər',
  'illik abunə', 'gələcəkdə şirkətinizin', 'maliyyə sənədləşməsi', 'ödənişlərdə',
  'birinci mərhələdə', 'ikinci mərhələdə', 'üçüncü mərhələdə', 'dördüncü mərhələdə',
  'beşinci mərhələdə', 'altıncı mərhələdə', 'ümumi keçid', 'keçid zamanı',
  'bu panellər', 'avtomatik hesabatlılıq', 'bu imkan', 'məktubda',
  'rəqəmsal transformasiya', 'korporativ dəstəyimiz', 'diqqətiniz', 'hörmətlə',
].join('|');
const boundary = new RegExp(`(^|[^\\p{L}])(${predicates}) +(?=(?:${starters})(?:\\s|$))`, 'giu');

export function punctuateBusiness(text: string): string {
  return text.replace(boundary, '$1$2. ')
    .replace(/(yoxlanılıb) +(?=icraya\s)/giu, '$1, ')
    .replace(/(bizə göndərə bilərsiniz)\.(?=$)/giu, '$1?')
    .replace(/(bizə göndərə bilərsiniz)(?=$)/giu, '$1?')
    .replace(/(həm onlayn) +həm də/giu, '$1, həm də')
    .replace(/(həm lisenziya xərcləri) +həm texniki dəstək +həm də/giu, '$1, həm texniki dəstək, həm də')
    .replace(/(iyirmi dörd saat) +yeddi gün/giu, '$1, yeddi gün');
}

export function businessLayout(text: string): string {
  return text
    .replace(/^(hörmətli müştəri nümayəndəsi) +(?=şirkətimizin\s)/iu, '$1,\n\n')
    .replace(/^(hörmətli tərəfdaşımız) +(?=şirkətimizin\s)/iu, '$1,\n\n')
    .replace(/(təşəkkür edirik)[.!?]? +hörmətlə +(?=korporativ\s)/giu, '$1.\n\nHörmətlə,\n');
}

/** Convert only an explicitly counted, complete ordered set of project stages. */
export function businessStageLists(text: string): string {
  const ordinals = ['birinci', 'ikinci', 'üçüncü', 'dördüncü', 'beşinci', 'altıncı'];
  const counts = ['iki', 'üç', 'dörd', 'beş', 'altı'];
  return text.split('\n').map(line => {
    const stages = [...line.matchAll(/(?:^|\s)(birinci|[iİ]kinci|üçüncü|dördüncü|beşinci|altıncı) mərhələdə +/giu)];
    if (stages.length < 2 || !stages.every((m, i) => m[1].toLocaleLowerCase('az') === ordinals[i])) return line;
    const prefix = line.slice(0, stages[0].index).trim();
    if (!prefix.toLocaleLowerCase('az').endsWith(`${counts[stages.length - 2]} əsas mərhələdən ibarətdir.`)) return line;
    const items = stages.map((m, i) => line.slice(m.index! + m[0].length, stages[i + 1]?.index).trim().replace(/^[iİ]sə +/u, ''));
    if (items.some(item => !/\p{L}/u.test(item))) return line;
    // Keep the closing schedule/ownership sentences outside the final list item.
    const last = items.at(-1)!;
    const end = last.search(/[.!?] +/u);
    const suffix = end < 0 ? '' : last.slice(end + 1).trim();
    if (end >= 0) items[items.length - 1] = last.slice(0, end + 1);
    const list = items.map((item, i) => `${i + 1}. ${item[0].toLocaleUpperCase('az')}${item.slice(1)}`).join('\n');
    return prefix.replace(/\.$/, ':') + '\n' + list + (suffix ? '\n\n' + suffix : '');
  }).join('\n');
}
