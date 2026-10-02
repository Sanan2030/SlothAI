# Müxtəlif korpusla davam edən kiçik model təlimi

Başlanğıc: `a5d7c00f9a45de8cb06f5b8271f303ea9a2cbd36`.

## Məlumatın keyfiyyəti

Əvvəlki 2 760 lexical şablon 144 müxtəlif söz-forması məşqinə endirilib.
Eyni formaya beş oxşar cümlə əlavə olunmur. Şəkilçili formalar dırnaq içində
öyrədilir: beləliklə təsadüfi hal şəkilçisi cümlənin qrammatikasını pozmur.
Bundan əlavə 80 müəllif cümləsi var: İT, mail, biznes, xidmət, təhsil, elm,
gündəlik həyat. Bunların 48-i train, 12-si validation, 20-si qiymətləndirmədir.
Bunlar sintetik səhvlərlə müəllif tərəfindən hazırlanıb; real istifadəçi və
insan dilçi tərəfindən təsdiqlənmiş korpus deyil.

Cari lexical korpus cəmi 224 cütdür. Təkrar yoxlaması Unicode NFC,
Azərbaycan hərflərinin qatlanması və token-bigram Jaccard >= 0.8 istifadə edir.
Normallaşdırılmış təkrarlar, yaxın cümlələr və split-lər arasında həmin cütlər
olarsa korpus qurulması dayanır. Bu, semantik sinonimliyi müəyyən edən sistem
və bütün məna təkrarlarının yoxluğu zəmanəti deyil.

Əvvəlki 1 944 qrammatik məşq 216 fərqli feature vektoruna endirilib.
Eyni model girişi müxtəlif feil adları altında təkrar sayılmır. Eyni girişə
zidd etiket verilərsə təlim dayanır. Train/validation/test həmin feature ailəsi
üzrə ayrılır. Əvvəlki checkpoint artıq bəzi feature-ləri görüb; buna görə bu
qrammatik qiymətləndirmə tamamilə yeni qrammatik quruluşda kor test deyil.

`data/neural/data-quality.json` faktiki sayları və yoxlama nəticələrini saxlayır.

## Davamlı təlim

`data/neural/seed-v1.json` yayımlanmış modelin dəyişməyən checkpoint-idir.
Yeni təlim həmin çəkilərdən başlayır; əvvəlki lüğət bilikləri qorunur. Cari
validation/test mətnlərindən lüğət və ya səhv uyğunluğu hesablanmır.
Köhnə checkpoint-də şablon təlimin təsiri qalır; korpusun təmizlənməsi bu
əvvəlki öyrənməni geriyə dönük silmir.

Gradient yenilənməsi zamanı birbaşa typo→target sayını göstərən feature
sıfırlanır. Bu saydan istifadə edib sadəcə tanış səhvi əzbərləməyə üstünlük
verilməsinin qarşısı alınır. Eyni tam feature vektorları gradient dəstində də
bir dəfə saxlanılır. Epoch zamanı nümunələrə təkrar baxmaq standart təlimdir;
bu, korpusa eyni qeydi təkrar əlavə etmək deyil.

72 epoch davamlı təlim aparılır, sonra daha 24 epoch yoxlanılır. Hər head-in
validation itkisi pisləşərsə onun əvvəlki çəkiləri qorunur. Yeni çəkilərin
qəbul edilib-edilmədiyi history faylında göstərilir. Hazır səhvlərdə əvvəlki
lexical çəkilər sabit dayaq kimi işləyir; yeni səhvlərdə yeni head işləyir.
Bu, əvvəlki düzgün seçimlərin unudulmasını məhdudlaşdırır.

Əməliyyat threshold və winner margin validation-dakı faktiki namizəd seçiminə
görə müəyyən edilir. Validation kiçikdir; sigmoid balı real düzgünlük ehtimalı
kimi kalibrə edilmiş hesab edilmir. Test çıxışları threshold seçiminə qatılmır.
Qiymətləndirmə dəsti inkişaf zamanı baxılan reqressiya dəstidir, kor audit deyil.

