// Foreign technical vocabulary must not be interpreted as Azerbaijani homographs.
// Product/acronym spelling is normalized only for explicitly reviewed names.
const terms: Record<string, string> = {
  kubernetes: 'Kubernetes', postgresql: 'PostgreSQL', redis: 'Redis',
  rabbitmq: 'RabbitMQ', kafka: 'Kafka', prometheus: 'Prometheus', grafana: 'Grafana',
  grpc: 'gRPC', rest: 'REST', tls: 'TLS', ssl: 'SSL', rbac: 'RBAC', oauth: 'OAuth',
};
const foreign = new Set(`agile scrum sprint backlog demo transactional responsive
dynamic hashing unit zero downtime deployment retry roll-back framework startup
database backend frontend deploy commit open data veri beta server optimum`.split(/\s+/));

export function technicalSpelling(word: string): string | undefined {
  const lower = word.toLowerCase();
  return Object.hasOwn(terms, lower) ? terms[lower] : (foreign.has(lower) ? word : undefined);
}

export const technicalWords = `
tərəfdaşımız həllər şərtnaməsi tələbləri keçirilmişdir olunmuş hədəflər
memarlığını təcrübəsini səviyyəyə işlərinə başlanılmışdır mərhələləri
rəqabətqabiliyyətli çıxarmaqdır proseslərinizin avtomatlaşdırılması fəaliyyətinizin
köçürülməsi resurslarımız metodologiyalarına əsaslanaraq ediləcək sprintlər
şəklində bölünmüşdür həftəlik layihədəki ehtiyaclarınıza tənzimləmələr aparılacaqdır
siyahısındakı tapşırıqlar sırasına düzülmüşdür komandamız növbədə funksiyalarını
tamamlamağa ayıracaqdır biləcəyik platformanın konsepsiyasına layihələndirilmişdir
digərindən mürəkkəbləşmədən genişlənməsinə idarəetməsi servisləri konteynerlərdə
göstərəcəkdir konteynerlərin orkestrasiyası yüklənməyə ölçəklənməsini vaxtlarında
sürəti səviyyədə servislərin gecikmələrini endirəcəkdir bazasının dəstəkləmək
hissələrə sistemlərinin əsasında qurulmuşdur əməliyyatlar sistemindən
əməliyyatlarını yükünü keşləmə düzgündür sahələrin altına alınır sorğularının
optimallaşdırılması indeksləmə strategiyaları yazının olduğu cədvəllərdə sürətini
millisaniyələrə dizaynı sistemlərarası standartlarından sistemlərlə mübadiləsi
əməliyyatların növbələri texnologiyası tapşırıqları faylların yüklənməsi
göndərişləri donmasının xidmətlərinin yaradılacaq jurnalları arxivləşdiriləcəkdir
bölməsində dizaynerlərimiz rahatlığını götürmüşdür fərqindən keyfiyyətdə sürətdə
komponentlər davranışlarının xəritələri axtardığı tapmasına filtrləmə imkanı
konfidensiallığı dayaqlarından şifrələnərək bazasında şifrələr mənfəət
qorunacaqdır sınaqları qaldırılacaqdır yetkiləri imkanını sıfıra hesablarının
xətləri dövrünə serverinə yüklənməzdən xətaların mühitə düşməsinin versiyaların
serverə buraxılması üsullarından dəyişdirilməsi versiyanın kopiyası saxlanılacaq
anında sistemlərdən miqrasiyası skriptlər prosesindən təmizlənməsi
strukturlaşdırılması çıxarılacaqdır mühitdə aktivliyinin kəsiyində
əməliyyatlarına miqrasiyanı tutulmuşdur heyətinə təminatından qaydaları
inzibatçılar təlimatları dərsliklər sənədləşdirilmiş cavablandırılacaqdır
amilindən fikirlərini yaradılacaqdır tamamlandıqdan dəstəyi əsası etdiriləcəkdir
vasitələri serverlərin izləniləcəkdir göstəricilər artdıqda heyətə göndərəcəkdir
problemləri şirkətiniz suallarınızı cavablandırmağa biləcək etməyə şərtnaməsinə
hazırlanmışdır versiyasının həftə istifadəyə verilməsi tamamlanacaqdır
əməkdaşlığa inanırıq qatacağına təklifləriniz xidmətinizdədir
həlləri testlər testlərdən tamamlanmasına standartları başlayacaq növbələr
`.trim().split(/\s+/);

