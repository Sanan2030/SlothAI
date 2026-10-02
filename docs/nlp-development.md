# Azərbaycan dili redaktorunun diaqnozu və ölçülə bilən inkişaf yolu

Latest release: see [offline correction priorities and measured results](nlp-priorities.md). The historical measurements below describe the earlier head.

## Qısa diaqnoz

Hazırkı sistem seq2seq Transformer və ya BiLSTM deyil. TypeScript-də işləyən hibrid redaktordur: lüğət, morphology və qaydalar, əvvəlki 795 parametrli şəbəkələr və əlavə 1 149 parametrli attention namizəd seçicisi. Hərf 1–3-gramları 16 ölçüyə hash olunur; namizəd sorğusu 16 × 16 proyeksiya ilə yaxın kontekstə baxır; 71 girişli, 12 gizli vahidli MLP seçim edir. Xarici API, GPU, Python inference serveri və pretrained model yoxdur.

Attention təlimində SGD, batch=1, BCE, L2=0.0001 və `0.025 / (1 + epoch / 60)` learning rate istifadə olunur. 80 train/24 validation/24 inkişaf sınağı cümləsi var; 190 namizəd nümunəsi ilə 512 epoch sınanıb, validation üzrə 32-ci epoch saxlanılıb. Başlanğıc modelin train BCE-si təxminən 0.274, validation BCE-si 0.380-dir. Sonrakı təlim validation nəticəsini pisləşdirir: bu, həmin bölgüdə overfitting meylidir; tək bu fərqdən ümumi underfitting/overfitting hökmü çıxarmaq düzgün deyil.

Başlıca struktur məhdudiyyəti namizəd əhatəsidir: əsas attention yalnız qonşu hərflərin yer dəyişməsinə namizəd yaradır. Sadə `necəsən → necesen` səhvi bu hissədə birbaşa namizəd yaratmır; hazırkı app başqa lüğət/morphology mərhələlərindən istifadə edir. Daha çox epoch namizəd siyahısında olmayan düzgün variantı yarada bilməz. Uzun şəkilçi zəncirləri və cümlə sintaksisi bu kiçik şəbəkədə generativ şəkildə öyrənilmir.

Əvvəlki audit cümlə səviyyəsində eyni/yaxın nümunələri yoxlayır, amma ilkin real sənəd mənbələri məlum deyil. Buna görə köhnə bölgünün sənəd səviyyəsində sızmasız olduğunu təsdiqləmək olmaz. Əlavə 32 nümunə də qoruyucu qaydanın inkişafında istifadə olunub: yekun kor test kimi təqdim edilməməlidir. İstifadəçi əl ilə təsdiqlənmiş real korpusun hələ olmadığını bildirib.

## Ölçülmüş nəticə

Eyni 56 süni mətndə yalnız attention komponentini söndürüb/açaraq bütün redaktor müqayisə olunub. Digər modellər, lüğət və morphology qalır. Şəbəkə imtina edəndən sonra lüğətin yanlış söz seçməsi də tapılıb: indi qeyri-müəyyən səth qorunur və sonrakı təxmin onu dəyişmir.

| Ölçü | Attention söndürülmüş | Attention və imtina qoruması aktiv |
| --- | ---: | ---: |
| Tam düzgün nəticə | 38/56 | 51/56 |
| CER | 2.137% | 0.575% |
| WER | 6.020% | 1.672% |
| Edit precision | 82.76% | 100% |
| Edit recall | 57.14% | 88.10% |
| F0.5 | 0.7595 | 0.9737 |
| Düzgün mətnin pozulması | 0/14 | 0/14 |

Bu nəticələr real istifadəçi accuracy-si deyil. Beş səhv qalır; məna baxımından qeyri-müəyyən hallarda sistem dəyişiklik etməməyi üstün tutur. Tam mətn CER/WER/accuracy registr və boşluqları da nəzərə alır. Precision/recall/F0.5 isə NFC-normalizə edilmiş, boşluqla ayrılmış tokenlər üzərində deterministik, tək düzgün cavablı edit-span hesabıdır; CoNLL M2 implementasiyası deyil. Boşluq-only xətalar CER/accuracy-də görünür, token edit precision-da görünmür. Sıfır denominator üçün `null` verilir, süni 100% yox.

## Prioritet plan və tam kod

