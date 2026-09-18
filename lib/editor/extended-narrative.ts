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
  devops: 'DevOps', docker: 'Docker', ram: 'RAM', nvme: 'NVMe', ssd: 'SSD',
  swagger: 'Swagger', openapi: 'OpenAPI', dbml: 'DBML',
  postgresql: 'PostgreSQL', redis: 'Redis', youtube: 'YouTube',
  dosbox: 'DOSBox', lutris: 'Lutris', wayland: 'Wayland', bpmn: 'BPMN',
  lucidchart: 'Lucidchart', api: 'API',
};

export function beforeLexicalCorrection(text: string): string {
  return text
    .replace(/(^|[^\p{L}])n[eə] is[eə](?=$|[^\p{L}])/giu, '$1nə isə')
    .replace(/(^|[^\p{L}])bir nece(?=$|[^\p{L}])/giu, '$1bir neçə')
    .replace(/(^|[^\p{L}])indi ise(?=$|[^\p{L}])/giu, '$1indi isə')
    .replace(/(^|[^\p{L}])ise(?=\s+(?:gedir|getmək|getmek|çatdım|catdim)(?=$|[^\p{L}]))/giu, '$1işə')
    .replace(/(^|[^\p{L}])ise(?=\s+(?:yekunlaşdırdım|yekunlasdirdim)(?=$|[^\p{L}]))/giu, '$1işi')
    .replace(/(^|[^\p{L}])er\s+diagram(?=$|[^\p{L}])/giu, '$1ER diaqram');
}

export function extendedPhrases(text: string): string {
  return text
    .replace(/(^|[^\p{L}])(mən|sən|biz|siz|sürücü) de(?=\s+(?:dedim|dedin|dedik|dediniz|deyirəm|deyirsən|qışqırırdı|keçdim|oturub|gülümsəyib|daxilən|istəyirdim)(?=$|[^\p{L}]))/giu, '$1$2 də')
    .replace(/(^|[^\p{L}])(həm|hələ) de(?=\s)/giu, '$1$2 də')
    .replace(/(^|[^\p{L}])bina dan(?=$|[^\p{L}])/giu, '$1binadan')
    .replace(/(^|[^\p{L}])özüdə(?=$|[^\p{L}])/giu, '$1özü də')
    .replace(/(^|[^\p{L}])yavaş yavaş(?=$|[^\p{L}])/giu, '$1yavaş-yavaş')
    .replace(/(^|[^\p{L}])qəribə qəribə(?=$|[^\p{L}])/giu, '$1qəribə-qəribə')
    .replace(/(^|[^\p{L}])sistem analitik kimi(?=$|[^\p{L}])/giu, '$1sistem analitiki kimi')
    .replace(/(^|[^\p{L}])seher(?=\s+(?:basırıqları|yağış|tez)(?:\s|$))/giu, '$1səhər')
    .replace(/(^|[^\p{L}])ismayilliya(?=$|[^\p{L}])/giu, '$1İsmayıllıya')
    .replace(/(^|[^\p{L}])qəbələyə(?=$|[^\p{L}])/giu, '$1Qəbələyə');
}

// Only complete predicates followed by reviewed independent clause starters.
const predicates = 'yazmışdım gedib itələyirdi yorur gedir olmurdu endim bilmirdi bağlanırdı idi verilməlidir getmir göndərir düşdü kəsəcəyik deyərsən gəldi dəyişir olsun hazırlayırdım bilmir qarışıqdır çatmır olub quraşdırmayıblar dayanıb elədik rahatladı aldı oturdum süzdüm qurtarmışdı yoxdur qurtardı istəyirdim elədim yoxladım bilməyəcək qalsın ağrıyırdı baxdım keçirdi qoşuldu danışırdı aydındır deyir başlamışıq elədi oldu dayandı düzələcək açıram çıxdıq asırdım çatdım qopurdu danışdıq rahatdır incitməsin olmuşdu var idi dəyişdim yudum açdım salırdı edirdi oynadıq uduzdum idi var gəlmirdi izlədim gelirdi gəlirdi deyirdilər lazımdır olmalıdır çökər gəldim içdim qayıtdım yorur bilməyəcəyəm getdim'.split(' ').join('|');
const starters = 'səhər|təcili|əslində|deyəsən|nə isə|bir təhər|gələndə|sürücü|saat|bu gün|mən|mənə|maşınlar|heç nə|dedi|uşaqlar|bir deyir|DevOps|RAM|məgər|ona görə|backend|müdir|bir stakan|marketə|yanımdakı|o da|indi|hamı|iclasdan|keçdim|axşam|soruşdum|çantamı|beş|bir qadın|qapını|radioda|onlara|soyunub|biri deyir|idmandan|kartla|anam|anası|narahat olma|sonra|sistem promptunu|Pydantic|dostum|ikinci oyunda|vaxt|telefonu|düşündüm|məsələn|bu da|gecə|durub|uşaq vaxtı|hər şey|gecəniz';
const boundary = new RegExp(`(^|[^\\p{L}])(${predicates}) +(?=(?:${starters})(?:\\s|$))`, 'giu');

export function extendedBoundaries(text: string): string {
  return text.replace(boundary, '$1$2. ')
    .replace(/(^|[^\p{L}])(gəldi|deyərsən) +(?=nə isə günorta)/giu, '$1$2. ')
    .replace(/(^|[^\p{L}])(açdım|elədim|başlatdım) +(?=(?:Ubuntu|Swagger|görürəm ki)\s)/giu, '$1$2. ')
    .replace(/(^|[^\p{L}])(idi|verir|qışqıracaqdı|neynirsən) +(?=mən də\s)/giu, '$1$2. ')
    .replace(/(^|[^\p{L}])(göndərir|doldurubmuş|yaranıb) +(?=(?:log rotate|bazaya|mən həmin)\s)/giu, '$1$2. ')
    .replace(/(baxdım|deyir|deyirlər|dedilər|düşündüm|göndərdim|yazdı|soruşdum|bildim|istəyir|səsləndi) ki +/giu, '$1 ki, ');
}
