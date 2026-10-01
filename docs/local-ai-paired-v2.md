# API-siz redaktor: paired v2

Bu dəyişiklik `f24349d3f92052469cc124efb3392e67b5943ffa` main versiyası əsasında hazırlanıb.
Tətbiq generativ LLM deyil. Ödənişli API, token hesabı, model yükləmə və Python inference serveri yoxdur.
TypeScript qaydaları, Naive Bayes/sequence modeli, yeni token-edit logistic ranker,
supervised POS HMM və cümlə sərhədi classifier-i bir lokal axında işləyir.

## Beş istiqamət

1. **Səhv–düzgün cütlər:** `trainPaired()` mənbə və etalon tokenlərini DP ilə hizalayır;
   buraxılan/artıq/dəyişən hərflərin kanallarını və kontekst/POS əlamətlərini öyrənir.
   Etalon mətnləri sadəcə söz siyahısı kimi oxumaqla məhdudlaşmır. Hazır korpusda
   1 948 cüt, 343 fərqli təlim etalonu var: 1 498 train, 172 validation, 278 test.
   Yeni 948 nümunə müəllif mətnləri və işarələnmiş süni səhvlərdir. Real istifadəçi
   məlumatı toplanmış kimi göstərilmir; hazır artefaktda realReviewedPairs = 0.
2. **Yeni namizədlər:** bir hərf silmə imzaları və qonşu hərf mübadiləsi əvvəl
   görülməmiş buraxılma/artıq hərf/mübadilə üçün variantlar yaradır. Öyrənilmiş
   iki-edit variantları və `sh/ch/gh` transliterasiyası da dəstəklənir. Namizədlər
   token başına 32 ilə məhduddur. Kontekst, müşahidə sayı, POS, morphology,
   öyrənilmiş hərf kanalları və margin birlikdə seçim edir. Etibarlı hazır
   yazılışlar, terminlər, xüsusi isimlər və qeyri-müəyyən folded variantlar qorunur.
   Zəif sübut olduqda söz dəyişmir. Bitişik söz bölünməsi yalnız təkrar müşahidəli,
   ziddiyyətsiz nümunələrdən öyrənilir; sərbəst universal söz seqmentatoru deyil.
3. **Morphology/POS:** əlavə Azərbaycan dili köklərindən hallar, mənsubiyyət,
   cəm və fel formaları yaradılır. UD anotasiya mənbəyindən lexical/suffix HMM
   Viterbi ilə kontekstual POS və birmənalı lemma verir. Anotasiya ilə olmayan
   şəkilçilər barədə tam qrammatik təhlil iddiası yoxdur. Köhnə classifier-lərin
   feature vocabulary-si `legacyModelMorphology` ilə sabit saxlanılır: yeni
   mənbənin əlavə edilməsi əvvəl öyrədilmiş modelin mənasını səssiz dəyişmir.
4. **Birgə sərhəd:** səhv/düzgün token hizalanması etalondakı nöqtələrdən gap
   etiketləri çıxarır. Yeni classifier əvvəl virtual cümlə kontekstini bölür,
   sonra düzəldilmiş tokenlər əsasında terminal sərhəd qoyur. Offset-lər virtual
   mərhələdə dəyişmir. Tabeli cümlə, bağlayıcı, feili bağlama, obyekt, isim və
   natamam davam qoruqları tətbiq edilir. Vergül/absazlar mövcud qayda mühərrikində
   qalır; universal learned punctuation və ya məna parser-i yaradıldığı iddia edilmir.
5. **Qiymətləndirmə:** bütün səhv variantları etalon ailəsi üzrə eyni split-dədir.
   UD paralel/duplicate ailələri də ayrılır. Təlim əvvəlki gold, fresh və yeni
   challenge etalonlarının təlimdə olmasını rədd edir. Threshold yalnız validation
   hissəsindən seçilir. Bütün çıxışlar real `correctText()`/`formatEmail()` ilə
   hesablanır; saxlanmış düzgün cavablar runtime-da təkrarlanmır.

## Mənbə və lisenziya

