import assert from 'node:assert/strict';
import test from 'node:test';
import { correctText, formatEmail } from '../lib/editor/correct';

/**
 * Hand-authored 2026-09-28 audit corpus.
 * These cases are intentionally separate from repository fixtures and previous
 * generated corpora. Exact output is required: semantic-anchor-only validation
 * is not sufficient for an editor.
 */
const textCases = [
  ['qeydiyyat kartindaki unvan melumati sehv yazilib', 'Qeydiyyat kartındakı ünvan məlumatı səhv yazılıb.'],
  ['operator mektubun elavelerini yoxlayib qeydiyyati tamamlayir', 'Operator məktubun əlavələrini yoxlayıb qeydiyyatı tamamlayır.'],
  ['qebul olunan senede ilkin status teyin edildi', 'Qəbul olunan sənədə ilkin status təyin edildi.'],
  ['qeydiyyat nomresinin prefiksi filial uzre ferqlenir', 'Qeydiyyat nömrəsinin prefiksi filial üzrə fərqlənir.'],
  ['tekrar sened askarlananda operatora bildiris gonderilir', 'Təkrar sənəd aşkarlananda operatora bildiriş göndərilir.'],
  ['huquqi sexsin voen melumati sorgudan qayidir', 'Hüquqi şəxsin VÖEN məlumatı sorğudan qayıdır.'],
  ['qebul tarixi ile senedin ustundeki tarix eyni deyil', 'Qəbul tarixi ilə sənədin üstündəki tarix eyni deyil.'],
  ['operator xidmet novunu duzgun secmeyib', 'Operator xidmət növünü düzgün seçməyib.'],
  ['sened daxil olanda qeydiyyat nomresi avtomatik yaradilir', 'Sənəd daxil olanda qeydiyyat nömrəsi avtomatik yaradılır.'],
  ['sened novu secilmeden muraciet yaradilmir', 'Sənəd növü seçilmədən müraciət yaradılmır.'],
  ['daxili mektub ile xarici mektub ferqli novlerdir', 'Daxili məktub ilə xarici məktub fərqli növlərdir.'],
  ['sened novunun adi siyahida iki defe gorunur', 'Sənəd növünün adı siyahıda iki dəfə görünür.'],
  ['qerar layihesi sened novlerine elave olunub', 'Qərar layihəsi sənəd növlərinə əlavə olunub.'],
  ['novun tercumesi azerbaycan dilinde natamamdir', 'Növün tərcüməsi Azərbaycan dilində natamamdır.'],
  ['her novun oz qeydiyyat saygaci olmalidir', 'Hər növün öz qeydiyyat sayğacı olmalıdır.'],
  ['vekaletname novunde etibar eden sexs ayrica secilir', 'Vəkalətnamə növündə etibar edən şəxs ayrıca seçilir.'],
  ['derkenarin ustundeki qeydler icraciya gorunmur', 'Dərkənarın üstündəki qeydlər icraçıya görünmür.'],
  ['derkenar icraya yonlendirilende bildiris dusmur', 'Dərkənar icraya yönləndiriləndə bildiriş düşmür.'],
  ['tesdiq novbesindeki derkenar geri cekildi', 'Təsdiq növbəsindəki dərkənar geri çəkildi.'],
  ['rehberin derkenara yazdigi qeyd saxlanmayib', 'Rəhbərin dərkənara yazdığı qeyd saxlanmayıb.'],
  ['icra muddeti baslayanda taymer ise dusmelidir', 'İcra müddəti başlayanda taymer işə düşməlidir.'],
  ['sened yonlendirilende evvelki icraci siyahidan cixarilir', 'Sənəd yönləndiriləndə əvvəlki icraçı siyahıdan çıxarılır.'],
  ['yanlis icraci teyin edilmis sened geri qaytarildi', 'Yanlış icraçı təyin edilmiş sənəd geri qaytarıldı.'],
  ['mesul sexsin imza icazesi muddetle mehdudlasir', 'Məsul şəxsin imza icazəsi müddətlə məhdudlaşır.'],
  ['mezuniyyetdeki iscinin selahiyyeti muveqqeti olaraq kecirilib', 'Məzuniyyətdəki işçinin səlahiyyəti müvəqqəti olaraq keçirilib.'],
  ['sorgunun cavabi qeydiyyat nomresi ile saxlanilir', 'Sorğunun cavabı qeydiyyat nömrəsi ilə saxlanılır.'],
  ['senedlerin sureti elektron arxivde saxlanilir', 'Sənədlərin surəti elektron arxivdə saxlanılır.'],
  ['gelecek senedler avtomatik arxive kecirilmemelidir', 'Gələcək sənədlər avtomatik arxivə keçirilməməlidir.'],
  ['terefdaslar gelecek layiheleri birlikde muzakire etdiler', 'Tərəfdaşlar gələcək layihələri birlikdə müzakirə etdilər.'],
  ['sekide qedim kuceler qorunub saxlanilir', 'Şəkidə qədim küçələr qorunub saxlanılır.'],
  ['kohne fotosekillere baxib xatireleri yada saldiq', 'Köhnə fotoşəkillərə baxıb xatirələri yada saldıq.'],
  ['router bir nece cihazi sebekeye qosdu', 'Router bir neçə cihazı şəbəkəyə qoşdu.'],
  ['tedbirde bir nece xarici qonaq istirak etdi', 'Tədbirdə bir neçə xarici qonaq iştirak etdi.'],
  ['api sorgulari suretle cavablandirilir', 'API sorğuları sürətlə cavablandırılır.'],
  ['git tarixcesinde yeni commit gorunur', 'Git tarixçəsində yeni commit görünür.'],
  ['deploy merhelesi ugurla basa catdi', 'Deploy mərhələsi uğurla başa çatdı.'],
  ['sorgu muvafiq sobeye yonlendirildi', 'Sorğu müvafiq şöbəyə yönləndirildi.'],
  ['layihenin budcesi yeniden hesablandi', 'Layihənin büdcəsi yenidən hesablandı.'],
  ['idare heyeti layiheni tesdiqledi', 'İdarə heyəti layihəni təsdiqlədi.'],
  ['her sobe oz planini hazirladi', 'Hər şöbə öz planını hazırladı.'],
  ['srs senedinde bpmn diaqrami uat meyarlari ve api contract yenilenib', 'SRS sənədində BPMN diaqramı, UAT meyarları və API contract yenilənib.'],
  ['rsd de sened novu secilmeden muraciet gonderile bilmir', 'RSD-də sənəd növü seçilmədən müraciət göndərilə bilmir.'],
  ['rsd sisteminde qeydiyyat nomresi avtomatik yaranirmi', 'RSD sistemində qeydiyyat nömrəsi avtomatik yaranırmı?'],
  ['bir nece sened novu eyni workflow dan istifade edir', 'Bir neçə sənəd növü eyni workflow-dan istifadə edir.'],
  ['api loglarini yoxladim problem productionda gorunur stagingde ise yoxdur', 'API loglarını yoxladım. Problem production-da görünür, staging-də isə yoxdur.'],
  ['GET /api/v1/documents endpointi productionda 500 qaytarir amma stagingde isleyir', 'GET /api/v1/documents endpoint-i production-da 500 qaytarır, amma staging-də işləyir.'],
  ['jira taski confluence sehifesi ile elaqelendirilib', 'Jira taskı Confluence səhifəsi ilə əlaqələndirilib.'],
  ['bu endpoint productionda aktivdirmi', 'Bu endpoint production-da aktivdirmi?'],
  ['jira taski yaradilibmi', 'Jira taskı yaradılıbmı?'],
  ['bilmirik workflow niye dayanib', 'Bilmirik workflow niyə dayanıb.'],
  ['eger sened qaytarilsa icraci sebebi gormelidir', 'Əgər sənəd qaytarılsa, icraçı səbəbi görməlidir.'],
  ['vaxtin olsa rsd loglarini da yoxla', 'Vaxtın olsa, RSD loglarını da yoxla.'],
  ['mence bu qayda yeniden yoxlanilmalidir', 'Məncə, bu qayda yenidən yoxlanılmalıdır.'],
  ['deyesen workflow yeniden dayanib', 'Deyəsən, workflow yenidən dayanıb.'],
  ['buna baxmayaraq sened icraya gonderildi', 'Buna baxmayaraq, sənəd icraya göndərildi.'],
  ['hesabat hazirdir ele deyil', 'Hesabat hazırdır, elə deyil?'],
  ['sen bu senedi ne vaxt gondereceksen', 'Sən bu sənədi nə vaxt göndərəcəksən?'],
  ['nece de rahat interfeysdir', 'Necə də rahat interfeysdir!'],
  ['ehsen problem hell olundu', 'Əhsən, problem həll olundu!'],
  ['diqqet productionda kritik xeta var', 'Diqqət! Production-da kritik xəta var.'],
  ['server dayandi Elvin problemi arasdirdi', 'Server dayandı. Elvin problemi araşdırdı.'],
  ['iclas bitdi Leyla senedleri topladi', 'İclas bitdi. Leyla sənədləri topladı.'],
  ['sistem stabildir api cavablari normaldir musteri ise yeni muqavile gonderdi', 'Sistem stabildir. API cavabları normaldır. Müştəri isə yeni müqavilə göndərdi.'],
  ['bu gun sema buludludur', 'Bu gün səma buludludur.'],
  ['bagda fidan ekdik', 'Bağda fidan əkdik.'],
  ['bu mene ilham verdi', 'Bu mənə ilham verdi.'],
  ['müzakire sona catdi', 'Müzakirə sona çatdı.'],
  ['sadiq dost her zaman komek edir', 'Sadiq dost hər zaman kömək edir.'],
  ['gunes isigi yere enerji verir', 'Günəş işığı Yerə enerji verir.'],
  ['yer kuresi gunes etrafinda firlanir', 'Yer kürəsi Günəş ətrafında fırlanır.'],
] as const;

