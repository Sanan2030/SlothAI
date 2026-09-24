// Reviewed forms from a second long-text regression. These are spelling forms,
// not replacements of entire passages; uncertain times/facts are not invented.
export const extendedNarrativeWords = `
yarıda yatdım atılıb görüşüm qaçırmaq yağacaqdı tərəfə basırıqları adamı
minməli qapısı bağlanırdı qışqırırdı dünyanın ən cinayətini eləmişəm
yaranıb bağışlayın maşınlar dayanmışdı tərpənmirdi inanmadı keç gör
məgər minlərlə ilə yazdığımız maaşından kəsəcəyik deyərsən acmışdım
dedilər yeməyə keçdi girişdə neynirsən deyirəm özüdə alınmır fikirlər
qarışıqdır çatmır görək faylları doldurubmuş konfiqurasiyasını quraşdırmayıblar
dayanıb logları təmizlədik rahatladı tapdın qışqıracaqdı gülümsəyib çay
özümə olardı qurtarmışdı marketə getməyə yoldaşım səndə qurtardı
çətindir başım günortaya dokumentasiyasına spesifikasiyasına olmadığını
yoxladım parametrlərdə komandasına bunları bilməyəcək yazdı baxarıq
vaxtımız iclasımız çəkdi qalsın çıxanda ağrıyırdı içdim pəncərədən
çıxmışdı yağmışdı aşağıda keçirdi beşdə arxitektura necədir apardım
keçdik lövhədə sxemasını çəkdim göstərdim cədvəli sifarişlər əlaqəsi
burdadır baxırdı düşmürdü anlamadığın aydındır utandığından öyrənəcəksən
hamımız başlamışıq topladım enəndə dayandı qışqırmağa başladı açmırlar
olmayın düzələcək düyməsini basdıq səsləndi qapını açıram dəqiqədən
açdılar çıxdıq yekunlaşdırdım istəmirdim getməyi qərara tərəfdə
bağlanmışdı nəyəsə qaldım mahnılar mahnıları asırdım eləməyə
qaldırdım qollarım rahatdır fərqi incitməsin yarımda yollandım nəfər
qabağına keçib keçmirdi bəxtimdən cibimdə anası hardasan gəlirsən
girmişdim paltarlarımı dəyişdim əlimi üzümü mətbəxə yeməyini otağıma
çıxarıb alqoritmi yazmalı yaxşı gəlmirdi xəbərlərə baxmağa baxırdım
olacağı deyirdilər ağlıma bölüşdürüm diaqramını proqramında prosesləri
proseslərini xidmətləri layihəsidir inteqrasiyaları məhsulun çökər
işləyirdi fikirləşməkdən mətbəxdən dərmanı günlər arxasında insanı
işləmək planlarım gəzmək içmək fikirləşirdim gözlərim yumulurdu
isə edib şey dəri maşınların səsi gəlirdi qabağına xəbərlərdə aşağıda çıxdı
qışqıracaqdı arxitektura alqoritmi endpointlərin konteynerləri
şükür saatı yatmışdım hazırlayıb terminalını yüklədim yaradırdılar
dokumentasiyasını yoxlamağa başladım spesifikasiyası tiplər qarışdırılmışdı
yazmışdılar alırdım kanalında iclasındayıq öz sənədimi yazmağa istəyirdi
rəqəmsallaşsın çəkmişdim oxları bağlayırdım mikroservislər bağlansın
olunmasın etsək yazılmalıdır yeməyi günortadan müəyyənləşdirirdik
soruşurdu yarandı taskını altıya kodları yoxlasın çantamı toplayıb
tıxacda təlaşlı küncə gücü etməli planlaması paylanacaqdı
strukturlaşdırıb yetirmək gecəniz xeyrə fısıldayıb test birinə eləmək
endpointləri hazırladım hazırlamaq
`.trim().split(/\s+/);