| Sıra | Dəyişiklik | Təsir və zəhmət | Kod |
| --- | --- | --- | --- |
| 1 | Tam redaktorun CER/WER/precision/recall/F0.5 və identity pozulmasını ölçmək; real testə ayrıca baxmaq | Böyük təsir, az zəhmət | `scripts/nlp/metrics.ts`, `scripts/evaluate-correction-quality.ts` |
| 2 | Mənbə və lisenziya metadata-sı olan sənədləri deduplicate/cluster etmək, sonra bölmək, sonra müxtəlif süni səhvlər yaratmaq | Böyük təsir, orta zəhmət | `scripts/nlp/data.ts`, `scripts/build-correction-data.ts` |
| 3 | İmtinanı sonrakı mərhələlərdə qorumaq; düzgün sözləri, adları, terminləri, URL/kodu dəyişməmək | Böyük precision təsiri, az zəhmət | `lib/editor/neural/attention-runtime.ts`, `lib/editor/neural/runtime.ts`, `lib/editor/correct.ts` |
| 4 | Bərabər büdcə və seed ilə kontekst, mövqe, attention və birbaşa diakritik namizədlərin təsirini ayrı ölçmək | Orta təsir, orta zəhmət | `lib/editor/neural/attention.ts`, `lib/editor/neural/network.ts`, `scripts/train-attention-experiments.ts` |

Bütün fayllar tam işlək kodla repository-dədir. Production modeli və onun çəkiləri dəyişdirilməyib. Eksperiment modeli ayrıca qovluğa yazılır; daha geniş diakritik namizədlər production-da avtomatik açılmır. Yeni təlim faylına bütün cümlə cütləri verilir; mövcud başlıq align edilmiş sözlərdən öyrənir. Boşluq/söz əlavə-silmə xətalarının alignment tərəfindən kənarda qala biləcəyi hesabatda qeyd olunur. Bu mexanizm seq2seq əvəzi deyil.

## Data formatı və işlətmə

Təmiz mənbə faylı UTF-8 JSONL olmalıdır. Wikipedia, xəbər və ya mC4/CC-100/OSCAR ixracında hər sənəd ayrı sətrə yazılmalı, orijinal sənəd ID-si, mənbə və lisenziya saxlanmalıdır. Vebdən alınması mətni avtomatik düzgün etmir: reklam, HTML, dil qarışığı və səhv yazı əvvəlcə yoxlanmalıdır. Bu release xarici korpusu yükləyib təmizlədiyini iddia etmir.

```json
{"documentId":"article-unique-id","text":"Müştərinin müraciəti təhlükəsiz şəkildə qeydə alındı.","source":"mənbə URL-si və ya dataset/revision","license":"mənbənin faktiki lisenziyası","protectedTerms":["backend","API","əliməmməd"]}
```

Sənədlər və eyni/yaxın məzmunlu klasterlər əvvəlcə 80/10/10 bölgüsünə hash ilə təyin olunur. Dəqiq cümlə/parağraf paylaşan sənədlər eyni klasterə qoşulur; 0.8 token-bigram Jaccard sənəd yaxınlığını birləşdirir. Sonra diakritik düşməsi, hərf silmə/əlavə/yer dəyişmə, QWERTY qonşuluğu, boşluq və kiçik danışıq variantları yaradılır. Seed deterministikdir. Nümunələrin bir hissəsi olduğu kimi saxlanır; təkrar input/target cütləri kənarlaşdırılır. Bu mexanizm semantik yaxınlığın bütün növlərini tanımır və tam NER deyil: kiçik hərflə yazılmış ad/xarici söz üçün `protectedTerms` verilməlidir. Böyük hərflə başlayan sözlər konservativ qorunur, o cümlədən cümlə başlanğıcları.

Demo yalnız süni pipeline fixture-dir: 128 sənəddən 570 cüt, 458/54/58 bölgüsü, 128 dəyişməyən nümunə və 225 diakritik nümunə yaradıldı. Danışıq dili nümunəsi yalnız birdir; bu çatışmazlıq gizlədilmir. Generator ehtimalları real loglardan təxmin olunmayıb. Demo sənədləri əvvəlki müəllifli cümlələrdir; bunları real korpus və ya tam müstəqil test adlandırmaq olmaz.

```sh
npm run nlp:data -- data/nlp/demo-documents.jsonl /tmp/az-correction-data
npm run nlp:ablation -- --data=/tmp/az-correction-data --variants=full,direct-diacritics --epochs=16 --seeds=719 --output=/tmp/az-correction-experiment
npm run nlp:evaluate -- --input=/tmp/az-correction-data/test.jsonl --output=/tmp/az-production-quality.json
npm run nlp:evaluate -- --model=/tmp/az-correction-experiment/direct-diacritics-719.json --input=/tmp/az-correction-data/test.jsonl --output=/tmp/az-experiment-quality.json
```