for (const [input, expected] of textCases) {
  test(`strict independent text: ${input}`, () => {
    const actual = correctText(input).text;
    assert.equal(actual, expected);
    assert.equal(correctText(actual).text, actual, 'must be idempotent');
  });
}

const mailCases = [
  [
    'movzu rsd status problemi hormetli rsd komandasi muraciet tesdiqlenib amma status icrada qalib xahis edirem is axinini yoxlayin hormetle sanan nabizada biznes analitik',
    'Mövzu: RSD status problemi\n\nHörmətli RSD komandası,\n\nMüraciət təsdiqlənib, amma status icrada qalıb. Xahiş edirəm, iş axınını yoxlayın.\n\nHörmətlə,\nSanan Nabizada\nBiznes analitik',
  ],
  [
    'movzu api xetasi hormetli backend komandasi productionda POST /api/documents 500 qaytarir stagingde ise eyni request isleyir loglari yoxlayin hormetle elvin memmedov backend engineer',
    'Mövzu: API xətası\n\nHörmətli backend komandası,\n\nProduction-da POST /api/documents 500 qaytarır. Staging-də isə eyni request işləyir. Logları yoxlayın.\n\nHörmətlə,\nElvin Məmmədov\nBackend Engineer',
  ],
  [
    'movzu srs yenilenmesi hormetli layihe komandasi srs senedi yenilenib bpmn diaqraminda yeni tesdiq merhelesi elave olunub uat meyarlarini sabah yoxlayin hormetle aysel memmedova biznes analitik',
    'Mövzu: SRS yenilənməsi\n\nHörmətli layihə komandası,\n\nSRS sənədi yenilənib. BPMN diaqramında yeni təsdiq mərhələsi əlavə olunub. UAT meyarlarını sabah yoxlayın.\n\nHörmətlə,\nAysel Məmmədova\nBiznes analitik',
  ],
  [
    'hormetli texniki komanda bu gun productionda bir nece 500 xetasi gorduk sebebi hele melum deyil loglari toplayib ayrica gondereceyik hormetle sanan',
    'Mövzu: Müraciət\n\nHörmətli texniki komanda,\n\nBu gün production-da bir neçə 500 xətası gördük. Səbəbi hələ məlum deyil. Logları toplayıb ayrıca göndərəcəyik.\n\nHörmətlə,\nSanan',
  ],
  [
    'movzu derkenar hormetli Nermin xanim derkenar imzalanib amma icra statusu deyismeyib zehmet olmasa yoxlayin hormetle sanan',
    'Mövzu: Dərkənar\n\nHörmətli Nərmin xanım,\n\nDərkənar imzalanıb, amma icra statusu dəyişməyib. Zəhmət olmasa, yoxlayın.\n\nHörmətlə,\nSanan',
  ],
  [
    'movzu qeydiyyat hormetli operatorlar qeydiyyat nomresi yaranir amma sened kartinda gorunmur problemi arasdirin hormetle layihə komandasi',
    'Mövzu: Qeydiyyat\n\nHörmətli operatorlar,\n\nQeydiyyat nömrəsi yaranır, amma sənəd kartında görünmür. Problemi araşdırın.\n\nHörmətlə,\nLayihə komandası',
  ],
  [
    'movzu melumat hormetli musteri sorğunuz qebul olunub netice hazir olan kimi size melumat vereceyik hormetle destek komandasi',
    'Mövzu: Məlumat\n\nHörmətli müştəri,\n\nSorğunuz qəbul olunub. Nəticə hazır olan kimi sizə məlumat verəcəyik.\n\nHörmətlə,\nDəstək komandası',
  ],
  [
    'movzu access hormetli tehlukesizlik qrupu istifadeci yeni rolu alib amma rsd de senedleri gore bilmir icaze matrisini yoxlayin hormetle elvin',
    'Mövzu: Access\n\nHörmətli təhlükəsizlik qrupu,\n\nİstifadəçi yeni rolu alıb, amma RSD-də sənədləri görə bilmir. İcazə matrisini yoxlayın.\n\nHörmətlə,\nElvin',
  ],
] as const;

for (const [input, expected] of mailCases) {
  test(`strict independent mail: ${input.slice(0, 48)}`, () => {
    const actual = formatEmail(input).text;
    assert.equal(actual, expected);
    assert.equal(formatEmail(actual).text, actual, 'mail must be idempotent');
  });
}