export const extendedAliases: Record<string, string> = {
  qacirmag: 'qaçırmaq', gedmir: 'getmir', prroblem: 'problem',
  konandi: 'komandası', fastapil: 'FastAPI', gorursem: 'görürəm',
  maashindan: 'maaşından', ucaqlar: 'uşaqlar', cokusdurub: 'çökdürüb',
  bash: 'baş', bashim: 'başım', suzduim: 'süzdüm', yanmdaki: 'yanımdakı',
  ishlemek: 'işləmək', ishlemir: 'işləmir', muabise: 'mübahisə',
  biraz: 'bir az', pencerenden: 'pəncərədən', yagish: 'yağış',
  choxa: 'çoxa', cachleme: 'keşləmə', liftchi: 'liftçi',
  otaqima: 'otağıma', yaxshi: 'yaxşı', uduzduym: 'uduzdum',
  icyeri: 'içəri', yagacak: 'yağacaq', reqemsallashsin: 'rəqəmsallaşsın',
  catdiracaqammi: 'çatdıracağammı', bilmiyecem: 'bilməyəcəyəm',
  ashagida: 'aşağıda', qisqiracakdi: 'qışqıracaqdı',
  arhitektura: 'arxitektura', algoritmi: 'alqoritmi',
  endpointlerin: 'endpointlərin', containerleri: 'konteynerləri',
  shukur: 'şükür', ama: 'amma', sinitzel: 'şnitsel',
  kovertasiya: 'konvertasiya', sabahsisi: 'sabahısı',
  bashlayacaqdi: 'başlayacaqdı', tapiriqlar: 'tapşırıqlar',
  telesli: 'təlaşlı', asistansan: 'assistentsən',
  gnu: 'GNU', postman: 'Postman', slack: 'Slack',
  swaggerde: 'Swagger-də', bpmnde: 'BPMN-də',
  devops: 'DevOps', docker: 'Docker', ram: 'RAM', nvme: 'NVMe', ssd: 'SSD',
  swagger: 'Swagger', openapi: 'OpenAPI', dbml: 'DBML',
  postgresql: 'PostgreSQL', redis: 'Redis', youtube: 'YouTube',
  acanda: 'açanda', purrengi: 'pürrəngi', cayxana: 'çayxana',
  beynin: 'beynin', zeng: 'zəng', caldi: 'çaldı', sualari: 'şüaları',
  isiqlandirirdi: 'işıqlandırırdı', quslarin: 'quşların',
  'cevh-cehi': 'cəh-cəhi', caydan: 'çaydanı', goturdum: 'götürdüm',
  evden: 'evdən', pillekenlerle: 'pilləkənlərlə', qonsunu: 'qonşunu',
  salamlasib: 'salamlaşıb', kenarinda: 'kənarında', oyanisini: 'oyanışını',
  isiqoforlarin: 'işıqforların', agciyerleridir: 'ağciyərləridir',
  dosbox: 'DOSBox', lutris: 'Lutris', wayland: 'Wayland', bpmn: 'BPMN',
  lucidchart: 'Lucidchart', api: 'API',
};

export function beforeLexicalCorrection(text: string): string {
  return text
    .replace(/(^|[^\p{L}])n[eə] is[eə](?=$|[^\p{L}])/giu, '$1nə isə')
    .replace(/(^|[^\p{L}])bir nece(?=$|[^\p{L}])/giu, '$1bir neçə')
    .replace(/(^|[^\p{L}])indi ise(?=$|[^\p{L}])/giu, '$1indi isə')
    .replace(/(^|[^\p{L}])chantai(?=\s+k[uü]nc[eə](?=$|[^\p{L}]))/giu, '$1çantanı')
    .replace(/(^|[^\p{L}])ise(?=\s+(?:gedir|getmək|getmek|çatdım|catdim)(?=$|[^\p{L}]))/giu, '$1işə')
    .replace(/(^|[^\p{L}])ise(?=\s+(?:yekunlaşdırdım|yekunlasdirdim)(?=$|[^\p{L}]))/giu, '$1işi')
    // "seherler" can mean cities or mornings. A following exercise phrase
    // proves the temporal meaning and prevents the lexicon from choosing
    // "şəhərlər".
    .replace(/(^|[^\p{L}])seherler(?=\s+yungul\s+qacis)/giu, '$1səhərlər')
    .replace(/(^|[^\p{L}])er\s+diagram(?=$|[^\p{L}])/giu, '$1ER diaqram');
}

