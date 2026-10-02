> Bu sənəd ilkin v1 buraxılışının tarixi hesabatıdır. Cari təlim və komandalar: [neural-training-v2.md](neural-training-v2.md).

# Kiçik neyron düzəliş modeli

Başlanğıc main: `24cbc5355f4373e234cf749ef479e5fd362c3117`.

İki bir-gizli-qatlı tanh MLP əlavə olunub: söz namizədi üçün 23 giriş × 12
neyron, şəxs–say uyğunluğu üçün 14 giriş × 12 neyron. Cəmi 494 öyrənilən
parametr var. Bunlar backpropagation və deterministik SGD ilə öyrənən həqiqi
qeyri-xətti neyron şəbəkələrdir. Transformer, generativ LLM və universal
sintaktik parser deyil. Qrammatik əlaqələr üçün morfologiya və konservativ
cümlə qoruqları kömək edir; geniş məna anlama iddiası yoxdur.

## Resurs

Heç bir yeni npm/Python ML asılılığı, əvvəlcədən təlim edilmiş böyük model,
GPU, API və ayrıca server əlavə edilməyib. Təlim offline TypeScript komandasıdır;
production yalnız kiçik JSON çəkilərini və məhdud inference hesablamasını yükləyir.
Model + kiçik lexical məlumatı təxminən 94 KB-dır. Bu rəqəm bütün tətbiqin
RAM tələbi deyil: mövcud lüğət və morphology process yaddaşında ayrıca qalır.
Namizədlər token başına 24, söz uzunluğu 24, qrammatik əlaqə məsafəsi 8 token
ilə məhduddur. Yalnız unknown sözlərdə yeni lexical hesablamalar aparılır.

## İlkin təlim

2 760 süni lexical giriş/etalon və 1 944 morphology-assisted şəxs–say məşqi
hazırlanıb. Bunlar 4 704 müstəqil real mətn deyil. Ailələr split-lər arasında
bölünmür; test etalonları təlimdə istifadə olunmur. Lexical məşqlər inflected
sözləri metalinguistik cümlələrdə göstərir; bu, gündəlik mətn korpusunu əvəz etmir.

İlk 12 epoch və daha 12 epoch mərhələsi icra olunub. Validation loss:
lexical 0.00738 → 0.00315; agreement 0.00324 → 0.00171. Validation loss
pisləşərsə, əvvəlki yaxşı checkpoint həmin head üçün saxlanılır. Threshold
validation-dan seçilir; sigmoid nəticəsi kalibrə edilmiş düzgünlük ehtimalı deyil.

```bash
npm run neural:corpus
npm run neural:train -- --epochs=12
npm run neural:continue -- --epochs=12
npm run neural:check
npm test
npm run benchmark:check
```

`neural:continue` çəkiləri saxlayaraq təlimə davam edir. Korpus hash-i və
feature version uyğun gəlmirsə dayanır; yeni məlumatla təlimə sıfırdan başlamaq
lazımdır. Serverdə avtomatik/background təlim yoxdur. Nümunələrə yeni real,
anonimləşdirilmiş, insan tərəfindən təsdiqlənmiş etalonlar əlavə etmək növbəti
mərhələdir. Sadəcə epoch artırmaq yeni bilik yaratmır.

## Faktiki yoxlamalar

* 14 ayrıca müəllif cümləsi: 14 tam uyğun çıxış.
* 420 held-out süni şəxs–say məşqi: 420 classification və 420 tam uyğun çıxış.
* 523 held-out lexical məşq: yalnız yeni neuralSpelling mərhələsində 380 tam
  uyğun çıxış; qalan 143 dəyişməyən və ya natamam hallar hesabatda açıq saxlanır.
  Bu mərhələ diakritika-only halları əvvəlki mühərrikə buraxır; bütün app dəqiqliyi deyil.
* Əvvəlki tam düzgün text nəticələri üçün yeni evaluator-da reqressiya yoxdur.
* XOR testi qeyri-xətti öyrənməni, checkpoint testi mərhələli təlimin eyni
  addımlarla fasiləsiz təlimi təkrarladığını yoxlayır.

`data/neural/evaluation-report.json` actual/expected çıxışları saxlayır.
`training-history.json` mərhələləri, `training-report.json` ölçü/parametr/loss
və artefakt hash-ini saxlayır. CI təlimi yenidən aparıb artefaktları müqayisə edir.
Bu kiçik süni sınaqlar sərbəst Azərbaycan dili üzrə yüksək dəqiqlik zəmanəti deyil.

## Əhatə

`maktablar` → `məktəblər`, `Biz məktubu göndərdi` → `Biz məktubu göndərdik`
kimi nümunələr dəstəklənir. Yeni vocabulary-skeleton namizədləri çoxlu sait
səhvlərini tapır; seçim neyron şəbəkədə qiymətləndirilir. Qrammatik mərhələ
aydın clause-initial şəxsi əvəzlik və birmənalı, tanınan finite verb ilə işləyir.
İkinci mübtəda, koordinasiya, qeyri-müəyyən kök, quote/kod və əlavə clause
olduqda əvvəlki nəticəni qorumağa üstünlük verir. Nöqtə/vergül üçün əvvəlki
cümlə sərhədi mühərriki qalır; onun neyron modelə çevrildiyi iddia edilmir.

Yeni morphology seam köhnə generatorun keçmiş zamanda ikinci şəxs cəmində
saiti iki dəfə artırmasını düzəldir: `hazırladıınız` yox, `hazırladınız`.
Köhnə modelin feature vocabulary-si sabit saxlanılıb. Yeni teacher etalonları
bu qüsurlu formadan yaradılmır. Mənanı dəyişərək sərbəst söz əlavə etmə hələ yoxdur.
