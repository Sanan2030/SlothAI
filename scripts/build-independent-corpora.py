"""Build frozen, hand-authored Azerbaijani RSD/IT and correspondence holdouts.

Each line describes a separate situation; there is no Cartesian expansion of
subjects, recipients, or spelling variants. Run this script only when editing
the reviewed fixture source, never as part of the application build.
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Domain|input|semantic anchor. All inputs were authored for this holdout.
RSD = """
qeydiyyat|rsd de yeni muraciet qeydiyyata alinib|müraciət
qeydiyyat|sened daxil olanda qeydiyyat nomresi avtomatik verilir|nömrəsi
qeydiyyat|eyni muraciet ikinci defe gonderilende sistem xeberdarliq edir|sistem
qeydiyyat|gelen mektubun tarixi qeydiyyat jurnalina yazilir|jurnalına
qeydiyyat|qeydiyyat kartindaki unvan melumati yanlisdir|ünvan
qeydiyyat|operator mektubun elavelerini yoxlayib qeydiyyati tamamlayir|əlavələrini
qeydiyyat|qebul olunan senede ilkin status teyin edildi|status
qeydiyyat|qeydiyyat nomresinin prefiksi filial uzre ferqlenir|filial
qeydiyyat|muracietin daxilolma kanali kartda gosterilmelidir|kanalı
qeydiyyat|tekrar sened asgarlananda operatora bildiris gonderilir|bildiriş
qeydiyyat|fiziki sexsin fin kodu qeydiyyat zamani yoxlanilir|kod
qeydiyyat|hüquqi sexsin voen melumati sorgudan qayidir|məlumatı
qeydiyyat|qebul tarixi ile senedin ustundeki tarix eyni deyil|tarix
qeydiyyat|operator xidmet novunu duzgun secmeyib|xidmət
qeydiyyat|gelen post gonderisi icin ayrica qeydiyyat acilir|qeydiyyat
qeydiyyat|qeydiyyata alinan faylin olcusu limitden boyukdur|faylın
qeydiyyat|mektubun esli kagiz arxivine teqdim olunub|arxivinə
qeydiyyat|giris senedinin kodu diger struktur bolmeye aiddir|bölməyə
qeydiyyat|qebul formasi bos biraxilanda tesdiq duymesi baglanir|forma
qeydiyyat|qeydiyyat tamamlanandan sonra istifadeciye qebz gonderilir|qəbz
sened_novu|sened novu secilmeden muraciet yaradilmir|sənəd
sened_novu|xidmeti senedler ucun elave saheler acilmalidir|sahələr
sened_novu|daxili mektub ile xarici mektub ferqli novlerdir|məktub
sened_novu|sened novunun adi siyahida iki defe gorunur|siyahıda
sened_novu|istifade olunmayan sened novu deaktiv edilsin|deaktiv
sened_novu|yeni nov yaradilanda kateqoriya mutleq secilmelidir|kateqoriya
sened_novu|qerar layihesi sened novlerine elave olunub|qərar
sened_novu|mukavile novunun saxlanma muddeti on ildir|müqavilə
sened_novu|arxiv senedi ayri bolmede gosterilir|arxiv
sened_novu|sifaris novu ucun icaze ssenarisi ferqlidir|icazə
sened_novu|sistem novun kodunu el ile yazmaga icaze vermir|kodunu
sened_novu|sened novune gore vacib saheler deyisir|sahələr
sened_novu|elektron akt yeni nov kimi teqdim olunacaq|akt
sened_novu|novun tercumesi azerbaycan dilinde natamamdir|tərcüməsi
sened_novu|her novun oz qeydiyyat saygaci olmalidir|sayğacı
sened_novu|vekaletname novunde etibar eden sexs ayrica secilir|şəxs
sened_novu|xidmet arayisi yalniz aidiyyeti qrup terefinden acilir|arayışı
sened_novu|protokol novu ucun fayl elavesi mecburidir|fayl
sened_novu|hesabat novu siyahinin evvelinde gosterilsin|hesabat
sened_novu|qaytarilan senedin novu deyisdirile bilmir|dəyişdirilə
derkenar|derkenar layihesi icra edilmek ucun gonderildi|dərkənar
derkenar|derkenarin meqsedi secilmeden icraci teyin edilmir|icraçı
derkenar|rehber derkenari tesdiqleyib imzaladi|təsdiqləyib
derkenar|derkenar uzre son icra tarixi sabaha qoyulub|icra
derkenar|layihe qeyde qaytarilanda sebeb gosterilmelidir|səbəb
derkenar|eyni senede ikinci derkenar elave olunub|ikinci
derkenar|derkenar layihesini kim hazirlayib|hazırlayıb
derkenar|icraci derkenarin ustundeki qeydleri gore bilmir|qeydləri
derkenar|derkenar imzalandi amma icra statusu deyismedi|statusu
derkenar|daxili derkenar ucun muavin raziligi teleb olunur|razılığı
derkenar|derkenarin elavesi sened kartinda acilmir|kartında
derkenar|imzadan sonra derkenar metni redakte edilmesin|mətn
derkenar|derkenar icraya yonlendirilende bildiris dusmedi|bildiriş
derkenar|tesdiq novbesindeki derkenar geri cekildi|növbəsindəki
derkenar|rehberin derkenara yazdigi qeyd saxlanmayib|qeyd
derkenar|derkenar uzre mesul sexs mezuniyyetdedir|məsul
derkenar|icraci derkenarin muddetini uzatmaq isteyir|müddətini
derkenar|derkenar proyekti teqdim edilmeden silinib|silinib
derkenar|nezaretci derkenar icrasini yoxlamaq ucun tarixceye baxir|tarixçəyə
derkenar|derkenarin cari versiyasi pdf faylinda gorunmelidir|PDF
marshrut|sened aidiyyeti uzre yeni icraciya yonlendirildi|icraçıya
marshrut|razilasdirma merhelesinde gonderis baglanib|mərhələsində
marshrut|muraciet rehbere catmadan evvel katibden kecir|rəhbərə
marshrut|marshrutdaki ikinci addim sehv bolmeye baglanib|bölməyə
marshrut|qaytarilan sened ilkin icraciya geri donur|geri
marshrut|merhele bitende novbeti vezifeli sexse bildiris gedir|bildiriş
marshrut|paralel icra ucun iki struktur bolme secildi|paralel
marshrut|birinci razilasdiran vezifeli sexs ezamiyyetdedir|birinci
marshrut|tesdiq zamani marşrutun kohne versiyasi isledi|versiyası
marshrut|icra muddeti baslayanda timer ishə dusmelidir|icra
marshrut|yeni marşrut yalniz test muhitinde aktivdir|test
marshrut|sened yonlendirilende eski icraci siyahidan cixarilir|siyahıdan
marshrut|rahatlasdirilmis marşrut uc addimdan ibaretdir|addımdan
marshrut|tesdiq eden sexs secilende struktur aidiyyeti yoxlanir|şəxs
marshrut|yanlis icraci teyin edilmis sened geri qaytarildi|təyin
marshrut|is axininda imza addimi buraxila bilmez|imza
marshrut|gizli sened xarici icraciya yonlendirilmesin|sənəd
marshrut|yeni workflow komandalar uzre ferqli isleyir|workflow
marshrut|gonderisden sonra marşrut tarixcesi silinmemelidir|tarixçəsi
marshrut|marşrutun her addiminda icra vaxti yazilsin|vaxtı
icazeler|istifadeci senedi yalniz oz bolmesinde gore bilir|bölməsində
icazeler|rola esaslanan giris qaydasi yenilendi|giriş
icazeler|mesul sexsin imza icazesi muddetle mehdudlasir|imza
icazeler|filial operatoru merkezi arxive baxa bilmir|arxivə
icazeler|mezuniyyetdeki iscinin selahiyyeti muveqqeti kecirildi|səlahiyyəti
icazeler|admin panelinde icaze yoxlamasi aparilir|icazə
icazeler|gizli senedin oxunmasina yalniz rehber icaze verir|rəhbər
icazeler|icaze matrisi sened novune gore qurulub|matrisi
icazeler|api tokeni deaktiv edilende gonderis dayanir|tokeni
icazeler|istifadecinin rolu deyisende sessiya yenilensin|rolu
icazeler|icaze olmadan endirilen fayl ucun 403 qaytarilir|403
icazeler|musteri nümayendesi yalniz oz muracietine baxir|müraciətinə
icazeler|icracinin duzelis selahiyyeti bu merhelede yoxdur|səlahiyyəti
icazeler|vekalet verilen sexs ucun bitme tarixi qeyd edilib|tarixi
icazeler|qrup icazesi silinende ferdi istisna saxlanilir|istisna
icazeler|daxili istifadeci diski paylasim linkini acmasin|paylaşım
icazeler|audit oxuma icazesi yalnız nezaretcide qalir|audit
icazeler|giris meselesini rol yoxlamasi ile tekrarladiq|rol
icazeler|ozune menimseme funksiyasi ucun selahiyyet teleb edilir|funksiya
icazeler|iki rolun kesismesinde mehdud icaze ustun tutulur|icazə
imza|elektron imza ucun sertifikatin vaxti bitib|sertifikatın
imza|imzalanmis senedin heşi yoxlanmalidir|sənədin
imza|mobil imza prosesinde vaxt asimi bas verdi|imza
imza|sistem imza vaxtini audit jurnalina yazir|audit
imza|imzalayan sexsin adi sertifikatla eynidir|sertifikatla
imza|ikinci imza birinciden sonra teleb olunur|birincidən
imza|pdf imzasinin etibarliq statusu ayrica gosterilir|PDF
imza|imza duymesi yalniz tesdiq merhelesinde acilir|imza
imza|sertifikat yenilenende kohne fayl toxunulmaz qalir|fayl
imza|muddeti bitmis token ile sened imzalanmir|token
imza|imza sirasi rehberin qerari ile deyisdirildi|qərarı
imza|istifadeci bir senedi iki defe imzalamaq isteyib|sənədi
imza|imza xidmeti kesilende sorgu novbede saxlanilir|sorğu
imza|e imza cavabi ucun otuz saniye gozlenilir|cavabı
imza|imza sertifikatinin seriya nomresi metadataya yazilir|nömrəsi
imza|ucuncu imzaci teyin olunmadigi ucun proses dayandi|proses
imza|hesabat imzalanandan sonra arxive gonderilir|arxivə
imza|nezaretci imza tarixcesini fayldan yoxlayir|tarixçəsini
imza|imza mueyyen muddetde tesdiq olunmasa xeta verilir|xəta
imza|senede eyni vaxtda imza gondermek yarisa sebeb oldu|imza
arxiv|sened arxive kocurulende metadata saxlanilsin|metadata
arxiv|kohne arxivden getirilen faylin adi deyismeyib|faylın
arxiv|arxivdeki muraciet qeydiyyat nomresi ile axtarilir|nömrəsi
arxiv|silinmis sened arxivde ayri statusla gosterilir|statusla
arxiv|arxiv qaydasina esasen saxlanma muddeti bitib|müddəti
arxiv|faylin heşi kocurmeden sonra yeniden yoxlanildi|yoxlanıldı
arxiv|arxivde axtaris ucun tarix araligi secin|tarix
arxiv|senedin kagiz esli bir hefte sonra catacaq|sənədin
arxiv|arxiv servisinde gecikme yaranib|servisində
arxiv|elektron nüsxeler ehtiyat saxlanca gonderildi|nüsxələr
arxiv|arxiv idaresi baglanmis dosyeni yeniden acdi|yenidən
arxiv|kohne senedlerin metadata xetasi hesabatda gorunur|metadata
arxiv|arxivden cixarilan mektub qeydiyyat jurnali ile tutusduruldu|jurnalı
arxiv|axtaris indeksi yenilenmediyi ucun sened tapilmir|indeksi
arxiv|arxiv surətini yuklemek ucun giris icazesi lazimdir|icazəsi
arxiv|muhafize muddeti artirilan dosye silinmemelidir|dosye
arxiv|pdf fayli arxivde acilir amma sertifikat gosterilmir|PDF
arxiv|arxivde sened novune esasen filter isleyir|filter
arxiv|istifadeci arxiv qeydini el ile duzelde bilmir|qeydini
arxiv|arxiv hesabatinda bu ayin gonderis sayi azdir|hesabatında
audit|audit jurnalinda imza tarixi eksikdir|audit
audit|kim senedi silib onu tarixcede gore bilirik|tarixçədə
audit|qeydiyyat emeliyyati ucun istifadeci id si saxlanildi|istifadəçi
audit|audit hadiseleri her gecə ehtiyat bazaya kocurulur|bazaya
audit|giris cehdleri tarix ve saat uzre siralanir|giriş
audit|gizli fayla baxan sexsin hesabi qeyde alinib|şəxsin
audit|log yazisi ip unvanina gore axtarilir|ünvanına
audit|audit hesabati muhasib terefinden tesdiq edildi|hesabatı
audit|bu emeliyyatin evvelki deyeri jurnal qeydinde var|jurnal
audit|mesaj gonderilende correlation id qeyd olunmur|mesaj
audit|audit qeydi silinmeye qarsi qorunmalidir|qeydi
audit|operatorun el ile etdiyi duzelis ayrica gosterilir|düzəliş
audit|hadisenin vaxt zonasi dogru gosterilmelidir|vaxt
audit|merhele deyisikliyi jurnala yazilmadigi ucun itdi|mərhələ
audit|adminin deyisiklikleri diger emeliyyatlardan ayrilir|dəyişiklikləri
audit|audit eksportunda bos setirler coxdur|sətirlər
audit|inzibatci audit qeydlerini de redakte ede bilmesin|qeydlərini
audit|zaman damgasi ile sorğu nomresi elaqelendirildi|sorğu
audit|jurnalin axirinci yazisi bu gun qeyd olunub|jurnalın
audit|audit paneli xeta koduna gore susdurulub|xəta
api|GET /api/v1/documents endpointi 500 qaytarir|GET /api/v1/documents
api|POST /api/v1/requests sorğusunda body bos qalıb|POST /api/v1/requests
api|api cavabinda pagination fieldi gosterilmir|pagination
api|endpoint ucun authorization headeri teleb olunur|authorization
api|openapi spesifikasiyasinda status kodu yanlisdir|status
api|swaggerde request schema ile response schema ferqlenir|schema
api|webhook eyni hadiseni iki defe gonderib|webhook
api|rate limit dolandan sonra server 429 qaytarir|429
api|pagination cursorunun muddeti bitib|cursorunun
api|api response içində null sahə problem yaradır|null
api|GET metodu ile yazma emeliyyati aparilmasin|GET
api|REST servisinde yeni parametr mecburidir|REST
api|grpc xidmeti protobuf uyğunsuzlugu verir|protobuf
api|gateway sorğunu backend servisine yonlendirmir|backend
api|callback URL yanlış qeyd olunduğu ucun 404 aliriq|404
api|api sertifikati yenilendikten sonra elaqe kesilib|sertifikatı
api|v2 endpointi kohne clientlerle geriye uyğundur|endpoint
api|sorgunun timeout muddeti yuklenmede artirildi|timeout
api|idempotency key tekrar edilen odemeni blokladi|idempotency
api|webhook imzasi yoxlanmadan mesaj qebul edilmesin|webhook
database|postgresql bazasinda indeks catismir|indeks
database|migration skripti yalniz stagingde isleyib|staging
database|transaction commit olunmadigi ucun setir gorunmedi|commit
database|foreign key qaydasi silinmeni engelledi|foreign
database|redis kesinin ttl muddeti bes deqiqedir|Redis
database|select sorgusu cox setir qaytaranda lengiyir|sorğu
database|bazanin ehtiyat nusxesi gecə tamamlandi|nüsxəsi
database|database connection pool limiti asilib|connection
database|unique constraint tekrarlanan qeydiyyati bloklayir|unique
database|schema deyisikliyi ucun rollback plani hazirlandi|rollback
database|partition cədvəli aylar uzre ayrilib|cədvəli
database|deadlock zamani iki emeliyyat geri qaytarildi|deadlock
database|məlumat bazasinin surəsi restore testinden kecdi|bazası
database|orm sorgusundaki eager load artiq yuk yaradir|sorğusundakı
database|mysql replika serveri oxuma sorğularini qebul edir|MySQL
database|jsonb sahesinde yeni indeks yaradildi|indeks
database|verilənler bazasindaki tarixler utc saxlanilsin|UTC
database|db sehvlərinin hamisi jurnal qeydine dusmur|jurnal
database|istifadeci cedveli ucun saxlanma siyaseti deyisdi|cədvəli
database|baza versiyasi deploydan evvel yoxlanilsin|versiyası
devops|production deploy sonrasi health check ugurludur|deploy
devops|staging muhitinde yeni feature flag aktivdir|staging
devops|ci cd pipeline testde dayandi|pipeline
devops|docker image tagi son commit sha sına baglanib|Docker
devops|kubernetes podu yaddaş limitine catdi|podu
devops|roll back ucun kohne build saxlanilib|build
devops|vercelde api route cold start sebebinden gecikir|route
devops|prometheus alerti novbetci muhendise gonderildi|alerti
devops|grafana panelinde cpu pikleri gorunur|CPU
devops|load balancer saglam olmayan instansi cixarir|balancer
devops|dns deyisikliyinden sonra sertifikat yenilendi|sertifikat
devops|secret rotation vaxtinda tamamlanmadi|secret
devops|terraform planinda yeni subnet yaradilacaq|subnet
devops|blue green deployda trafik yeni versiyaya kecdi|trafik
devops|git tagi release qeydine baglandi|Git
devops|node serveri signal alanda aciq baglantilari baglayir|server
devops|monitorinq esikleri uat ile ferqli hesablanib|monitorinq
devops|konteyner restartindan sonra fayl sistemi temizlendi|fayl
devops|yeni muhitin env deyiseni bos qalıb|mühitin
devops|deployment tamamlandi amma domen kohne versiyani acir|domen
security|oauth2 tokeninin muddeti bitib|tokeninin
security|iki faktorlu dogrulama kodu gec catir|kodu
security|csrf yoxlamasi form gonderisinde isledi|form
security|xss cehdi html atributunda bloklandi|HTML
security|sifre sifirlamasi ucun link bir defe islemelidir|link
security|selahiyyetsiz istifadeci gizli fayla giris isteyir|fayla
security|jwt imzasinda uyğunsuzluq askar olundu|JWT
security|tls sertifikatinin vaxti sabah bitir|sertifikatının
security|audit ucun sade metn sifre saxlanmasin|şifrə
security|hesabin bloklanmasi on ardicil cehdden sonra bas verir|hesabın
security|session cookie sinin same site ayari sertdir|cookie
security|captcha cavabi secilmis sessiya ile yoxlanilir|sessiya
security|ip adresine gore tezlik limiti tətbiq edilir|IP
security|login hadiselerine gore qeyri adi davranis secildi|davranış
security|rol qaydalarinda privilege escalation riski var|rol
security|gizli acar repo daxilinde qalmamalidir|repo
security|xarici domenlere istek yalniz allowlist ile icazəlidir|domen
security|sifrelenmis faylin backup surəsi de korunur|faylın
security|public linkin etibarliliq muddeti qısaldıldı|linkin
security|security review neticesi issue kimi qeyd edildi|review
frontend|textarea yazisini copy duymesi ile kocururuk|textarea
frontend|rich text editor secilen ifadeni qalın edir|editor
frontend|klaviatura ile sekmeler arasinda kecid islesin|klaviatura
frontend|mobil ekranda duymeler metni ortmesin|mətn
frontend|a11y yoxlamasi duymenin labelini tapa bilmedi|labelini
frontend|brauzer back duymesi secimi itirmesin|brauzer
frontend|form validation yanlis saheye fokus verir|validation
frontend|dark mode secimi local storage de qalir|mode
frontend|loading spinneri proses tamamlananda dayansin|spinneri
frontend|copy clipboard icazesi olmayanda xeta goster|clipboard
frontend|css grid kicik ekranlarda bir sutuna dusur|grid
frontend|react state deyisende counter gecikir|React
frontend|undo emeliyyati son duzelisi geri qaytarir|undo
frontend|textarea ucun maksimum simvol sayi gosterilir|simvol
frontend|screen reader bildiris metnini seslendirir|reader
frontend|formatlanan siyahi html kimi kopyalanir|siyahı
frontend|paste ile daxil olan script silinmelidir|script
frontend|yeni font yuklenenə kimi fallback yazisi gorunur|font
frontend|responsive menyuda secilmis moda adini goster|menyuda
frontend|drag drop fayl yuklenmesinde boş content yoxlanir|fayl
analytics|hesabat panelinde bu ayin umumilikde otuz muracieti var|hesabat
analytics|qrafikde tarix filtrine esasen melumat deyisir|filtrinə
analytics|export edilen csv faylinda ayirici verguldur|CSV
analytics|gundelik saygac eyni muracieti iki defe sayib|sayğac
analytics|dashboard ucun yeni performans gostericisi elave edilib|göstəricisi
analytics|power bi modelinde vacib dimension catismir|modelində
analytics|sql sorgusu filial uzre nəticəni qruplasdirir|filial
analytics|uzun muddetli trend ucun kecmis aylar lazimdir|trend
analytics|real vaxt hesabatinda cache muddeti azaldildi|hesabatında
analytics|grafikdə sıfır değer bos gosterilmesin|sıfır
analytics|excel importunda tarix formatı uyğunsuzdur|Excel
analytics|gostericinin mənbəyi hesabatin altinda yazilsin|mənbəyi
analytics|audit hesabatinda ferdi melumatlar maskalansin|məlumatlar
analytics|chart legendasi mobil ekranda gorunmur|mobil
analytics|gorevlerin orta icra muddeti gunle hesablanir|müddəti
analytics|aynı sahə iki dashboardda ferqli adla gosterilir|dashboard
analytics|hefte uzre filter edende netice sifira dusur|nəticə
analytics|statistik hesabatda yubanan senedler qirmizi olsun|sənədlər
analytics|vizuallasdirmada bos kateqoriya ucun etiket qoyuldu|kateqoriya
analytics|raportun son yenilenme vaxti panelde gorunur|vaxtı
testing|uat senarisinde iki addim buraxilib|ssenarisində
testing|regression test son versiyada qirildi|test
testing|integration testi sandbox tokeni ile kecdi|testi
testing|unit test cox uzun cekdiyi ucun timeout oldu|timeout
testing|qa komandasi xetani tekrar ede bilmedi|komandası
testing|bug report ucun ekran goruntusu elave olunub|report
testing|test datasindaki fin kodu heqiqi sexse aid olmasin|kod
testing|load testde 1000 paralel sorğu gonderildi|1000
testing|e2e ssenarisinde yeni dropdown acilmir|dropdown
testing|mock cavabinda null status ucun hal yazilmali|status
testing|test coverageda auth modulu eksikdir|modulu
testing|snapshot testi stil deyisende yenilendi|testi
testing|release candidate uat testinden sonra buraxilacaq|UAT
testing|kontrakt testi yeni api schema sini yoxlayir|API
testing|qa test planina riskli prosesleri elave edib|test
testing|stress testde server response vaxti artdi|server
testing|sınaq fayli max simvol limitine çatir|simvol
testing|test environmentda vaxt zonasi ferqlidir|vaxt
testing|accessibility testi kontrasti olcdu|testi
testing|sifaris axini ucun boundary test lazimdir|test
migration|kohne sistemden uc min sened kocurulub|sənəd
migration|miqrasiya zamani yalniz aktiv istifadeciler secilsin|aktiv
migration|etibar edilmeyen tarix deyerleri temizlenmelidir|tarix
migration|yeni bazaya fayl elaveleri ayrica yuklenir|fayl
migration|kocurulme neticesinde bir qeyd eksikdir|qeyd
migration|miqrasiya skripti ikinci defe isleyende eyni yazini yaratmasin|skript
migration|musteri kodlari kohne sistemle tutusdurulur|kodları
migration|test serverinde köhnə bazanın kopyası saxlanır|bazanın
migration|cutover plani gece saat on ikide baslayacaq|planı
migration|rollback zamani kohne bazaya yazma acilmasin|bazaya
migration|fayl adlarindaki uyğunsuz simvollar temizlendi|fayl
migration|mesaj novbesi bosaldilanda esas kecid edilir|keçid
migration|her paket ucun satir sayi ayrica hesablansin|paket
migration|kocurulmus datanin butovluyu heşle yoxlanilir|bütövlüyü
migration|senedlerin yarisinda bagli icraci tapilmadi|icraçı
migration|eski id ile yeni id arasinda xeritə saxlayiriq|xəritə
migration|miqrasiya sınağı yeniden aparilmadan canliya cixilmasin|sınağı
migration|server saatlari senkron deyilse tarixler səhv gedir|server
migration|arxivlesdirme hissesi diger moduldan sonra kocurulecek|arxiv
migration|yekun kontrol siyahisi cavabdeh sexse gonderildi|siyahısı
workflow|tapşiriq bir icracidan digerine gonderildi|icraçıdan
workflow|workflow qaydasi yeni filial ucun acilmadi|workflow
workflow|avtomatik eskalasiya muddeti iki gun təyin edildi|müddəti
workflow|sənəd geri qaytarilanda status layihə olur|status
workflow|icraci qeyd elave edende rehbere bildiris gedir|rəhbərə
workflow|gonderis duymesi tamamlanmis isde baglidir|düyməsi
workflow|bir nece imzaci paralel seçilə bilmir|imzaçı
workflow|mərhələ sirasi idare panelinden deyisir|mərhələ
workflow|sistem deadline bitende mesul sexse xatirlatma atir|məsul
workflow|workflow versiyasi sened yaradilan anda sabitlenir|versiyası
workflow|tesdiq addimi ləgv olunanda icraya kecid dayanir|təsdiq
workflow|eski is axinlari her hefte arxivlenir|axınları
workflow|sifaris formasi gonderilenden sonra task acilir|task
workflow|operator icrani baslatmaq ucun sehife yenilemelidir|səhifə
workflow|alt tapşiriq baglananda ana tapşiriq da baglanmasin|tapşırıq
workflow|delegasiya edilmis is geri alina bilir|iş
workflow|butun approverler razilasanda novbeti addim acilir|addım
workflow|musteri sorğusunun prioriteti sonra deyise bilir|prioriteti
workflow|icra muddeti yalniz mesul sexs terefinden uzadilir|müddəti
workflow|tekrar acilan tapşiriq icin yeni tarix qoyulur|tarix
network|vpn baglantisi kesilende sened yuklenmesi yarimciq qaldı|VPN
network|dns cavabi kohne ip unvanina gedir|DNS
network|firewall yeni porta girisi bloklayib|porta
network|proxy vaxti bitmis sertifikati qebul etmir|sertifikatı
network|packet loss sebebi ile imza servisi lengiyir|servisi
network|filialdaki kanal genisliyi kifayet etmir|filialdakı
network|load balancer bir nodu dovriyyeden cixardi|nodu
network|websocket baglantisi arxa planda baglanir|bağlantısı
network|nat qaydasi xarici api ni yanlis servere yonlendirir|serverə
network|tcp timeout on saniyəyə ayarlandi|TCP
network|reverse proxy request body ni kesir|request
network|http2 ile kocurulme zamani basliq itir|başlıq
network|monitorinqde disk latency artimi gorunur|disk
network|cdn kesinde kohne js fayli qalib|CDN
network|s3 bucket icazesi fayl yuklemeye imkan vermir|fayl
network|security group yeni subnetden trafiki buraxmir|trafiki
network|health check pathi yanlis verilib|pathi
network|network policy podlar arasindaki sorgunu bloklayir|sorğunu
network|tunel berpa olunandan sonra sesiya davam etdi|tunel
network|sistem diski doldugu ucun baglanti yoxlamasi dayandi|disk
payments|odenis emeliyyatina tekrarlanan request gonderilib|ödəniş
payments|bank cavabi gecikende sifaris gozlemede qalir|sifariş
payments|refund yalniz təsdiqlenmis əməliyyat ucun aciqdir|refund
payments|odenis identifikatoru audit ucun saxlanilsin|identifikatoru
payments|kart melumatlari server jurnalina dusmemelidir|kart
payments|qebz pdf faylina cevrilende vergi kodu itdi|qəbz
payments|payment gateway 502 qaytardı amma bank debit etdi|502
payments|terminal transaction id sini iki defe istifade etdi|transaction
payments|abune avtomatik yenilenmeden evvel xeberdarliq geder|abunə
payments|hesab faktura ucun son odenis tarixi qeyd olunub|faktura
payments|iki valyuta arasinda cevirme kuru yenilendi|valyuta
payments|odenis gecikmesine gore xidmət dayandirilmadi|xidmət
payments|gateway callbacki ucun imza yoxlamasi lazimdir|callback
payments|test karti production muhitinde bloklanir|kartı
payments|maliye hesabatinda tekrarlanan mebleg cixir|məbləğ
payments|avtomatik geri odeme isteyi ucun sebeb secilir|səbəb
payments|qismən odeme qebul olunanda qaliq yeniden hesablanir|qalıq
payments|sifarisin vergisi umumi meblege daxil edilib|vergisi
payments|kart limitine catdigi ucun bank imtina etdi|bank
payments|emeliyyat neticesi sms ile de gonderilecek|SMS
notifications|sms bildirisi sehifede de gosterilir|SMS
notifications|email gonderisi ucun kuyruk dolub|email
notifications|mobil push icazesi olmayan istifadeci mesaj almadi|push
notifications|bildiris dili hesab ayarindan secilir|bildiriş
notifications|gece gonderilen xatirlatma sabah catdi|xatırlatma
notifications|eyni hadiseye uc bildiris yazilib|bildiriş
notifications|unsubscribe linki ile abunelik legv edildi|linki
notifications|bildiris template inde sened nomresi yanlisdir|nömrəsi
notifications|musteri cavab verdikde operatora xeber getsin|xəbər
notifications|kritik bildiris sessiya aciq olmasa da gosterilir|bildiriş
notifications|sifaris statusu deyisende sms gonderiləcək|statusu
notifications|həftelik xulaseni iki aliciya yolladiq|xülasəni
notifications|gonderis xetasi ucun retry sayi ucdur|retry
notifications|mesajin adi sadece admin panelinde görünür|mesajın
notifications|bildiris gonderilmezden evvel raziliq yoxlanir|razılıq
notifications|ekrana cixan mesajin linki kohne sayta gedir|linki
notifications|email unvaninin formatini dogrulayın|ünvanının
notifications|bildiris merkezi yeni mesajlari yukleyir|mərkəzi
notifications|istifadeci eyni bildiris ucun iki kanal secdi|istifadəçi
notifications|gonderis logunda yalniz redakte edilen metn qalib|mətn
documents|pdf faylinin icindeki imza gorunmur|PDF
documents|sənəd şablonunda ad soyad ferqli setirde cixib|şablonunda
documents|word faylindan kocurulen siyahi bozulub|Word
documents|html ile gelen qeydlerde script teqi silinmelidir|script
documents|excel faylinda tarix sutunu metn kimi oxunur|Excel
documents|sənədin son sehifesindeki qr kod oxunmur|kod
documents|elavelerin sayi kartda uc gosterilir|əlavələrin
documents|fayl yuklenende uzanti yoxlamasi aparilir|fayl
documents|skan edilmis senedde metn axtarisi islemir|sənəddə
documents|ocr neticesi operator terefinden yoxlanilmalidir|OCR
documents|sənəd səhifələri birleşdirilende sira deyisib|sıra
documents|mektub başlığında qeydiyyat nomresi qirilib|nömrəsi
documents|sablondaki mətn yazi tipini saxlamalidir|şablondakı
documents|fayl adindaki iki bosluq yuklemeye mane olur|boşluq
documents|sənəd formati pdf a cevrilende cədvəl itir|cədvəl
documents|qovluqdaki butun fayllar zip arxivine yigilmisdir|ZIP
documents|elektron senedin surətini ayni nömrə ilə saxla|nömrə
documents|docx faylini redakte edende layout qırılır|DOCX
documents|sənədin daxili linki eksportdan sonra islemir|linki
documents|metadata saheleri acilanda tarix olmur|metadata
support|musterinin sorğusu texniki desteye yonlendirildi|dəstəyə
support|bilet baglanmadan evvel musteriden tesdiq alinmalidir|müştəridən
support|kritik xeta ucun novbetci muhendis cagirildi|mühəndis
support|istifadeci eyni problemi uat muhitinde gorub|UAT
support|agent muracietin ekran goruntusunu istədi|müraciətin
support|sualin cavabi bilik bazasinda tapilmir|bilik
support|bilet prioriteti yanlış seçildiyi ucun sla kecdi|prioriteti
support|problem bas verdiyi saat qeyd edilmeyib|saat
support|texniki destek operatoru zengden sonra qeyd yazdı|qeyd
support|ticket statusu hell olundu olaraq baglandi|statusu
support|musteriye cavab ucun yeni şablon lazimdir|müştəriyə
support|komanda jurnalda sebeb tapmadan bilet baglamasin|səbəb
support|sorgu tekniki yox biznes sualidir|biznes
support|escallation gedəndə menecere de bildiris gonderilsin|menecerə
support|istifadeci uc gun sonra eyni xetani bildirdi|istifadəçi
support|support biletindeki fayl yalniz komanda ucun aciqdir|fayl
support|ilk cavab vaxti iki saatdan artiq cekdi|cavab
support|planlasdirilmis isler ucun musterilere bildiris geder|bildiriş
support|hansi addimda problem yarandigini soruşaq|problem
support|tekrar acilan biletin evvelki yazilari saxlanilir|yazıları
planning|srs senedindeki funksional telebler hələ təsdiqlənməyib|SRS
planning|bpmn diaqraminda ikinci iştirakci çatışmır|BPMN
planning|uat qebul meyarini musteriye gonderdik|UAT
planning|backlogda eyni task iki sprintde gorunur|backlog
planning|story point hesabi komanda terefden deyisdirildi|story
planning|acceptance criteria hazir olmadan is baslamasin|criteria
planning|product owner yeni scope artimini qebul etmədi|owner
planning|planlanan release tarixi risk jurnalinda qeyd olundu|release
planning|risk matrisi ucun cavabdeh sexs teyin edildi|risk
planning|musteri muqavile maddesine yeni qeyd elave edib|qeyd
planning|konsepsiya sənədində inteqrasiya xeritəsi natamamdır|xəritəsi
planning|komanda sifaris axinini lucidchartda cekdi|axınını
planning|prototipdə istifadeci rolu aydin deyil|istifadəçi
planning|toplanti protokolunda yeni qerar eksikdir|qərar
planning|change request onaylanana kimi budce artmayacaq|request
planning|roadmap ucun texniki borc ferqli rengle gosterilsin|roadmap
planning|tapsirigin asılılığı jira ticketinde yazılıb|Jira
planning|confluence sehifesinde son kararın sahibi bilinmir|Confluence
planning|sprint demo musteriye cersenbe gunu gosterilecek|sprint
planning|business requirement ile texniki spesifikasiya uyğunsuzdur|spesifikasiya
"""


def lines(block):
    return [row.strip().split('|', 2) for row in block.splitlines() if row.strip()]


rsd_rows = lines(RSD)
assert len(rsd_rows) == 460, len(rsd_rows)
assert len({row[1] for row in rsd_rows}) == 460
rsd_cases = [dict(id=f"rsd-it-{i:03}", domain=d, input=raw, anchor=anchor)
             for i, (d, raw, anchor) in enumerate(rsd_rows, 1)]
(ROOT / 'tests/fixtures/rsd-it-holdout.json').write_text(
    json.dumps(rsd_cases, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

# Unique author-written business events, organized by correspondence purpose.
# The exact body is distinct from the RSD/IT corpus above; subject and audience
# are metadata, and shape rotates across ordinary, compact and no-subject mail.
MAIL = """
qeydiyyat|müştəri|Yeni müraciət|qəbul etdiyimiz müraciətin izləmə kodu sabah şəxsi kabinetinizdə görünəcək
qeydiyyat|operatorlar|Səhv qeyd|dünən daxil olan sənəd yanlış tarixlə qeydə alınıb zəhmət olmasa kartını yeniləyin
qeydiyyat|Aysel xanım|Əlavə fayl|göndərdiyiniz ərizənin əlavəsi görünmür onu bir daha yollamağınızı xahiş edirik
qeydiyyat|Elvin bəy|Qeydiyyat cavabı|rəsmi məktubunuz qəbul edildi nəticə hazır olanda sizə ayrıca məlumat verəcəyik
qeydiyyat|katiblik|Gələn poçt|kağız məktubun əsli çatıb elektron surətin qeydiyyat kodu ilə tutuşdurulması lazımdır
qeydiyyat|filial rəhbəri|Günlük say|bu gün qəbul edilən ərizələrin sayı dünənkindən çoxdur axşam yekun siyahını paylaşacağıq
qeydiyyat|müraciətçi|Yanlış ünvan|müraciətinizdəki çatdırılma ünvanını dəqiqləşdirməyinizə ehtiyac var
qeydiyyat|arxiv qrupu|Qeydiyyat surəti|imzalı sənədin surəti sizə göndərilib əsli isə sabah təhvil veriləcək
qeydiyyat|komanda|Təkrar sənəd|eyni nömrə ilə iki sənəd daxil olub lütfən yalnız yeni olanı emal edin
qeydiyyat|sənəd sahibi|Təsdiq gözlənilir|ərizəniz hələ təsdiq mərhələsindədir tamamlandıqdan sonra bildiriş alacaqsınız
qeydiyyat|Nigar xanım|Geri qaytarılan forma|formadakı əlaqə nömrəsi natamamdır yenilənmiş variantı göndərə bilərsinizmi
qeydiyyat|dəstək heyəti|Yanlış kateqoriya|müraciət səhv kateqoriyaya düşüb onu aidiyyəti növə keçirməyinizi xahiş edirik
qeydiyyat|müştəri nümayəndəsi|Çatdırılma sübutu|poçtla göndərilən məktubun çatdırılma qəbzini aldıq və sənədə əlavə etdik
qeydiyyat|qeydiyyat şöbəsi|Tarix uyğunsuzluğu|ərizə üzərində yazılan tarix sistem vaxtından bir gün geridədir bunu yoxlayın
qeydiyyat|təmsilçi|Ərizə nömrəsi|sizə verilən qəbzdəki nömrəni gələcək yazışmalarda qeyd etməyinizi xahiş edirik
qeydiyyat|admin qrupu|Yeni forma|müraciət forması yenilənib köhnə keçid artıq yeni səhifəyə yönləndirilir
qeydiyyat|qarşı tərəf|İtmiş fayl|göndərişdə əsas sənəd yoxdur əlavələri ayrıca almışıq lakin ərizəni görmürük
qeydiyyat|məsul əməkdaşlar|Qəbul pəncərəsi|bu həftə fiziki sənədlər saat beşə qədər qəbul olunacaq
qeydiyyat|müştəri|Tamamlanan qeydiyyat|tələb etdiyiniz dəyişiklik sistemə işlənib onu şəxsi kabinetinizdə görə bilərsiniz
qeydiyyat|növbətçi qrup|Sıra artımı|qəbul bölməsində gözləyən müraciətlər çoxalıb əlavə operator ayrılmalıdır
derkenar|rəhbər|Dərkənar layihəsi|göndərdiyimiz layihənin icra məqsədini dəqiqləşdirməyinizi xahiş edirik
derkenar|icraçılar|Yeni tapşırıq|rəhbərin dərkənarı sizə həvalə olunub icra müddəti cümə günü başa çatır
derkenar|katiblik|Səhv təyinat|dərkənar yanlış icraçıya düşüb aidiyyəti əməkdaşa qaytarın
derkenar|Leyla xanım|İmza gözlənilir|hazırladığınız sənəd dərkənar təsdiqlənən kimi icraya ötürüləcək
derkenar|hüquq qrupu|Əlavə rəy|dərkənardakı hüquqi qeydə dair qısa rəyinizi sabaha qədər göndərin
derkenar|tərəfdaş|İcra statusu|dərkənar imzalanıb lakin icra hələ başlanmayıb bunun səbəbini araşdırırıq
derkenar|sənəd hazırlayanlar|Qeyd redaktəsi|imzadan sonra dərkənarın məzmunu dəyişməməlidir düzəlişi əvvəl edin
derkenar|Araz bəy|Yenidən baxış|əvvəlki dərkənarın məqsədi düzgün seçilməyib yeni layihəni təsdiqinizə təqdim edirik
derkenar|inzibatçı|Bildirilməyən qərar|dərkənar icraçıya ötürülüb amma hesabına bildiriş çatmayıb
derkenar|nəzarət şöbəsi|İcra müddəti|müddətin uzadılması üçün rəhbərin yazılı qərarı lazımdır
derkenar|komanda|Paralel icra|iki icraçı eyni dərkənarı alıb hər biri öz hissəsini ayrıca qeyd etməlidir
derkenar|məsul şəxs|Bağlanan dərkənar|icra tamamlanandan sonra nəticə faylını karta əlavə etməyi unutmayın
derkenar|Rəşad bəy|Geri çağırma|yanlış ünvanlanan dərkənar geri çağırılıb yeni variantı sizə göndərəcəyik
derkenar|audit qrupu|İmza tarixçəsi|dərkənarın tarixçəsində ikinci imza görünmür jurnalı yoxlayın
derkenar|müştəri nümayəndəsi|Rəhbər qeydi|müraciətinizə baxılır rəhbərin qeydi daxil olanda növbəti addımı bildirəcəyik
derkenar|texniki dəstək|Açılmayan əlavə|dərkənara əlavə olunmuş fayl bəzi istifadəçilərdə açılmır nümunəni göndərdik
derkenar|icraçı|Nəzarət üçün məlumat|tapşırıq üzrə görülən işi bu gün yekun qeydə yazmağınızı xahiş edirik
derkenar|filial meneceri|Müvəqqəti əvəzləmə|əsas imzaçı ezamiyyətdədir dərkənarı müvəqqəti əvəz edən şəxsə yönləndirin
derkenar|Nərmin xanım|Təsdiq xətası|dərkənarı imzalayanda səhv mesajı çıxır ekran görüntüsünü əlavə etmişəm
derkenar|layihə qrupu|Təkrar yoxlama|gələn cavaba əsasən dərkənarın icra mərhələsini bir daha yoxlamalıyıq
api|backend qrupu|GET xətası|GET /api/v1/documents endpointi səhər saatlarından 500 qaytarır logları əlavə etdim
api|frontend qrupu|Form cavabı|yeni POST sorğusunun body sahəsində bəzi məcburi açarlar yoxdur
api|inteqrasiya komandası|Callback ünvanı|tərəfdaşın callback URL-i dəyişib yenisini test mühitinə yazmağımız lazımdır
api|Emil bəy|Swagger sxemi|Swagger sənədində amount tipi string göstərilib halbuki müqavilədə number tələb olunur
api|məhsul sahibi|API dəyişiklikləri|v2 endpoint üçün geriyə uyğunluq testi sabah tamamlanacaq
api|müştəri|Gecikən cavab|sorğunuz serverə çatıb lakin cavab gecikir nəticəni aldıqdan sonra paylaşacağıq
api|DevOps komandası|429 cavabı|rate limit həddini keçən sorğular üçün 429 qaytarılmasını yoxladıq
api|təhlükəsizlik qrupu|Token icazəsi|müddəti bitmiş tokenlə sorğu göndərə bilirik bu davranış araşdırılmalıdır
api|analitiklər|API contract|yeni response schema qəbul meyarlarından fərqlənir rəyinizi bildirin
api|Kamran bəy|Webhook təkrarı|eyni hadisənin iki dəfə çatdığı görünür idempotency key yoxlanmalıdır
api|test komandası|Pagination sınağı|son səhifənin cursor dəyəri boş gəlir əlavə test yazdıq
api|platforma qrupu|Timeout təklifi|böyük fayl sorğularında timeout artırılsa da performans ayrıca ölçülməlidir
api|vendor komandası|Authorization header|sorğularınızda Authorization header yoxdur ona görə xidmət 401 cavabı verir
api|Aysel xanım|OpenAPI dəqiqləşdirməsi|göndərdiyiniz OpenAPI sənədində üç response kodu qeyd edilməyib
api|servis sahibləri|Gateway marşrutu|gateway yeni ünvanı köhnə backend servisinə yönləndirir düzəlişi planladıq
api|Nihat bəy|gRPC əlaqəsi|gRPC müştərisi yeni protobuf faylı ilə işləməyəndə hansı xəta görünür
api|mobil komanda|Payload ölçüsü|mobil tətbiqdən gələn payload limiti keçib fayl yükünü bölmək lazımdır
api|operatorlar|Təkrar cəhd|xəta cavabı alan sorğunu avtomatik yenidən göndərərkən əməliyyat təkrarlana bilər
api|tərəfdaş|Sertifikat yenilənməsi|API sertifikatı dəyişdirilib yeni public key sənədini sizə göndəririk
api|monitorinq qrupu|Status kodları|bir neçə daxili xəta 200 kimi görünür xəritəni birlikdə yoxlayaq
security|təhlükəsizlik komandası|Şübhəli giriş|bu gecə bir hesabdan fərqli IP ünvanları ilə giriş cəhdləri qeydə alınıb
security|müştərilər|Şifrə yenilənməsi|hesabınıza aid şifrəni yeniləmək üçün gələn keçiddən yalnız bir dəfə istifadə edin
security|audit qrupu|İcazə siyahısı|gizli sənədlərə baxış hüququ olan şəxslərin siyahısını göndəririk
security|Elçin bəy|Sertifikat bitməsi|TLS sertifikatının vaxtı bazar günü bitir yenilənməni əvvəlcədən planlaşdıraq
security|admin heyəti|Yeni rol qaydası|müvəqqəti əvəzləmə icazəsi avtomatik ləğv olunmur bunun üçün yoxlama lazımdır
security|məhsul komandası|İki faktorlu giriş|yeni 2FA addımı mobil tətbiqdə də sınaqdan keçirilməlidir
security|müştəri nümayəndəsi|Məxfi məlumat|göndərdiyiniz ekran görüntüsündə şəxsi məlumat görünür onu maskalanmış formada paylaşın
security|texniki tərəfdaş|Webhook imzası|mesajları imzasız qəbul etdiyimiz üçün endpoint müvəqqəti bağlanıb
security|rəhbərlik|Penetrasiya testi|test zamanı iki orta riskli problem aşkarlanıb düzəliş tarixlərini təqdim edəcəyik
security|tərtibatçılar|Gizli açar|repo tarixində təsadüfən qalan açar ləğv edilib yenisi təhlükəsiz kanalla paylaşılacaq
security|filial əməkdaşları|Sessiya müddəti|istifadəçi uzun müddət fəaliyyətsiz qaldıqda hesabdan çıxış edilməlidir
security|şəbəkə qrupu|Firewall dəyişikliyi|yeni qayda imza xidmətinə girişi bloklayıb ünvanları dəqiqləşdirin
security|Səbinə xanım|Fayla icazə|bu linki yalnız sənədin aid olduğu şöbənin əməkdaşları aça bilərlər
security|monitorinq qrupu|Şifrə sızması|test jurnalında yanlışlıqla yazılan şifrə silinib hadisə ayrıca qeydə alınıb
security|layihə meneceri|Təhlükəsizlik rəyi|buraxılışdan əvvəl zəifliklərin aradan qaldırıldığını təsdiqləyən hesabat istəyirik
security|servis komandası|CSRF yoxlaması|form göndərərkən tokenin yoxlanmadığı köhnə route aşkar edilib
security|müştəri|Giriş məhdudiyyəti|səhv şifrə cəhdlərindən sonra hesabınız müvəqqəti bloklanıb dəstəyə müraciət edin
security|Nigar xanım|Paylaşım keçidi|sənəd keçidinin etibarlılıq müddəti bitib sizə yenisini göndərə bilərik
security|hüquq komandası|Məlumat saxlanması|saxlanma müddətinin yeni qayda ilə uyğunluğu barədə rəy lazımdır
security|sistem administratoru|Backup icazəsi|ehtiyat nüsxəyə çıxış yalnız ayrıca səlahiyyətlə verilməlidir
data|analitiklər|Hesabat fərqi|iki paneldə eyni göstəricinin fərqli çıxmasının səbəbini araşdırırıq
data|maliyyə şöbəsi|Ödəniş çıxarışı|aylıq çıxarışdakı üç əməliyyatın qəbzi əlavə edilməyib
data|DBA komandası|İndeks planı|axtarış yavaşladığı üçün qeydiyyat nömrəsinə ayrıca indeks təklif edirik
data|Araz bəy|Köçürülən qeyd|köhnə bazadan gətirilən məlumatda bir tarix sahəsi boş görünür
data|məhsul sahibi|Miqrasiya yekunu|ilkin köçürmə bitib lakin sayların tutuşdurulması hələ davam edir
data|rəhbərlik|Analitika paneli|gündəlik müraciət sayı real vaxtda yenilənmir səbəbi cache müddətidir
data|test komandası|Təkrar yazı|miqrasiya skripti təkrar işlədiləndə ikinci nüsxə yaratmamalıdır
data|Elvin bəy|SQL sorğusu|hesabat sorğusunda son ay üzrə filtr düzgün tətbiq olunmur
data|operatorlar|Boş məlumat|telefon nömrəsi olmayan şəxslərə SMS göndərməzdən əvvəl seçim yoxlanmalıdır
data|vendor|Fayl bütövlüyü|köçürülmüş faylların hash dəyərləri mənbə ilə uyğun gəlir
data|komanda|CSV kodlaması|ixrac olunan CSV-də Azərbaycan hərfləri səhv göstərilir
data|müştəri|Məlumat düzəlişi|profilinizdəki soyadın yeni yazılışını aldıq yoxlamadan sonra yeniləyəcəyik
data|arxiv qrupu|Saxlanma müddəti|müddəti bitən sənədlər üçün avtomatik silmə hələ aktiv deyil
data|filial rəhbəri|İllik göstərici|hesabatın son versiyasında iki filialın rəqəmləri yer dəyişib
data|admin heyəti|Redis cache|Redis açarları yenilənməyəndə köhnə istifadəçi rolu göstərilə bilər
data|məhsul analitikləri|Tarix zonası|səhər əməliyyatlarının bir hissəsi UTC vaxtına görə dünənə düşüb
data|təhlükəsizlik qrupu|Maskalanma testi|ixrac faylında şəxsi nömrə görünməməlidir nümunəni yoxlayın
data|Rəna xanım|Excel əlavəsi|göndərdiyiniz Excel cədvəlində ikinci vərəq boş çıxır
data|mühəndislər|DB bağlantısı|bağlantı hovuzu dolduğu üçün bəzi sorğular növbədə gözləyir
data|müşahidə qrupu|Audit yazıları|bu gecə yaranan qeydlərin sayı hesablanan göstəricidən azdır
devops|platforma komandası|Production deploy|yeni versiya production mühitinə çıxıb health check nəticəsi normaldır
devops|rəhbərlik|Buraxılış vaxtı|növbəti release cümə axşamı saat altıda nəzərdə tutulub
devops|müştəri|Planlı fasilə|sistemə texniki xidmət zamanı girişdə qısa gecikmə ola bilər
devops|Nicat bəy|Build xətası|CI pipeline içində typecheck mərhələsi uğursuzdur logun son hissəsini göndərirəm
devops|mühəndislər|Rollback sınağı|geri dönüş addımının ehtiyat mühitdə işlədiyini təsdiqləməliyik
devops|monitorinq qrupu|CPU artımı|dünən gecə CPU istifadəsi artsa da xidmət dayanmayıb
devops|layihə komandası|Feature flag|yeni funksiya yalnız test istifadəçiləri üçün açıq olacaq
devops|DevOps qrupu|Kubernetes pod|pod restart dövrünə düşüb yaddaş limitini ayrıca ölçün
devops|servis sahibləri|DNS yenilənməsi|yeni domen qaydası bütün regionlara yayılmayıb bir az gözləyək
devops|müştəri meneceri|Staging nəticəsi|staging mühitində sınaqlar keçib production üçün təsdiq gözləyirik
devops|operatorlar|Yüklənmə həddi|gündəlik pik vaxtlarda cavab müddəti uzanır əlavə resurs ayrılacaq
devops|infrastruktur qrupu|Sertifikat yoxlaması|yenilənən sertifikat köhnə container daxilində görünmür
devops|Aysel xanım|Deploy planı|mövcud versiya ehtiyatda qalacaq dəyişiklik tamamlananda sizə yazacağıq
devops|sınaq qrupu|Test mühiti|yeni environment dəyişənləri yalnız sınaq serverinə yazılıb
devops|vendor dəstəyi|Regional gecikmə|bəzi sorğular fra1 regionunda daha gec cavablanır
devops|texniki komanda|Disk dolması|serverdə boş yer azalıb jurnal fayllarını təhlükəsiz qaydada dövr etdirək
devops|məhsul sahibi|Canlı tarix|planlanan tarixdən əvvəl yeni versiya avtomatik buraxılmasın
devops|Elçin bəy|GitHub əlaqəsi|main branch-dəki son commit Vercel build ilə eynidirmi bunu yoxlayın
devops|gözləmə növbəsi|Müdaxilə qeydi|nasazlıq zamanı növbətçi heyətə birbaşa xəbər göndərilsin
devops|rəhbər heyət|Performans nəticəsi|bu həftəki yük sınağının p95 cavab müddətini hesabata əlavə etdik
testing|QA komandası|UAT meyarları|son test planında təsdiq meyarının bir bəndi yoxdur
testing|məhsul sahibi|Demo nəticəsi|nümayişdə görünən xətanı ayrıca ticket kimi qeydə aldıq
testing|Aysel xanım|Test faylı|dünən paylaşdığınız PDF sınaqda açılır amma imza yoxlaması uğursuzdur
testing|tərtibatçılar|Regressiya|köhnə davranış yeni dəyişiklikdən sonra pozulub nümunəni əlavə etdim
testing|müştəri|Yenidən sınaq|bildirdiyiniz problemə düzəliş edilib onu test mühitində yoxlaya bilərsiniz
testing|analitik qrupu|Kənar hal|boş siyahı ilə təsdiq düyməsinin davranışı tələblərdə göstərilməyib
testing|Rauf bəy|Yük sınağı|min paralel istifadəçi ilə sınaqda cavab vaxtı artır
testing|menecer|Buraxılışa hazırlıq|iki kritik xəta hələ açıqdır buraxılış qərarını sonraya saxlayaq
testing|sənəd müəllifləri|Nümunə kart|test sənədində həqiqi şəxsin məlumatı olmamalıdır
testing|əlaqə qrupu|Sınaq dəvəti|gələn çərşənbə qəbul testini birlikdə keçirəcəyik
testing|komanda|Retry sınağı|eyni bildiriş iki dəfə gələndə yalnız bir tapşırıq yaranmalıdır
testing|Səma xanım|Mobil test|kiçik ekranda təsdiq pəncərəsinin son düyməsi görünmür
testing|frontend qrupu|Əlçatanlıq|klaviatura ilə forma səhvlərinə keçid tam işləməyib
testing|backend qrupu|Kontrakt testi|yeni API cavabında əvvəl məcburi olan sahə artıq yoxdur
testing|monitorinq qrupu|Uzun sorğu|sınaq zamanı beş saniyədən uzun çəkən sorğular ayrıca qeydə alınıb
testing|filial operatorları|Pilot mərhələ|pilot qrupda yaranan sualları ümumi siyahıya əlavə edin
testing|Elvin bəy|Ekran görüntüsü|problemi təkrarlamaq üçün göndərdiyiniz addımların üçüncüsü aydın deyil
testing|layihə sahibi|Yekun protokol|bütün test nəticələrini protokolda təsdiq etməzdən əvvəl yoxlayacağıq
testing|texniki dəstək|Xəta nümunəsi|status dəyişməyən müraciət nümunəsini ayrıca paylaşdıq
testing|vendor qrupu|Sandbox token|göndərdiyiniz sandbox tokenin vaxtı bitib yenisini rica edirik
workflow|icraçılar|Yeni marşrut|yeni sənəd növü artıq başqa təsdiq marşrutuna yönləndirilir
workflow|rəhbər|Paralel razılaşdırma|iki şöbənin rəyi eyni vaxtda toplanacaq qərarı sonra verəcəyik
workflow|katiblik|İcraçı dəyişməsi|əvvəlki icraçı məzuniyyətə çıxıb sənədi əvəzediciyə göndərin
workflow|müştəri|Müraciətin mərhələsi|müraciətiniz baxışdadır yekun qərar hazır olanda xəbər verəcəyik
workflow|sənəd qrupu|Təsdiq sırası|imza addımı razılaşdırmadan sonra gəlməlidir cari qaydanı yeniləyin
workflow|admin heyəti|Eskalasiya vaxtı|gecikən tapşırıqlar üçün xatırlatma yalnız iş günlərində göndərilsin
workflow|Nigar xanım|Geri qaytarılan sənəd|sənəd düzəliş üçün sizə qaytarılıb qeyddə çatışmayan sahələr yazılıb
workflow|menecer|İş axını|yekun addımda sənəd arxivə düşmür və açıq statusda qalır
workflow|əlaqəli şöbələr|Yeni təsdiq|birgə icra qaydasını təsdiqləmədən sənədi növbəti mərhələyə göndərməyin
workflow|audit komandası|Marşrut tarixçəsi|qaytarılan sənədin əvvəlki icraçıları tarixçədə görünməlidir
workflow|Araz bəy|Təyinat sualı|bu tapşırığın hansı qrupa aid olduğunu dəqiqləşdirməyə kömək edin
workflow|texniki komanda|Bağlı düymə|təsdiq düyməsi yalnız ikinci mərhələdə səhvən bağlı qalır
workflow|müştəri nümayəndəsi|Gözləmə statusu|əlavə sənəd çatmadığından müraciətiniz gözləməyə keçirilib
workflow|icra rəhbəri|Prioritet artımı|bu müraciətə bu gün cavab verilməlidir onu üst sıraya keçirin
workflow|proses sahibi|Yeni şərt|maliyyə razılığı tələb olunan hallarda əlavə addım açılsın
workflow|Rəna xanım|Yanlış bildiriş|iş sizə aid olmasa da hər səhər xatırlatma alırsınız bunu araşdırırıq
workflow|filial nümayəndəsi|Müddət sorğusu|tapşırığın icra müddəti nə vaxt başlayır açıqlamanızı gözləyirik
workflow|məhsul analitikləri|Workflow versiyası|köhnə sənədlər yeni marşruta avtomatik keçirilməməlidir
workflow|operator heyəti|Əlavə mərhələ|yeni sənəd növündə reyestr yoxlaması imzadan əvvəl aparılacaq
workflow|məsul şəxs|Tapşırıq bağlanması|nəticə faylını əlavə etdikdən sonra işi yekunlaşdıra bilərsiniz
archive|arxiv qrupu|Köhnə sənəd|soruşduğunuz məktub rəqəmsal arxivdə var kağız əsli isə anbardadır
archive|Aysel xanım|Arxiv çıxarışı|keçən ilin protokolundan çıxarış istəmisiniz onu hazırlayıb göndərəcəyik
archive|audit komandası|Saxlanma qaydası|bu kateqoriya sənədləri hələ silmək olmaz saxlanma müddəti davam edir
archive|müştəri nümayəndəsi|Surət sorğusu|imzalı sənədin elektron surətini bu gün təqdim edə bilərik
archive|filial şöbəsi|Köçürülən fayllar|köhnə sistemdən gələn faylların sayı ilkin siyahı ilə uyğun gəlmir
archive|katiblik|Səhv metadata|arxivdə olan sənədin tarixi yanlış yazılıb yoxlama üçün əslini istəyirik
archive|operatorlar|Axtarış qaydası|arxivdə sənədi tapmaq üçün tam qeydiyyat nömrəsini daxil edin
archive|Nərmin xanım|Qorunan sənəd|bu faylın saxlanma müddəti uzadılıb onu siyahıdan silməyin
archive|texniki dəstək|Açılmayan PDF|köhnə PDF faylının bəzi səhifələri düzgün açılmır alternativ surət axtarırıq
archive|rəhbərlik|Aylıq arxiv|bu ay arxivə göndərilən sənədlərin sayını hesabata əlavə etdik
archive|müştəri|Sənədinizin surəti|istədiyiniz sənədin surəti hazırdır şəxsi kabinetinizdən yükləyə bilərsiniz
archive|proses sahibi|Təhvil protokolu|kağız sənədləri arxivə təhvil verəndə siyahını da imzalamaq lazımdır
archive|sənəd işçiləri|İndeks yenilənməsi|axtarış nəticəsində yeni sənəd görünmür indeksin yenilənməsini gözləyirik
archive|İlqar bəy|Silinmə sorğusu|müraciətin silinməsi mümkün deyil çünki onun qanuni saxlanma müddəti bitməyib
archive|mühasibat|Qəbz arxivi|müqavilə qəbzlərinin elektron surətlərini ayrıca qovluqda saxladıq
archive|məsul əməkdaşlar|Arxiv icazəsi|yalnız təsdiq edilmiş rolu olan şəxs gizli qovluğa girə bilər
archive|layihə qrupu|Fayl bütövlüyü|köçürülən sənədlərin hash yoxlamasını yekun protokola əlavə edin
archive|təhlükəsizlik şöbəsi|Giriş jurnalı|arxivdən çıxarılan sənədlərin kim tərəfindən açıldığını göstərən jurnal lazımdır
archive|Rauf bəy|Arxiv cavabı|axtardığınız sənəd bu qovluqda yoxdur qeydiyyat tarixini bir daha dəqiqləşdirin
archive|komanda|Yekun saxlanma|bağlanan işlərin əlavələri ayrıca saxlanca köçürülüb
payments|müştəri|Ödəniş qəbzi|ödənişiniz uğurla qəbul olunub qəbzi şəxsi kabinetinizdə görə bilərsiniz
payments|maliyyə qrupu|İkiqat məbləğ|eyni hesab üzrə iki əməliyyat görünür bank cavabını gözləyirik
payments|Araz bəy|Hesab faktura|yenilənmiş hesab fakturanı təsdiq üçün göndəririk zəhmət olmasa baxın
payments|bank tərəfdaşı|Geri qaytarma|qaytarılma sorğusu yaradılıb nəticə üçün transaction kodunu izləyirik
payments|müştəri nümayəndəsi|Abunə yenilənməsi|illik abunə bitməzdən əvvəl sizə ayrıca xəbərdarlıq ediləcək
payments|mühasibat|Valyuta fərqi|göndərilən qəbzdə məbləğ AZN əvəzinə USD kimi göstərilib
payments|Nicat bəy|Kart limiti|əməliyyatınız bank tərəfindən rədd edilib kart limitinizi yoxlayın
payments|satış qrupu|Güzəşt tələbi|müştərinin tələb etdiyi güzəşt müqavilədə göstərilməyib təklif hazırlayaq
payments|müştəri|Natamam ödəniş|ödədiyiniz məbləğ hesabın hamısını bağlamır qalıq şəxsi kabinetdə görünür
payments|maliyyə rəhbəri|Gün sonu çıxarışı|bu günün ödənişləri ilə bank çıxarışı arasında fərq var
payments|texniki komanda|Gateway cavabı|gateway 502 göstərdi lakin bank əməliyyatı təsdiqlədi təkrar çəkməyin
payments|Leyla xanım|Vergi kodu|göndərdiyiniz hesab fakturada vergi kodu natamamdır yenisini rica edirik
payments|müştəri|İllik plan|illik plana keçmək istəyirsinizsə cari ayın sonuna qədər seçim edə bilərsiniz
payments|daxili audit|İtən qəbz|mart ayına aid iki qəbz elektron qovluqda yoxdur onları axtarırıq
payments|ödəniş qrupu|Callback imzası|bank callback mesajlarının imzasını yoxlamaq üçün yeni açar almışıq
payments|Aysel xanım|Büdcə təsdiqi|əlavə resurs xərci hələ təsdiqlənməyib icraya başlamayaq
payments|filial mühasibləri|Tarif siyahısı|yenilənmiş xidmət tarifləri gələn aydan qüvvədə olacaq
payments|müştəri|Refund müddəti|geri qaytarma sorğunuz baxışdadır vaxtı dəqiqləşəndə məlumat verəcəyik
payments|İlham bəy|Sifariş kodu|ödənişi tutuşdurmaq üçün sifariş nömrəsini bizə göndərin
payments|biznes qrupu|Ödəniş meyarı|qismən ödənişə icazə verilməsini müqavilə ilə tutuşduraq
documents|məhsul qrupu|Şablon dəyişikliyi|rəsmi məktub şablonunda loqo aşağı sürüşüb son versiyanı yoxlayın
documents|Aysel xanım|İmza görünmür|əlavə etdiyiniz PDF-də imza bölməsi boş görünür əsl faylı göndərə bilərsinizmi
documents|operatorlar|OCR nəticəsi|skan edilmiş sənədin mətnində iki ad səhv oxunub düzəlişi əl ilə yoxlayın
documents|arxiv komandası|DOCX versiyası|köhnə DOCX faylı açılarkən cədvəl sərhədləri itir
documents|müştəri|Yeni sənəd|istədiyimiz arayışı əlavə etdiyiniz üçün təşəkkür edirik baxışa başlayırıq
documents|hüquq şöbəsi|Müqavilə bəndi|dördüncü bənddəki tarix əvvəlki razılaşma ilə uyğun gəlmir
documents|rəhbərlik|Hesabat əlavəsi|aylıq hesabatın qrafikləri əlavədədir yekun mətn sabah göndəriləcək
documents|tərtibatçılar|Siyahı formatı|Word-dən köçürülən nömrəli siyahının sırası pozulub
documents|filial operatorları|QR kod|sənədin ikinci səhifəsindəki QR kod oxunmur yenisini çap edin
documents|Rəna xanım|Sənəd surəti|sizə lazım olan imzalı surəti bu gün e-poçtla göndərəcəyik
documents|təhlükəsizlik komandası|HTML əlavə|sənəd təsvirinə yapışdırılan HTML kodunda script var saxlamayın
documents|müştəri nümayəndəsi|Əlavə siyahısı|məktubda üç əlavə yazılıb lakin sizdən yalnız ikisini almışıq
documents|komanda|Fayl adı|uzun fayl adı yükləməni dayandırır sənədi qısa adla yenidən sınayın
documents|Nigar xanım|Açılmayan qovluq|paylaşdığınız ZIP arxivinə giriş şifrəsi göndərilməyib
documents|müqavilə qrupu|Versiya müqayisəsi|əvvəlki variantdan dəyişən bəndləri ayrıca rənglə işarələyin
documents|texniki dəstək|Səhifə sırası|birləşdirilmiş faylda üçüncü səhifə ən sona keçib
documents|Səbinə xanım|Düzəliş üçün qaytarma|sənədin ünvan hissəsi natamamdır tamamlayıb yenidən yollayın
documents|kargüzarlıq|Təsdiqli nüsxə|möhürlü nüsxə hazırdır təhvil vaxtını dəqiqləşdirək
documents|vendor qrupu|Fayl limiti|xidmət on meqabaytdan böyük faylı qəbul etmir alternativi müzakirə edək
documents|şöbə müdiri|Qeydiyyat kodu|son səhifədəki qeydiyyat kodu köhnə sənədə aiddir
support|müştəri|Müraciətinizə baxış|bildirdiyiniz xəta qeydə alınıb texniki qrup nəticəni sizə paylaşacaq
support|növbətçi mühəndis|Təcili hadisə|xidmətin dayanması barədə iki filialdan xəbər almışıq logları yoxlayın
support|Aysel xanım|Problem nümunəsi|bu davranışı təkrarlamaq üçün hansı addımları etdiyinizi göndərin
support|texniki dəstək|Biletin yenidən açılması|bağlanan biletə eyni xətaya görə yeni qeyd yazılıb onu yenidən açın
support|filial rəhbəri|Cavab müddəti|kritik müraciətlərə ilkin cavab on beş dəqiqə ərzində verilməlidir
support|müştəri nümayəndəsi|İşləməyən keçid|sizə göndərdiyimiz link səhv açılır yeni keçid hazır olanda paylaşacağıq
support|komanda|Növbətçi siyahısı|bu həftə gecə növbəsində iki mühəndis olacaq əlaqə nömrələri əlavədədir
support|Elvin bəy|Xəta kodu|500 xətasının hansı əməliyyatda yarandığını dəqiqləşdirmək üçün vaxtı yazın
support|rəhbər heyət|Həftəlik icmal|bu həftə daxil olan texniki sorğuların əksəriyyəti giriş icazəsi ilə bağlıdır
support|operatorlar|Yanlış kateqoriya|bank əməliyyatı ilə bağlı sualı texniki nasazlıq kimi qeydə almayın
support|müştəri|Nəticə barədə məlumat|problemin səbəbi hələ müəyyən edilməyib təhlil bitəndə xəbər verəcəyik
support|Nərmin xanım|Yeni ekran görüntüsü|göndərdiyiniz görüntüdə xəta mesajı kəsilib tam şəkli rica edirik
support|əlaqə mərkəzi|Telefon müraciəti|zəng zamanı deyilən qeyd ticket tarixçəsində də olmalıdır
support|əsas komanda|Eskalasiya|birinci səviyyə məsələni həll edə bilməyib onu məhsul mühəndisinə ötürürük
support|test qrupu|Düzəliş sınağı|müştəridə görünən xəta testdə təkrarlanmır fərqli hesabla yoxlayaq
support|Kamran bəy|İcra vaxtı|bilet üzrə yekun həll tarixini indi deyə bilmirik ilkin nəticəni sabah paylaşacağıq
support|müştəri|Planlı işlər|şənbə günü keçiriləcək iş zamanı bəzi sorğular gec cavablana bilər
support|filial komandası|Yerində dəstək|mühəndisimiz sabah ofisinizdə cihazın bağlantısını yoxlayacaq
support|layihə qrupu|Bilik bazası|tez-tez verilən bu sual üçün yeni izah məqaləsi hazırlayaq
support|Rauf bəy|Təkrar əlaqə|bu gün əlaqə saxlaya bilmədik sizə uyğun vaxtı yazmağınızı xahiş edirik
planning|müştəri|Yeni tələblər|son görüşdə dediyiniz funksiyaları SRS sənədinə əlavə edib təsdiqə göndərəcəyik
planning|analitiklər|BPMN fərqi|diaqramdakı təsdiq addımı hazırkı proseslə uyğun deyil onu dəqiqləşdirək
planning|rəhbərlik|Sprint nəticəsi|iki tapşırıq tamamlanıb üçüncüsü isə məlumat gözlədiyi üçün açıq qalır
planning|Elvin bəy|Görüş vaxtı|texniki şərtləri müzakirə etmək üçün gələn çərşənbə sizə uyğundurmu
planning|məhsul sahibi|Backlog prioriteti|müştərinin yeni istəyi əvvəlki buraxılış planını dəyişə bilər
planning|test komandası|UAT cədvəli|qəbul sınağının iştirakçıları və tarixləri sənəddə yeniləndi
planning|hüquq qrupu|Razılaşma maddəsi|məxfilik bəndinə əlavə edilən şərti nəzərdən keçirməyinizi xahiş edirik
planning|müştəri nümayəndəsi|Demo dəvəti|yeni ekranların nümayişini cümə günü onlayn keçirəcəyik
planning|layihə komandası|Qərar protokolu|dünkü görüşdə razılaşdırılan üç qərarı protokola yazdıq
planning|Səma xanım|İnteqrasiya sualı|xarici xidmətin test məlumatlarını kim təqdim edəcək bunu dəqiqləşdirin
planning|rəhbər|Resurs planı|əlavə tester ayrılmasa hazırkı qrafikdə gecikmə ola bilər
planning|komanda|Sənəd təsdiqi|SRS-in son variantına rəy vermək üçün bu gün son gündür
planning|Araz bəy|Risk qeydiyyatı|vendor cavabının gecikməsi risklər siyahısına əlavə olunub
planning|müştəri|İcra mərhələləri|layihənin əsas addımlarını ayrıca cədvəldə sizə göndərmişik
planning|dizayn qrupu|Prototip rəyi|yeni ekranın rəng kontrastı ilə bağlı fikrinizi paylaşın
planning|maliyyə şöbəsi|Büdcə dəyişməsi|əlavə istək üçün lazım olan xərci hesablayıb təqdim edəcəyik
planning|filial koordinatorları|Təlim tarixləri|pilot filiallarda təlim gələn həftənin ilk günündə başlayır
planning|Nicat bəy|Jira tapşırığı|gördüyümüz xətanı Jira-da ayrıca task kimi qeyd etmişəm
planning|məhsul komandası|Son qərar|dəyişiklik təsdiqlənməyənədək production mühitinə çıxarılmayacaq
planning|rəhbərlik|Mərhələ hesabatı|bu rübdə tamamlanan işlərin siyahısı hesabatın əlavəsindədir
notifications|istifadəçilər|Bildiriş qaydası|sənədin statusu dəyişəndə hesabınıza avtomatik xəbər gələcək
notifications|mobil komanda|Push gecikməsi|göndərilən push mesajı bəzi cihazlarda yalnız tətbiq açıldıqdan sonra görünür
notifications|operatorlar|Təkrar xəbər|eyni hadisə üçün müştəriyə iki SMS getməməlidir
notifications|Aysel xanım|Yanlış ünvan|bildirişlər köhnə e-poçt ünvanınıza gedir yenisini təsdiqləyin
notifications|məhsul sahibi|Mesaj mətni|xəta bildirişində texniki kod əvəzinə sadə izah göstərilməlidir
notifications|təhlükəsizlik qrupu|Razılıq qeydi|reklam mesajı göndərilməzdən əvvəl istifadəçinin razılığı yoxlanmalıdır
notifications|filial rəhbərləri|Gündəlik icmal|hər gün saat doqquzda açıq tapşırıqlar barədə qısa icmal göndəriləcək
notifications|müştəri|Çatdırılmayan məktub|sizə yazdığımız cavab geri qayıdıb e-poçt ünvanınızı yoxlayın
notifications|rəhbərlik|Kritik xəbərdarlıq|sistem dayananda xəbərdarlıq həm SMS həm də e-poçtla çatmalıdır
notifications|Nərmin xanım|Abunə seçimi|həftəlik icmal almaq istəmirsinizsə profilinizdən seçimi bağlaya bilərsiniz
notifications|komanda|Mesaj şablonu|yeni şablondakı qeydiyyat nömrəsi boş çıxır dəyişəni yoxlayın
notifications|devops qrupu|Queue dolması|mesaj növbəsi dolanda sorğular yığılıb göndəriş dayanır
notifications|müştəri nümayəndəsi|Yeni əlaqə|sizin üçün yeni məsul əməkdaş təyin olunub əlaqə məlumatı aşağıdadır
notifications|analitiklər|Bildiriş dili|qeydiyyat ekranı Azərbaycan dilindədir amma xəbərdarlıq ingiliscə görünür
notifications|servis komandası|Retry müddəti|çatdırılmayan bildiriş üçün ikinci cəhd beş dəqiqə sonra edilsin
notifications|müştəri|Sorğu nəticəsi|yoxlama tamamlanıb cavab sənədiniz şəxsi kabinetinizə yerləşdirilib
notifications|Rəşad bəy|İtən xəbər|iş sizə göndərilib amma bildiriş almadığınızı yazmısınız jurnalı yoxlayırıq
notifications|keyfiyyət qrupu|Bildiriş testi|gecə gələn mesaj səhər göndərilmiş kimi görünür saat qurşağını yoxlayın
notifications|rəhbər köməkçisi|İclas xatırlatması|gələn həftənin iclası üçün dəvətlər bu gün paylaşılacaq
notifications|operator|Müraciət cavabı|müştərinin yazdığı e-poçta cavab verəndə qeydiyyat nömrəsini mövzuda saxlayın
network|şəbəkə qrupu|VPN kəsintisi|filialın VPN bağlantısı gecədən işləməyib şəbəkə qeydini əlavə etdim
network|Rəşad bəy|DNS yönləndirməsi|yeni domen hələ köhnə IP ünvanını göstərir dəyişiklik nə vaxt yayılacaq
network|vendor komandası|Firewall icazəsi|test servisinə çıxış üçün tələb olunan portlar əlavədə göstərilib
network|müştəri|Bağlantı çətinliyi|səhifəyə daxil olmaqda problem yaşayırsınızsa şəbəkə növünü bizə yazın
network|texniki dəstək|Proxy sertifikatı|şirkət proxy-si yenilənən sertifikatı qəbul etmir bunu araşdırın
network|DevOps qrupu|Yük bölgüsü|bir server yüklənib digəri boş qalır balancer qaydasına baxaq
network|Nicat bəy|Şəbəkə gecikməsi|imza xidmətinə sorğu göndərəndə daxili şəbəkədə gecikmə artır
network|təhlükəsizlik komandası|Açıq port|yeni açılan portun yalnız təsdiq edilmiş IP siyahısına icazəsi olsun
network|filial rəhbəri|İnternet kanalı|filialın əsas kanalı kəsilib ehtiyat kanalla iş davam edir
network|monitorinq qrupu|Paket itkisi|saat iki radələrində paket itkisi artıb qrafiki əlavə edirəm
network|müştəri nümayəndəsi|Fayl yükləmə|böyük fayllar yüklənərkən əlaqə qopur daha kiçik faylla sınaq edin
network|admin heyəti|WebSocket kəsilməsi|uzun sessiyalarda WebSocket bağlanır bildirişlər yenilənmir
network|məhsul qrupu|Regional bağlantı|bəzi regionlarda servisin cavabı daha gec gəlir ölçmələri paylaşdıq
network|operatorlar|Giriş şəbəkəsi|daxili panel yalnız şirkət şəbəkəsindən açılmalıdır
network|Aysel xanım|Router restartı|router yenidən işə düşəndən sonra əlaqə sabitləşibmi bizə yazın
network|server komandası|CDN faylı|brauzerə köhnə skript çatır CDN cache təmizlənməlidir
network|inteqrasiya qrupu|SSL xəbərdarlığı|xarici endpoint üçün sertifikat zənciri natamamdır
network|Rəna xanım|Giriş vaxtı|sizdəki xəta yalnız ofis xaricində yaranırmı bunu dəqiqləşdirin
network|filial texnikləri|WiFi sınağı|kabellə bağlantı işləyir lakin WiFi üzərindən giriş alınmır
network|şəbəkə rəhbəri|Tunel yenilənməsi|ehtiyat tunel qurulub əsas xətt bərpa olunana qədər aktiv qalacaq
frontend|dizayn qrupu|Yeni forma|mobil ekranda son təsdiq düyməsi görünmür yerləşimi yoxlayın
frontend|istifadəçilər|Mətn seçimi|redaktorda seçdiyiniz sözləri kursiv edə və dırnağa ala bilərsiniz
frontend|Aysel xanım|Kopyalama xətası|nəticə mətnini kopyalayanda siyahı nömrələri itir bunu yoxlayacağıq
frontend|test komandası|Yapışdırılan HTML|xarici saytdan gələn HTML təhlükəli atributlar olmadan saxlanmalıdır
frontend|məhsul sahibi|Yeni dizayn|oxunması çətin olan köməkçi mətn üçün kontrastı artıracağıq
frontend|Rauf bəy|Klaviatura keçidi|formadakı düymələrə Tab ilə keçid bəzən dayanır
frontend|mobil komanda|Kiçik ekran|mətn panelinin kənarı telefonda ekranın çölünə çıxır
frontend|operatorlar|Aydın xəta|yanlış formatda fayl seçəndə səbəbi ekranda göstərmək lazımdır
frontend|rəhbərlik|İstifadəçi rəyi|son sınaqda təmizləmə düyməsinin yerini tapmaq çətin olub
frontend|müştəri|Yeni imkan|şəxsi kabinetdə müraciət tarixçənizi artıq görə bilərsiniz
frontend|Nigar xanım|Boş səhifə|səhifəni yeniləyəndə seçdiyiniz sənəd növü itir
frontend|dizaynerlər|Gec yüklənən şrift|xarici şrift gələnə qədər mətn görünməz qalmasın
frontend|frontend komandası|Mətn sayğacı|yapışdırmadan sonra simvol sayğacı bir simvol az göstərir
frontend|məhsul analitikləri|Sadə menyu|yeni menyuda əsas əməliyyatları daha yuxarı yerləşdirək
frontend|əlaqə mərkəzi|Oxunmayan bildiriş|telefon ekranında xəbərdarlıq mətninin sonu kəsilir
frontend|Rəşad bəy|Geri qaytarma|son redaktəni Undo ilə geri almaq üçün düymə var
frontend|təhlükəsizlik qrupu|Yapışdırma yoxlaması|script daxil olan mətnin səhifədə icra edilmədiyini yoxlayın
frontend|sınaq iştirakçıları|Formun izahı|hansı sahələrin məcburi olduğu aydın görünməlidir
frontend|komanda|Kopyalama icazəsi|brauzer icazə vermirsə istifadəçiyə aydın xəbər göstərilməlidir
frontend|Leyla xanım|Seçilmiş format|qalın yazılmış cümlə redaktədən sonra da qalın qalmalıdır
training|filial işçiləri|Yeni təlim|sənəd qeydiyyatı üzrə təlim gələn həftə onlayn keçiriləcək
training|Araz bəy|Video yazı|keçən sessiyanın video yazısını paylaşmaq üçün icazə istəyirik
training|müştəri|İstifadə qaydası|şəxsi kabinetdən sənəd yükləmək üçün qısa bələdçi əlavə etmişik
training|inzibatçılar|Rol təlimi|yeni icazə matrisini tətbiq etməzdən əvvəl admin qrupunu təlimləndirək
training|Nərmin xanım|İştirak təsdiqi|çərşənbə günkü sessiyaya qatıla biləcəyinizi bildirin
training|məhsul komandası|Sual siyahısı|ilk pilotdan sonra gələn sualları FAQ bölməsinə daxil edək
training|filial rəhbərləri|Təlim cədvəli|birinci qrup səhər ikinci qrup isə günortadan sonra qoşulacaq
training|operatorlar|Sınaq hesabı|təlimdə real müştəri hesabından istifadə etməyin test hesabını seçin
training|müştəri nümayəndəsi|Bələdçi sənədi|son versiyada ekran görüntüləri yenilənib yeni faylı əlavə edirik
training|təlimçilər|Canlı nümayiş|imza və arxiv funksiyalarını ayrı sessiyalarda göstərəcəyik
training|Elvin bəy|İmtahan nəticəsi|sınaq suallarının cavabları yalnız təlimdən sonra paylaşılacaq
training|komanda|Yeni başlanğıc|ilk görüşdə layihənin məqsədini və rolları qısa təqdim edək
training|filial operatorları|Təkrar məşq|qeydiyyat addımında çətinlik yaşayanlar üçün əlavə vaxt ayırdıq
training|rəhbərlik|Təlim hesabatı|iştirak sayı və rəylər yekun hesabatda ayrıca göstəriləcək
training|müştəri|İzah videosu|telefon üzərindən müraciət yaratmağı göstərən video hazırdır
training|Aysel xanım|Test dəvəti|yeni funksiyanı öyrənmək üçün sınaq hesabınız aktivləşdirilib
training|texniki dəstək|Operator qeydləri|tez-tez verilən suallar üçün hazır cavab mətnlərini yeniləyək
training|məhsul sahibi|Təlim rəyi|istifadəçilər arxiv axtarışını çətin hesab edirlər bunu dizayna qeyd edək
training|yeni əməkdaşlar|Giriş sessiyası|sistemə ilk giriş və şifrə dəyişikliyi ayrı addımlarda göstəriləcək
training|Səbinə xanım|Təlim materialı|göndərdiyiniz təqdimatın iki səhifəsində köhnə ekran var onları dəyişək
"""

mail_rows = [row.strip().split('|', 3) for row in MAIL.splitlines() if row.strip()]
assert len(mail_rows) == 340, len(mail_rows)
assert len({row[3] for row in mail_rows}) == 340
mail_cases = []
for i, (domain, audience, subject, body) in enumerate(mail_rows, 1):
    # Each case has its own content; the three layouts exercise different
    # formatting paths without multiplying the number of underlying cases.
    if i % 3 == 0:
        raw = f"hormetli {audience} {body} hormetle layihe komandasi"
    elif i % 3 == 1:
        raw = f"movzu {subject} salam {audience} {body} hormetle senan"
    else:
        raw = f"Mövzu: {subject}\nHörmətli {audience},\n{body}\n\nHörmətlə,\nLayihə komandası"
    mail_cases.append(dict(id=f"mail-{i:03}", domain=domain, audience=audience,
                           subject=subject, anchor=body.split()[0], input=raw))
(ROOT / 'tests/fixtures/email-holdout.json').write_text(
    json.dumps(mail_cases, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Authored {len(rsd_cases)} RSD/IT cases and {len(mail_cases)} email cases')