export function extendedPhrases(text: string): string {
  return text
    .replace(/(^|[^\p{L}])(mən|sən|biz|siz|sürücü) de(?=\s+(?:dedim|dedin|dedik|dediniz|deyirəm|deyirsən|qışqırırdı|keçdim|oturub|gülümsəyib|daxilən|istəyirdim)(?=$|[^\p{L}]))/giu, '$1$2 də')
    .replace(/(^|[^\p{L}])(həm|hələ) de(?=\s)/giu, '$1$2 də')
    .replace(/(^|[^\p{L}])mən de(?=\s+(?:Swagger|izah|çay|daxil)(?=$|[^\p{L}]))/giu, '$1mən də')
    .replace(/(^|[^\p{L}])bir birinə(?=$|[^\p{L}])/giu, '$1bir-birinə')
    .replace(/(^|[^\p{L}])YouTube da(?=$|[^\p{L}])/giu, '$1YouTube-da')
    .replace(/(^|[^\p{L}])DOSBox va Lutris(?=$|[^\p{L}])/giu, '$1DOSBox və Lutris')
    .replace(/(^|[^\p{L}])need for speed(?=$|[^\p{L}])/giu, '$1Need for Speed')
    .replace(/(^|[^\p{L}])x11(?=$|[^\p{L}\d])/giu, '$1X11')
    .replace(/(^|[^\p{L}])necə pointdir(?=$|[^\p{L}])/giu, '$1neçə pointdir')
    .replace(/(^|[^\p{L}])YouTube-da video izlədim emulyatorlar haqqında(?=$|[^\p{L}])/giu, '$1YouTube-da emulyatorlar haqqında video izlədim')
    .replace(/(^|[^\p{L}])bina dan(?=$|[^\p{L}])/giu, '$1binadan')
    .replace(/(^|[^\p{L}])özüdə(?=$|[^\p{L}])/giu, '$1özü də')
    .replace(/(^|[^\p{L}])yavaş yavaş(?=$|[^\p{L}])/giu, '$1yavaş-yavaş')
    .replace(/(^|[^\p{L}])şəhərlər(?=\s+yüngül\s+qaçış)/giu, '$1səhərlər')
    // The same unaccented form can mean a city or morning. These are reviewed
    // temporal contexts; the general city meaning remains untouched.
    .replace(/(^|[^\p{L}])(?:seher|şəhər) havasi(?=$|[^\p{L}])/giu, '$1səhər havası')
    .replace(/(^|[^\p{L}])(?:seher|şəhər) yeməyi(?=$|[^\p{L}])/giu, '$1səhər yeməyi')
    .replace(/(^|[^\p{L}])şəhərin sakitliyini(?=$|[^\p{L}])/giu, '$1səhərin sakitliyini')
    .replace(/(^|[^\p{L}])şəhərin oyanışını(?=$|[^\p{L}])/giu, '$1səhərin oyanışını')
    .replace(/(^|[^\p{L}])əlaqə qürur(?=$|[^\p{L}])/giu, '$1əlaqə qurur')
    .replace(/(^|[^\p{L}])meseler planetimizin(?=$|[^\p{L}])/giu, '$1meşələr planetimizin')
    .replace(/(^|[^\p{L}])biyo kutlenin(?=$|[^\p{L}])/giu, '$1biokütlənin')
    .replace(/(^|[^\p{L}])qəribə qəribə(?=$|[^\p{L}])/giu, '$1qəribə-qəribə')
    .replace(/(^|[^\p{L}])sistem analitik kimi(?=$|[^\p{L}])/giu, '$1sistem analitiki kimi')
    .replace(/(^|[^\p{L}])seher(?=\s+(?:basırıqları|yağış|tez)(?:\s|$))/giu, '$1səhər')
    .replace(/(^|[^\p{L}])(?:seher|şəhər)(?=\s+telefonun\s+s[əe]sin[əe])/giu, '$1səhər')
    .replace(/(^|[^\p{L}])ismayilliya(?=$|[^\p{L}])/giu, '$1İsmayıllıya')
    .replace(/(^|[^\p{L}])qəbələyə(?=$|[^\p{L}])/giu, '$1Qəbələyə');
}