export const technicalAliases: Record<string, string> = {
  muvite: 'mühitə', gidisatini: 'gedişatını', qiymatlendirmeye: 'qiymətləndirməyə',
  pikey: 'pik', hacmini: 'həcmini', hacmli: 'həcmli', relasiyali: 'relyasiyalı',
  releysnl: 'relational', edileceqdir: 'ediləcəkdir', getirilecekdir: 'gətiriləcəkdir',
  omemli: 'önəmli', oturulecekdir: 'ötürüləcəkdir',
  kecirileceyidir: 'keçiriləcəkdir', adii: 'adi', yirmi: 'iyirmi',
  taklifleriniz: 'təklifləriniz', sorqu: 'sorğu',
  hefde: 'həftə', hefdelik: 'həftəlik', menfeat: 'mənfəət',
  sinaglari: 'sınaqları', kopyasi: 'kopiyası', integrasiyasi: 'inteqrasiyası',
  uzmanlarimiz: 'mütəxəssislərimiz', muesse: 'müəssisə',
  tehsillendirme: 'təlimləndirmə',
  ofise: 'ofisə', backlogdaki: 'backlogdakı', taskin: 'taskın',
  yukleyirler: 'yükləyirlər', backendde: 'backenddə', responseun: 'response-un',
  arasdirdiq: 'araşdırdıq', sorgusunda: 'sorğusunda', etdikden: 'etdikdən',
  isledi: 'işlədi', elinin: 'Əlinin', gonderdiyi: 'göndərdiyi',
  requesti: 'request-i', yazisi: 'yazısı', zeyif: 'zəif', catandan: 'çatandan',
  duzelisi: 'düzəlişi', stagingde: 'stagingdə', planimdir: 'planımdır', planim: 'planım',
  gorduk: 'gördük', saxlayirlar: 'saxlayırlar', serverlerde: 'serverlərdə',
  edilmelidir: 'edilməlidir',
  optimallasdirilir: 'optimallaşdırılır', avtomatlasdirir: 'avtomatlaşdırır',
};

// Called only after code/URLs have been replaced with protected placeholders.
export function prepareTechnicalPhrases(text: string): string {
  return text
    .replace(/(^|[^\p{L}\p{N}_])open api(?=$|[^\p{L}\p{N}_])/giu, '$1OpenAPI')
    .replace(/(^|[^\p{L}\p{N}_])no sql(?=$|[^\p{L}\p{N}_])/giu, '$1NoSQL')
    .replace(/(^|[^\p{L}\p{N}_])ci cd(?=$|[^\p{L}\p{N}_])/giu, '$1CI/CD')
    .replace(/(^|[^\p{L}\p{N}_])ux ui(?=$|[^\p{L}\p{N}_])/giu, '$1UX/UI')
    .replace(/(^|[^\p{L}\p{N}_])oauth2(?=$|[^\p{L}\p{N}_])/giu, '$1OAuth2')
    .replace(/(^|[^\p{L}\p{N}_])2fa(?=$|[^\p{L}\p{N}_])/giu, '$12FA');
}

export function technicalPhrases(text: string): string {
  return text
    .replace(/(^|[^\p{L}])üçün ise(?=$|[^\p{L}])/giu, '$1üçün isə')
    .replace(/(^|[^\p{L}])verilməsi ise(?=$|[^\p{L}])/giu, '$1verilməsi isə')
    .replace(/(^|[^\p{L}])proqram koda(?=$|[^\p{L}])/giu, '$1proqram koduna')
    .replace(/(düşməsinin) qarşısına alır/giu, '$1 qarşısını alır')
    .replace(/(^|[^\p{L}])addım addım(?=$|[^\p{L}])/giu, '$1addım-addım')
    .replace(/(^|[^\p{L}])bölünmüş və relational həm də/giu, '$1bölünmüş və həm relational, həm də')
    .replace(/(^|[^\p{L}])api keys oauth2/giu, '$1API keys və OAuth2')
    .replace(/(^|[^\p{L}])olasi problemləri(?=$|[^\p{L}])/giu, '$1ehtimal olunan problemləri')
    .replace(/(^|[^\p{L}])tespit edib(?=$|[^\p{L}])/giu, '$1müəyyən edib')
    .replace(/(^|[^\p{L}])saat əsası ilə(?=$|[^\p{L}])/giu, '$1saat əsasında')
    .replace(/(gördük) +ki +/giu, '$1 ki, ')
    .replace(/(şəbəkə üzərindən) +oturulur(?=$|[^\p{L}])/giu, '$1 ötürülür')
    .replace(/(gecikirdim) +(ona görə)/giu, '$1, $2');
}