POS üçün [UD_Azerbaijani-TueCL](https://github.com/UniversalDependencies/UD_Azerbaijani-TueCL),
revision `69fc3c609ccad52adf644fe350cf427713f42b79` istifadə olunur: Soudabeh Eslami
və Çağrı Çöltekin; CC BY-SA 4.0. Mənbə, lisenziya və attribution `data/local-ai/ud/`
altındadır. `pos-model.json` onun CC BY-SA 4.0 törəməsidir. Mənbə Şimali/Cənubi
variant fərqləri olan 148 qrammatik nümunədən ibarətdir; standart orfoqrafiya
etalonları kimi istifadə edilmir. Ailə üzrə split-dən sonra 118 cümlə train-dir.
134 held-out tokenin 104-ü düzgün POS-dur (77.61%); tanınmayan tokenlərdə 23/51.
Bu nəticə real Azərbaycan dili mətnləri üçün universal dəqiqlik deyil.

Araşdırılmış [Azerbaijani spelling dataset](https://huggingface.co/datasets/LocalDoc/azerbaijani_spelling)
CC-BY-NC-SA olduğu üçün tətbiqə/training-ə əlavə edilməyib. MorAz/HFST morphology
araşdırması nəzərə alınıb, amma üçüncü tərəf parser-i və GPL morphology kodu
paketə köçürülməyib. Mövcud Hunspell mənbə və attribution dəyişməyib.

## Faktiki nəticələrin şərhi

`paired-release-baseline.json` əvvəlki main-də eyni input/target-lərin faktiki
çıxışlarıdır. `paired-test-report.json` yeni çıxışları, word edit distance və hər
sınaq üzrə əvvəlki çıxışı saxlayır. Frozen 78 süni test variantı + 63 ayrıca
müəllif text/mail challenge var. Challenge müəllif tərəfindən hazırlanıb;
23 mail nümunəsi həmin text məzmununu təkrar istifadə edir, 63 müstəqil
məzmun deyil. Targets nəticələri yaxşı göstərmək üçün dəyişdirilmir.

Yekun frozen sınaqlar:

| Korpus | Əvvəlki main | Yeni model |
| --- | ---: | ---: |
| 78 süni variant | 29/78 | 66/78 |
| 63 text/mail challenge | 42/63 | 52/63 |
| Cəmi | 71/141 | 118/141 |

Bu 141 sınaqda əvvəlki versiyaya görə word edit distance reqressiyası yoxdur.
Paired lexical ranker-in ayrıca test hissəsində 133 qəbul olunmuş düzəlişin
133-ü düzgündür, sıfır yanlış düzəliş var; yalnız 47 etalon ailəsi təmsil olunur.
Ailə üzrə Wilson 95% aşağı hədd təxminən 92.44%-dir; bu, ümumi dil dəqiqliyi
və ya bütün səhvlərin düzəldilməsi ehtimalı deyil. Nəticə yüksək precision,
konservativ coverage seçimini əks etdirir. 3 785 proqram sınağı, TypeScript,
ESLint, production build və mövcud latency gate yoxlanılıb.

Korpus inkişaf zamanı görülüb və ümumi dil bacarığı üçün blind benchmark
adlandırılmır. Köhnə 200 nümunə inkişaf/reqressiya korpusudur. 1 000 əvvəlki
gold testi reqressiya/idempotence yoxlamasıdır. Daha geniş insan redaktoru
qiymətləndirməsi hələ lazımdır.

`paired-reliability-report.json` raw logistic score-u yoxlayır: score intervalına
görə faktiki düzgünlük, proposal Brier, accepted/wrong/abstained, həmçinin
ailə üzrə bütün accepted cavabların düzgünlüyü və Wilson 95% lower bound.
Brier yalnız namizəd təkliflərini ölçür; bütün mətn keyfiyyəti deyil. Eyni
etalondan süni variantlar asılıdır. Logistic score istifadəçiyə “bu qədər faiz
əminik” kimi göstərilmir; validation precision=1 belə universal 100% demək deyil.

## Təkrarlanabilən təlim və yoxlama

```bash
npm ci
npm run dictionary:import -- public/dictionaries/az
python scripts/build-paired-corpus.py
python scripts/build-paired-challenge.py
npm run local-ai:rebuild
npm run local-ai:paired:check
npm run local-ai:reliability
npm run gold:exact
npm run local-ai:fresh:check
npm run local-ai:context:check
npm test
npm run typecheck
npm run lint
npm run build
npm run benchmark:check
```

CI korpus/model artefaktlarını yenidən yaradır və `git diff --exit-code` ilə
reproducibility-ni yoxlayır. Yeni evaluator baseline-də input/target/ID
uyğun gəlmirsə dayanır; əvvəlki nəticəyə görə word-distance reqressiyasını rədd edir.

## Təsdiqlənmiş real düzəlişlərdən öyrənmə

Proqramın əvvəlki “düzgün nəticəni saxla” export faylını insan yoxlamasından
sonra təlimə əlavə etmək olar:

```bash
npm run local-ai:paired:train -- --reviewed=/absolute/path/slothai-reviewed-tests.json
npm run local-ai:paired:check
npm run local-ai:reliability
npm test
```

Fayl formatı və ölçüsü yoxlanır; ziddiyyətli eyni girişlər, təlimə qarışan
reserved etalonlar və 512 tokendən uzun hizalanma nümunələri rədd edilir.
Uzun mətnləri müstəqil məna daşıyan fraqmentlərə ayırmaq lazımdır. Şəxsi məlumatları
anonimləşdirin: öyrənilmiş token/kontekst sayları model artefaktında görünə bilər.
Bu import yalnız açıq offline komanda ilə baş verir; jurnal avtomatik ümumi
modelə əlavə olunmur. Öz-özünə internetdən söz yığmaq və səhvləri doğru kimi
öyrənmək mexanizmi yoxdur. Mətn və mail eyni öyrənilmiş lexical modeli istifadə edir.

Əsas növbəti inkişaf: ayrıca annotatorlarla razılaşdırılmış real səhv–düzgün
mətnlər, daha böyük standart Azərbaycan dili POS/morphology anotasiya korpusu,
və layihəyə heç vaxt göstərilməmiş qiymətləndirmə dəsti. Formların sayını artırmaq
məna anlama və etibarlılıq problemini öz-özünə həll etmir.