// Only complete predicates followed by reviewed independent clause starters.
const predicates = 'yazmışdım gedib itələyirdi yorur gedir olmurdu endim bilmirdi bağlanırdı idi verilməlidir getmir göndərir düşdü kəsəcəyik deyərsən gəldi dəyişir olsun hazırlayırdım bilmir qarışıqdır çatmır olub quraşdırmayıblar dayanıb elədik rahatladı aldı oturdum süzdüm qurtarmışdı yoxdur qurtardı istəyirdim elədim yoxladım bilməyəcək qalsın ağrıyırdı baxdım keçirdi qoşuldu danışırdı aydındır deyir başlamışıq elədi oldu dayandı düzələcək açıram çıxdıq asırdım çatdım qopurdu danışdıq rahatdır incitməsin olmuşdu var idi dəyişdim yudum açdım salırdı edirdi oynadıq uduzdum idi var gəlmirdi izlədim gelirdi gəlirdi deyirdilər lazımdır olmalıdır çökər gəldim içdim qayıtdım yorur bilməyəcəyəm getdim'.split(' ').join('|');
const starters = 'səhər|təcili|əslində|deyəsən|nə isə|bir təhər|gələndə|sürücü|saat|bu gün|mən|mənə|maşınlar|heç nə|dedi|uşaqlar|bir deyir|DevOps|RAM|məgər|ona görə|backend|müdir|bir stakan|marketə|yanımdakı|o da|indi|hamı|iclasdan|keçdim|axşam|soruşdum|çantamı|beş|bir qadın|qapını|radioda|onlara|soyunub|biri deyir|idmandan|kartla|anam|anası|narahat olma|sonra|sistem promptunu|Pydantic|dostum|ikinci oyunda|vaxt|telefonu|düşündüm|məsələn|bu da|gecə|durub|uşaq vaxtı|hər şey|gecəniz';
const boundary = new RegExp(`(^|[^\\p{L}])(${predicates}) +(?=(?:${starters})(?:\\s|$))`, 'giu');

export function extendedBoundaries(text: string): string {
  return punctuateWorkday(text.replace(boundary, '$1$2. '))
    .replace(/(^|[^\p{L}])(gəldi|deyərsən) +(?=nə isə günorta)/giu, '$1$2. ')
    .replace(/(^|[^\p{L}])(açdım|elədim|başlatdım) +(?=(?:Ubuntu|Swagger|görürəm ki)\s)/giu, '$1$2. ')
    .replace(/(^|[^\p{L}])(idi|verir|qışqıracaqdı|neynirsən) +(?=mən də\s)/giu, '$1$2. ')
    .replace(/(^|[^\p{L}])(göndərir|doldurubmuş|yaranıb) +(?=(?:log rotate|bazaya|mən həmin)\s)/giu, '$1$2. ')
    .replace(/(baxdım|deyir|deyirlər|dedilər|düşündüm|göndərdim|yazdı|soruşdum|bildim|istəyir|səsləndi|deyirdi|deyirəm|istəyirdi|soruşurdu|elədim|oldum|elədi|açdım|şükür) ki +/giu, '$1 ki, ');
}