const finite = `salamlayırıq keçirilmişdir başlanılmışdır çıxarmaqdır bölünmüşdür
olunacaqdır aparılacaqdır ayıracaqdır biləcəyik layihələndirilmişdir yaradır
göstərəcəkdir edəcəkdir qalacaqdır keçiriləcək qurulmuşdur olunacaq ediləcəkdir
alınır alır götürmüşdür gətiriləcəkdir biridir ötürüləcəkdir qorunacaqdır
qaldırılacaqdır endirir edilmişdir keçiriləcəkdir tutur saxlanılacaq çıxarılacaqdır
tənzimlənəcəkdir yaradacaqdır izləniləcəkdir göndərəcəkdir verir olacaqdır
hazırlanmışdır planlaşdırılır tamamlanacaqdır bildiririk olacaq
  cavablandırılacaqdır etdiriləcəkdir tələsdim edirdi soruşdum dedi yükləyirlər
  araşdırdıq gördük yoxdur işlədi yoxladım keçirdi davam etdirdim saxlayırlar
  edilməlidir ötürülür optimallaşdırılır edilir avtomatlaşdırır`.trim().split(/\s+/).join('|');
const starts = [
  'təqdim etdiyiniz', 'müəyyən olunmuş', 'bu məktubda', 'biznes proseslərinizin',
  'hər bir sprint', 'bu üsul', 'backlog', 'sprint qiymətləndirmə', 'hər sprintin',
  'bu yanaşma', 'istifadəçi', 'konteynerlərin', 'nəticədə', 'servislərin', 'bu da',
  'relyasiyalı', 'analitik', 'cəld giriş-çıxış', 'baza sorğularının', 'kənar sistemlərlə',
  'sistemdəki', 'RabbitMQ', 'bu funksionallıq', 'üçüncü tərəf', 'mobil uyğunluq',
  'brauzer', 'adaptiv', 'daxili axtarış', 'bütün məxfi', 'veri bazasında', 'mütəmadi',
  'xətalar', 'bu model', 'habelə', 'hər bir kod', 'yeni versiyaların', 'kodun',
  'köçürülmə prosesindən', 'duplikasiya', 'miqrasiya sınaqları', 'keçid gecə',
  'bu addım', 'inzibatçılar', 'sistemin istifadə', 'təlim keçmiş', 'Prometheus',
  'kritik səviyyədə', 'şirkətiniz üçün', 'texniki dəstək', 'məhsulun ilkin',
  'yekun məhsulun', 'biz sizinlə', 'əlavə suallarınız', 'ofisə', 'mən',
  'product owner', 'sonra', 'gördük', 'Redis', 'günortadan sonra', 'kodun', 'axşam',
  'serverlərdə', 'şifrələnmiş',
  'API', 'CI/CD',
].join('|');
const boundaries = new RegExp(`(^|[^\\p{L}])(${finite}) +(?=(?:${starts})(?:\\s|$))`, 'giu');

export function punctuateTechnical(text: string): string {
  return text.replace(boundaries, '$1$2. ')
    .replace(/(icra mərhələləri) +(funksional modulların strukturu) +(texniki xarakteristikalar)/giu, '$1, $2, $3')
    .replace(/(istifadəçi idarəetməsi) +(ödəniş inteqrasiyaları) +(bildiriş servisləri)/giu, '$1, $2, $3')
    .replace(/(panelləri sadə) +aydın/giu, '$1, aydın')
    .replace(/(unit testlər) +inteqrasiya testləri/giu, '$1, inteqrasiya testləri')
    .replace(/(serverlərin yüklənməsi) +yaddaş istifadəsi/giu, '$1, yaddaş istifadəsi')
    .replace(/(yeddi gün) +iyirmi dörd saat/giu, '$1, iyirmi dörd saat');
}