## Məhdud inference

Yalnız həqiqətən yanaşı yazılmış təkrar hərf alternativ namizəd yaradır.
Saitlər çıxarıldıqdan sonra yanaşı görünən samitlər təkrar hərf sayılmır:
`olunan` sözünün `olan` ilə əvəzlənməsi bu yolla qadağandır. Düzgün lüğət
sözləri qorunur; tanış olmayan formadan hal şəkilçisi silinmir. Açıq yazılmış
Azərbaycan hərfləri insert/delete nəticəsində yer dəyişə bilər, amma silinə
və ya başqa hərflə əvəz edilə bilməz.

Aktiv iki head 494 parametrdir, dondurulmuş lexical dayaq əlavə 301 parametrdir:
cəmi 795. Token üzrə hər iki lexical şəbəkə deyil, seçilən biri hesablanır.
Artefakt təxminən 130 KB-dır. Training checkpoint yalnız offline skript üçün
lazımdır, production inference onu import etmir. Yeni ML asılılığı, API,
GPU və ayrıca server yoxdur. Sistem generativ LLM və ümumi məna anlayan parser deyil.

## Təkrar qurmaq

```bash
npm ci
npm run dictionary:import -- public/dictionaries/az
npm run neural:corpus
npm run neural:train -- --epochs=72
npm run neural:continue -- --epochs=24
npm run neural:check
npm run neural:diversity:check
npm test
npm run typecheck
npm run lint
npm run build
npm run benchmark:check
```

CI korpusu və model artefaktlarını yenidən qurub Git versiyası ilə müqayisə edir.
`--resume` korpus/feature versiyası dəyişibsə dayanır. Yeni korpus üçün seed-dən
`neural:train` işlədilir. Validation və test çıxışlarını train-ə köçürmək olmaz.

## İlkin təlim buraxılışının nəticəsi

Yeni 20 kontekst üçün əvvəlki main 11, təhlükəsiz seçimlə son model 14 tam
uyğun çıxış verir. Əvvəl düzgün olan həmin çıxışlarda reqressiya yoxdur.
Qalan 6 hal `diverse-evaluation.json` faylında actual/target ilə açıq saxlanır.
14 əvvəlki neural probe və 50 cari qrammatik exercise tam uyğun qalır.
50 lexical exercise-dən neural mərhələ təkbaşına 31-ni tam düzəldir; diakritika
ambiguity halları əvvəlki redaktor mühərrikinə buraxılır. Bu kiçik dəstlərin
nəticəsi sərbəst mətnlər üçün ümumi accuracy zəmanəti deyil.

## Tam yoxlamalar və sürət həddi

3 793 test keçdi; TypeScript, ESLint, production build və model/korpus/hash
reproducibility yoxlamaları keçdi. Yerli CPU benchmark-da 1 000 söz üçün
p95 576.44 ms, 5 000 söz üçün p95 2976.75 ms ölçüldü.
İstifadəçi maksimum 10 saniyəni qəbul edib; bütün correction benchmark
case-lərinin CI həddi buna uyğun 10 000 ms-dir. Cari performance gate keçdi.
Actual per-size gecikmələr yenə ayrıca göstərilir. Component benchmark-ləri
öz daha sərt hədlərini saxlayır.
5 000 söz bir sorğu deyil, 10 000 simvol sərhədinə uyğun bir neçə sorğudur.
Baseline snapshot köhnə daha sərt hədlərlə çəkilib; cari hədd fərqi user
qərarıdır. Bu lokal ölçmə Vercel və ya bütün mümkün mətnlər üçün 10 saniyə
gecikmə zəmanəti deyil.
Tam rəqəmlər `neural-training-v2-verification.json` faylındadır.

## Son nominal düzəliş

Altı qalan xəta düzəldilib; cari müxtəlif-kontekst dəsti 20/20-dir. Səbəblər,
umumi mexanizm və yeni sınaqlar: [nominal-repair-six.md](nominal-repair-six.md).