// Finite verb + independently reviewed next-clause opening. Infinitives and
// participles alone are not evidence of a sentence boundary.
const workdayPredicates = [
  'oyandım', 'yatmışdım', 'elədim', 'yüklədim', 'yaradırdılar', 'başladım',
  'idi', 'qarışdırılmışdı', 'yazmışdılar', 'alırdım', 'bilməyəcək',
  'iclasındayıq', 'baxarıq', 'rəqəmsallaşsın', 'çəkmişdim', 'qururdum',
  'bağlansın', 'olunmasın', 'olacaq', 'yazılmalıdır', 'verdik', 'qalxdım yuxarı',
  'başladı', 'müəyyənləşdirirdik', 'yarandı', 'yoxlasın', 'çıxdım', 'qaçdım',
  'aldım', 'açdım', 'istəyirdim', 'dəyişdim', 'assistentsən', 'oynayaq',
  'daxil oldum', 'izlədim', 'olar', 'baxırdım', 'işləmir', 'qoydum kənara',
  'düşündüm', 'idim', 'başlayacaqdı', 'paylanacaqdı',
].join('|');
const workdayStarters = [
  'şükür ki', 'kofe', 'yeni dəyişiklikləri', 'backend tərəfdə', 'ona görə',
  'Swagger-də', 'bəzi tiplər', 'integer', 'təcili', 'onlar da', 'iclasdan sonra',
  'mən də', 'Lucidchart', 'REST', 'performans', 'həm də', 'nə isə',
  'yemək', 'günortadan sonra', 'iclasda', 'scrum master', 'axırda', 'sonra',
  'tıxacda', 'yolda', 'metroda', 'çantanı', 'bir az resume parser', 'PDF',
  'dedim', 'yalnız JSON', 'bir neçə oyun', 'Linuxda', 'DOSBox', 'pull request',
  'köhnə Need for Speed', 'X11', 'axır ki', 'pəncərəni', 'zala', 'yarım saat',
  'creatin', 'sabahısı gün', 'müxtəlif tapşırıqlar', 'hamısını', 'gecəniz',
  '\\uE000+\\d+\\uE001 prosesini', '\\uE000+\\d+\\uE001 daxil',
  '\\uE000+\\d+\\uE001 yerinə',
].join('|');
const workdayBoundary = new RegExp(`(^|[^\\p{L}])(${workdayPredicates}) +(?=(?:${workdayStarters})(?:\\s|$))`, 'giu');

function punctuateWorkday(text: string): string {
  return text.replace(workdayBoundary, '$1$2. ')
    .replace(/(kompüterin qabağına) +(?=GNU\s+Linux)/giu, '$1. ')
    .replace(/(keçdim [^.!?\n]{0,60}sənədimi yazmağa) +(?=müştəri\s)/giu, '$1. ')
    .replace(/(keçdim otağıma) +(?=kompüteri\s)/giu, '$1. ')
    .replace(/(keçdim telefonla xəbərlərə baxmağa) +(?=YouTube-da\s)/giu, '$1. ')
    .replace(/(çəkmişdim) +(?=indi\s)/giu, '$1. ')
    .replace(/(içdim) +(?=pəncərədən\s)/giu, '$1. ')
    .replace(/(olsun) +(deyirdilər)(?=$|[^\p{L}])/giu, '$1, $2')
    .replace(/(qurtarmışdı) +(deyirdilər)(?=$|[^\p{L}])/giu, '$1, $2')
    .replace(/(pointdir) +(?=biri deyirdi\s)/giu, '$1? ')
    .replace(/(\d+ point) +(?=biri deyirdi\s|mübahisə\s)/giu, '$1. ')
    .replace(/(biri deyirdi) +(?=\d+ point(?:[^\p{L}]|$))/giu, '$1: ')
    .replace(/(necə işlətmək olar)\.(?=\s)/giu, '$1?')
    .replace(/(tez keçdi) +ki +/giu, '$1 ki, ')
    .replace(/(^|[^\p{L}])(axır ki) +(?=bezdim\s)/giu, '$1$2, ')
    .replace(/(^|[^\p{L}])gecəniz xeyrə +fısıldayıb(?=$|[^\p{L}])/giu, '$1“Gecəniz xeyrə” fısıldayıb')
    .replace(/(düzəldin|var|olsun|olmalıdır) +yoxsa +/giu, '$1, yoxsa ')
    .replace(/(sabaha da iş var) +(?=gərək\s)/giu, '$1, ');
}