Təlimdə istifadə olunacaq öz sənədlərinlə birinci fayl yolunu əvəz et. Yeni generator train/validation/test fayllarını və manifesti yazır; trainer `documentId` və target bölgüsünü yoxlayır, train-only lexicon qurur, validation-only checkpoint/threshold seçir və test nəticəsini ayrıca verir. Boş validation/test olan kiçik korpus rədd edilir, testdən train-ə nümunə daşınmır. 16 epoch demo yalnız smoke testdir; yaxşı model nəticəsi iddiası deyil. Təlim büdcəsini validation nəticəsinə görə artırmaq lazımdır.

Real test JSONL sətrində əlavə `reviewedBy` və `provenance` verilməlidir. Bu metadata əl ilə yoxlanma barədə istifadəçinin təsdiqidir; proqram onun həqiqiliyini müstəqil sübut edə bilməz.

```json
{"id":"real-001","input":"faktiki istifadəçi mətni","target":"redaktorun təsdiqlədiyi variant","category":"diacritics","reviewedBy":"redaktorun identifikatoru","provenance":"icazəli mənbə/log qeydi"}
```

```sh
npm run nlp:evaluate -- --input=real-test.jsonl --real --output=/tmp/az-real-quality.json
npm run nlp:evaluate -- --enforce
npm run nlp:ablation -- --epochs=128 --seeds=719,919,1119 --output=/tmp/az-ablations
```

## Ablation nəticəsi və növbəti qərar

Hər model eyni başlanğıc seed-dən sıfırdan öyrənir, eyni 128 epoch büdcəsi alır, validation ilə checkpoint və sərhəd seçir. Üç seed sınanıb. Hər müqayisədə bir komponent dəyişir; morphology və konservativ ambiguity guard qalır. `no-context` yalnız öyrənilən şəbəkənin kontekstini söndürür, həmin qoruyucu qaydanı söndürmür. Bu hesabat söz başlığı üçündür; bütün app metrikləri ayrıca yuxarıda verilib.

| Variant | İnkişaf sınağında düzgün söz, üç seed | Şərh |
| --- | --- | --- |
| Tam model | 24, 24, 24 /24 | Baza |
| Bərabər attention çəkiləri | 24, 24, 24 /24 | Öyrənilən attention üstünlüyü sübut edilməyib |
| Mövqe kanalları olmadan | 24, 23, 24 /24 | Kiçik, dəyişkən təsir |
| Öyrənilən kontekst olmadan | 20, 20, 20 /24 | Kontekst faydalıdır |
| Birbaşa diakritik namizədlərlə | 24, 24, 24 /24 | Bu korpus əsasən swap-dır; əsas diakritik işi üçün yetərli sınaq deyil |

Birbaşa diakritik variant sənəd pipeline-i ilə ayrıca train/evaluate smoke testindən də keçirilib. Sənəd testində səhv sözlər üzrə namizəd recall-u 3/99-dan 39/99-a yüksəlib, amma 16 epoch sonunda validation tələbinə uyğun etibarlı düzəliş seçilməyib; nəticə `data/nlp/document-pipeline-report.json`-da saxlanır. Bu variant yalnız validation/real test precision və identity təhlükəsizliyi yaxşı olduqdan sonra production-a keçirilə bilər.

Növbəti mərhələ ən azı bir neçə fərqli domenin real redaktorla yoxlanmış test nümunələrini toplamaq və bu dəsti təlim/qayda seçimi zamanı bağlı saxlamaqdır. Sonra namizəd recall-u artırılmalı, uzun şəkilçi zəncirləri üzrə lemma/POS xətaları ayrıca ölçülməli, yalnız bundan sonra daha böyük character/subword şəbəkəsinə keçilməlidir. ByT5 tədqiqatı simvol/byte yanaşmasının spelling noise-a davamlılığını göstərir, amma bu kiçik rankerin nəticəsi böyük pretrained modelin nəticəsi ilə eyniləşdirilə bilməz.

Mənbələr: https://arxiv.org/abs/2105.13626 ; https://aclanthology.org/W14-1701/ ; https://huggingface.co/datasets/allenai/c4 .

Yoxlama: 3 928 test, TypeScript, ESLint və production build; lokal warm CPU p95: 1 000 söz üçün 601 ms, 5 000 söz/5 hissə üçün 3 044 ms. Vercel şəbəkə/cold-start gecikməsi bu ölçüyə daxil deyil. Production model artefaktı əvvəlki ilə byte-identical qalıb.
