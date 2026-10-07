# Faza 0 — ölçülmüş baza, 7 oktyabr 2026

Baza: `b3b5af74c366b1e57d9c64ce284384d8ad69ca66`. Tətbiqin düzəliş kodu və çəkiləri dəyişdirilməyib. Bu faza yalnız ölçmə infrastrukturu, dondurulmuş sınaqlar və hesabat əlavə edir. Yeni model yaradılmayıb, təlim və kalibrləmə aparılmayıb.

Cədvəldə mötərizələr bootstrap 95% intervalıdır: 1 000 resample, seed 20261007. Yeni dəstdə documentId klasterləri, köhnə fixture-larda row ID, gecikmədə proses/sınaq vahidləri istifadə edilir. Köhnə fixture-larda sənəd müstəqilliyi sübut edilməyib. Kiçik nümunə və sıfır hadisə intervalın informativliyini məhdudlaşdırır; [0,0] sıfır risk sübutu deyil. Fayl ölçüləri və deterministik test sayları dəqiq hesablamadır, seçmə metrik deyil.

| Ölçü | Əvvəl | Sonra — runtime dəyişməyib |
|---|---|---|
| Yeni holdout, tam cümlə | 78.60% [74.40, 82.40] | Eyni |
| Söz precision | 99.44% [98.75, 100.00] | Eyni |
| Söz recall | 83.12% [78.96, 86.23] | Eyni |
| F0.5 | 95.68% [94.34, 96.71] | Eyni |
| Düzgün sözə yanlış dəyişiklik | 0.05% [0.00, 0.18] | Eyni |
| Xəta sözünün dəyişmədən qalması | 16.56% [13.50, 20.61] | Eyni |
| CER | 0.75% [0.61, 0.91] | Eyni |
| WER | 3.93% [3.22, 4.74] | Eyni |
| No-harm, tam cümlə | 99.70% [99.45, 99.90] | Eyni |
| No-harm, söz FP | 0.06% [0.01, 0.11] | Eyni |
| 200 söz, warm, median ms | 51.70 [51.08, 53.79] | 51.22 [49.43, 55.10] |
| 200 söz, warm, p95 ms | 58.57 [53.19, 60.57] | 67.09 [54.72, 79.17] |
| 200 söz, novel, median ms | 392.19 [309.30, 398.19] | 373.00 [298.13, 412.42] |
| 200 söz, novel, p95 ms | 443.96 [398.66, 456.81] | 447.51 [398.11, 494.41] |
| 900 söz, warm, median ms | 214.76 [205.88, 221.20] | 218.15 [208.75, 219.32] |
| 900 söz, warm, p95 ms | 230.81 [222.57, 232.21] | 220.71 [219.61, 220.74] |
| 900 söz, novel, median ms | 1768.61 [1685.01, 1818.53] | 1706.58 [1668.54, 1840.37] |
| 900 söz, novel, p95 ms | 2100.16 [1824.13, 2117.88] | 2041.45 [1841.08, 2090.33] |
| No-harm, yalnız hədəf formalar (wrapper çıxarılıb) | 0.25% [0.05, 0.45]; 5/2000 | Eyni |
| Node soyuq import + ilk çağırış, median ms | 2661.30 [2610.49, 2694.88] | 2686.26 [2670.25, 2710.17] — Node, brauzer deyil |
| Release holdout-300 exact | 299/300; 99.67% [99.00, 100.00] | Eyni |
| Runtime JSON | 5,634,256 bayt | Artım **0 KiB** |
| Əvvəlki fixture snapshot-u | 4861 sıra müqayisə edildi | 0 dəyişən çıxış; 0 idempotency xətası |

## Sınaq dəstlərinin mənşəyi və məhdudiyyəti

- Holdout: 500 cümlə, 25 domen, 150 identity (30%). 250 ayrıca yazılmış əsas cümlənin iki kontekst variantı var; bu **500 müstəqil real sənəd deyil**. Təkrar mövzu/fel/sözlər var; leksik təkrarsızlıq tələbi tam ödənmir. Hədəflər model çıxışından götürülməyib. Assistant-authored, not human-reviewed.
- Söz-xəta cütü müxtəlifliyi: 362 fərqli cüt, ən çox təkrarlanan cüt 61 dəfə görünür. Buna görə leksik təkrarsızlıq qəbul meyarı tam ödənmir; sınaq nəticəsi müstəqil real istifadəçi keyfiyyətini təsdiqləmir.
- Generatorun Python lower() əməliyyatı üç İ-başlanğıclı case nümunəsində i + combining-dot yaradır. Bu Unicode kənar halıdır, adi az-AZ lowercase deyil; dondurulmuş girişlər dəyişdirilməyib, case metrikinin bu məhdudiyyəti saxlanılıb.
- No-harm: pinned Hunspell/MPL-2.0 lüğətindən 2 000 fərqli forma, cümlə daxilində metadil konteksti. Lüğətin özündə qəribə/yaxud xüsusi ada çevrilən formalar var; bu dəst dilçi tərəfindən doğrulanmış qızıl standart deyil və bütün təbii kontekstləri təmsil etmir.
- Kalibrləmə: ayrıca 100 sətir, fərqli sənəd ID-ləri və tam mətnlər; yalnız saxlanılıb, nəticələrə baxılmayıb və hədlər seçilməyib. Dörd təkrarlanan çərçivə olduğu üçün ciddi kalibrləmə üçün hələ kifayət etmir.
- Yeni dəstlər SHA-256 ilə dondurulub, `trainingAllowed:false`, `data/evaluation/` altında yerləşir. Hash və split kəsişməsi test edilir; gələcək təlim alətləri bu qovluğu istifadə etməməlidir.
- Əvvəlki data/test hədəfləri ilə casefold edilmiş tam hədəf üst-üstə düşmə: 1 sıra. Yoxlama explicit target/expected/text/correct sahələrini əhatə edir, yaxın və semantik dublikatların yoxluğu iddiası deyil.
- Mövcud user-input-evaluation.jsonl-də 12 istifadəçi mənşəli inkişaf nümunəsi var; hədəflər assistant reference-dir, kor dilçi auditi deyil. Yeni hesabata xam istifadəçi mətnləri köçürülməyib. Tam cümlə exact: 33.33% [8.33, 58.33]. Bu aşağı göstərici üslub/durğu/tək istinad fərqlərini də sayır; ümumi dil keyfiyyətinin faizi deyil.
- Təklifdəki 73 yeni cümlə verilməyib. 62/73 və 72/73 iddialarını təkrar yoxlamaq mümkün olmadı. “20 söz” siyahısında isə yalnız 15 söz açıq yazılıb; olmayan beş nümunəni uydurmadım.

## Diaqnozun təkrar yoxlanması

| İddia | Main-də vəziyyət |
|---|---|
| Bütün modellər 12 tanh MLP-dir | Tam doğru deyil: lexical/agreement/ranker başlıqları MLP-dir, local context Naive Bayes, paired logistic və POS HMM də var. Institutional runtime-a qoşulmayıb. |
| Hash simvol vektoru, mövqenin qarışması | Təsdiq: 16 ölçü, mövqe 12–15 kanallarına əlavə edilir; learned embedding/multihead Transformer yoxdur. |
| Təlimdə Adam/minibatch yoxdur | Core trainNetwork SGD-dir, amma learning rate sabit deyil: 0.025/(1+epoch/40). Ayrı təlim skriptlərində validation checkpoint selection mövcuddur; “heç yerdə erkən seçim yoxdur” iddiası yanlışdır. |
| Confidence kalibrlənməyib | Etibar balları düzgünlük ehtimalı kimi qəbul edilə bilməz. Bu fazada kalibrləmə edilməyib. |
| Kontekst vocabulary və fold keşsizdir | Köhnəlmiş: main-də WeakMap vocabulary və 8192 ölçülü Map fold keşi artıq var. Yenidən optimallaşdırılmayıb. |
| bounded böyük hərfi/kiçik sözü atır | Təsdiq: createBoundedHead uppercase rədd edir, boundedCandidates 4–24 hərf qəbul edir; bu yalnız həmin head-dir, bütün editor deyil. |
| Sərgi və sifət Əla pozulur | Aşağıdakı hazırkı çıxışlarda verilən nümunələr artıq qorunur. Bu, hər kontekstdə təhlükəsizlik sübutu deyil. |
| 8 başlığın hamısı istehsaldadır | Yanlış: institutional eksperimentdir; şərti default yol digər mərhələləri də hər sözdə işə salmır. |
| Worker paralelliyi daha sürətlidir | Sübut yoxdur: bu faza brauzer worker end-to-end A/B aparmır. Statik təkrarlanan import riski qalır. |

- `Sərgi sabah açılacaq.` → `Sərgi sabah açılacaq.`
- `Sərginin qapısı açıqdır.` → `Sərginin qapısı açıqdır.`
- `Əla nəticə əldə etmək üçün hər gün mütəmadi çalışmaq lazımdır.` → `Əla nəticə əldə etmək üçün hər gün mütəmadi çalışmaq lazımdır.`
- `ela netice elde etmek ucun her gun mutemadi calismaq lazimdir` → `Əla nəticə əldə etmək üçün hər gün mütəmadi çalışmaq lazımdır.`

15-söz head diaqnostikası: bounded exact 0.00% [0.00, 0.00], attention exact 0.00% [0.00, 0.00]. Neytral söz-mention konteksti istifadə edildi; bu, dolğun cümlədə editor nəticəsi deyil.
Candidate generator medianı: 10.72 [10.48, 12.15] ms/söz; MLP medianı: 0.00 [0.00, 0.00] ms/forward. İndeks qurma vaxtı xaric edilib, qlobal keşlər qızmış ola bilər; 17–56 ms/söz iddiasını universal nəticə kimi təqdim etmirəm.

### Çəki inventarı

| Artefakt | MLP giriş/hidden | MLP parametrlər | Attention əlavə parametrlər |
|---|---|---|---|
| attention-model.json | 71/12 | 877 | 272 |
| bounded-model.json | 71/12 | 877 | 272 |
| document-model.json | 24/12 | 313 | 0 |
| domain-model.json | 71/12 | 877 | 272 |
| log-model.json | 24/12 | 313 | 0 |
| model.json | 23/12, 23/12, 14/12 | 795 | 0 |
| sentence-boundary-model.json | 166/12 | 2017 | 0 |

Bu inventarda runtime neural JSON-larının MLP+query/bias parametrləri: 6885. Experimental institutional əlavə 313 parametrdir, runtime-a daxil deyil. Diskdəki data statistikalarını neyron parametr kimi saymıram.

Bütün lib/editor JSON: 5,634,256 bayt; birlikdə gzip: 1,161,692 bayt. Bu, həqiqi Next bundle/download ölçüsü deyil. Təklifdəki ~3.4 MiB əsasən model artefaktlarını sayır; generated lüğət daxil ediləndə ümumi ölçü daha böyükdür.

## Ablasiya

| Rejim | Exact, bootstrap CI | Dəyişən çıxış | Yaxşılaşan / pisləşən | 200 yeni söz median ms | 900 yeni söz median ms |
|---|---|---|---|---|---|
| default | 78.60% [74.40, 82.40] | 0 | 0 / 0 | 392.19 [309.30, 398.19] | 1768.61 [1685.01, 1818.53] |
| always | 79.00% [74.60, 82.80] | 2 | 2 / 0 | 2028.88 [1988.02, 2043.08] | 9207.87 [8931.33, 9309.94] |
| noLocal | 77.40% [73.00, 81.60] | 6 | 0 / 6 | 294.03 [286.63, 298.66] | 1467.33 [1367.69, 1505.88] |
| noAttention | 77.40% [73.00, 81.60] | 6 | 0 / 6 | 357.79 [346.09, 387.04] | 1675.68 [1600.54, 1764.82] |
| noBounded | 78.20% [73.80, 82.20] | 2 | 0 / 2 | 361.02 [314.96, 368.40] | 1635.69 [1535.80, 1733.35] |
| noObserved | 78.60% [74.40, 82.40] | 0 | 0 / 0 | 360.24 [316.35, 374.90] | 1663.18 [1536.00, 1864.42] |
| noBoundary | 78.60% [74.40, 82.40] | 0 | 0 / 0 | 354.35 [290.11, 376.50] | 1732.54 [1606.60, 1799.77] |
| rulesOnly | 77.40% [73.00, 81.60] | 6 | 0 / 6 | 279.21 [273.41, 290.96] | 1200.22 [1183.69, 1255.05] |

Yeni dəstdə default 393/500, rulesOnly 387/500-dir: modellər ən azı 6 tam cümlədə ölçülən fayda verir. Buna görə köhnə korpuslarda təsirsiz olmasını bütün real mətnlərə şamil etmək olmaz. Paired exact fərqinin bootstrap intervalı ablation.json-da saxlanılıb.
Bu bayraqlar hər başlığı ayrıca söndürmür: noBounded bounded/domain kompozisiyasını əhatə edir; document/log/lexical/agreement ayrıca idarə edilmir. Bununla onların ayrıca causal faydasını iddia etmirəm. `always` daha geniş legacy yolu açır. Ablasiya bir 500-sətirlik yeni dəstdədir; köhnə fixture-larda əlavə A/B olmayıb, yalnız default snapshot müqayisəsi aparılıb.

## Qalan xətalar və istinad mübahisələri

Yeni holdout-da 107 tam-cümlə uyğunsuzluğu; onların tam siyahısı `evaluation/phase0/quality.json`-dadır. Aşağıdakılar ilk nümunələrdir; targets nəticəyə görə dəyişdirilməyib:

- `p0-h-00-07-1`: `Yekun qeydə görə, məzun qəubl sənədini təqdim etdi.` → `Yekun qeydə görə, məzun qəubl sənədini təqdim etdi.`; hədəf `Yekun qeydə görə, məzun qəbul sənədini təqdim etdi.`.
- `p0-h-00-08-0`: `Təlimçi məəsləni lövhədə həll etdi.` → `Təlimçi məəsləni lövhədə həll etdi.`; hədəf `Təlimçi məsələni lövhədə həll etdi.`.
- `p0-h-00-08-1`: `Yekun qeydə görə, təlimçi məsələni löhədə həll etdi.` → `Yekun qeydə görə, təlimçi məsələni löhədə həll etdi.`; hədəf `Yekun qeydə görə, təlimçi məsələni lövhədə həll etdi.`.
- `p0-h-00-09-0`: `Kitabxanaçı köhnə dərsliyi bəpa etdi.` → `Kitabxanaçı köhnə dərsliyi bəpa etdi.`; hədəf `Kitabxanaçı köhnə dərsliyi bərpa etdi.`.
- `p0-h-01-06-1`: `Yekun qeydə görə, fizioterapevt məqşin müddətini azaltdı.` → `Yekun qeydə görə, fizioterapevt məqşin müddətini azaltdı.`; hədəf `Yekun qeydə görə, fizioterapevt məşqin müddətini azaltdı.`.
- `p0-h-01-07-1`: `Yekun qeydə görə, dietoloq qidalanma planını haırladı.` → `Yekun qeydə görə, dietoloq qidalanma planını haırladı.`; hədəf `Yekun qeydə görə, dietoloq qidalanma planını hazırladı.`.
- `p0-h-01-08-0`: `Stomatoloq dişin şəklini çədi.` → `Stomatoloq dişin şəklini çədi.`; hədəf `Stomatoloq dişin şəklini çəkdi.`.
- `p0-h-02-05-1`: `Yekun qeydə görə, mexanik müəhrrikin yağını yoxladı.` → `Yekun qeydə görə, mexanik müəhrrikin yağını yoxladı.`; hədəf `Yekun qeydə görə, mexanik mühərrikin yağını yoxladı.`.
- `p0-h-02-06-1`: `Yekun qeydə görə, nəzarətçi keçid kartını oxtdu.` → `Yekun qeydə görə, nəzarətçi keçid kartını oxtdu.`; hədəf `Yekun qeydə görə, nəzarətçi keçid kartını oxutdu.`.
- `p0-h-02-07-0`: `Kuryer bağlamanı ünvana çadırdı.` → `Kuryer bağlamanı ünvana çadırdı.`; hədəf `Kuryer bağlamanı ünvana çatdırdı.`.
- `p0-h-03-04-1`: `Yekun qeydə görə, briqada kaeblin yerini müəyyənləşdirdi.` → `Yekun qeydə görə, briqada kaeblin yerini müəyyənləşdirdi.`; hədəf `Yekun qeydə görə, briqada kabelin yerini müəyyənləşdirdi.`.
- `p0-h-03-05-0`: `Mütəxəssis batareyanın tuutmunu ölçdü.` → `Mütəxəssis batareyanın tuutmunu ölçdü.`; hədəf `Mütəxəssis batareyanın tutumunu ölçdü.`.

No-harm-da 6 sətir dəyişib (5 söz dəyişikliyi, 1 yalnız durğu):

- `afətinə`: `Mətndə afətinə sözü işlənib.` → `Mətndə Afətinə sözü işlənib.`.
- `qadir`: `Mətndə qadir sözü işlənib.` → `Mətndə qadır sözü işlənib.`.
- `bakıdır`: `Mətndə bakıdır sözü işlənib.` → `Mətndə Bakıdır sözü işlənib.`.
- `afətnin`: `Mətndə afətnin sözü işlənib.` → `Mətndə Afətnin sözü işlənib.`.
- `yoxsa`: `Mətndə yoxsa sözü işlənib.` → `Mətndə, yoxsa sözü işlənib.`.
- `şəbnəm`: `Mətndə şəbnəm sözü işlənib.` → `Mətndə Şəbnəm sözü işlənib.`.

`bakıdır`, `afətinə/afətnin`, `şəbnəm` üçün xüsusi adın böyük hərfi ilə sözün metadil olaraq xatırlanması arasında istinad mübahisəsi var; avtomatik hamısını real səhv elan etmək doğru deyil. `qadir→qadır` və “Mətndə, yoxsa...” daha güclü zərər namizədləridir. Heç bir sıra silinməyib/hədəf dəyişdirilməyib; gələcək expert annotation üçün ayrıca qeyd edildi.

## Gecikmənin sərhədləri

- Node TS import-u, CPU correction, heap/RSS ölçüldü; browser asset load, Web Worker start, SharedArrayBuffer və spekulyativ scheduling ölçülməyib. `<1s model load` hədəfinin brauzerdə keçdiyini demək olmaz.
- 200/900-söz warm mətn təkrarlanan cümlədir; novel mətn qızdırılmış JIT-dən sonra hər folded söz forması bir dəfə işlədilən **süni söz sırasıdır**, təbii sənəd deyil. İnput 10 000 simvol limitinə sığsın deyə 4–9 hərfli sözlərdən qurulub.
- İlk pilotda 900 uzun söz limitdən artıq oldu; nəticə atıldı, runtime limiti dəyişdirilmədən bütün ölçmə 4–9 hərfli sözlərlə yenidən başlandı.
- Eyni maşında default əvvəl və sonra iki dəfə ölçülüb; fərqlər runtime dəyişikliyindən deyil, ölçmə dəyişkənliyindəndir. Digər rejimlər bir dəfə ölçülüb; 15 sınaq/rejim/uzunluq, 10 soyuq proses. CI sampling dəyişkənliyidir, müxtəlif cihaz/real data uncertainty-si deyil.

## Yoxlamalar

| Komanda | Status |
|---|---|
| `node --import tsx scripts/eval/run.ts` | PASS |
| `node --import tsx scripts/eval/ablation.ts` | PASS |
| `node --import tsx scripts/eval/diagnose.ts` | PASS |
| `python scripts/eval/check-overlap.py` | PASS |
| `node --import tsx scripts/eval/snapshot.ts --compare=/tmp/sloth-ci-final-audit/snapshot.json --snapshot-out=/tmp/phase0-snapshot.json` | PASS |
| `npm test` | PASS |
| `npm run gold:check` | PASS |
| `npm run gold:exact` | PASS |
| `npm run local-ai:fresh:check` | PASS |
| `npm run quality:priorities` | PASS |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run benchmark:check` | PASS |

Mövcud runtime/frozen hədəflər dəyişdirilmədiyi üçün yeni ölçmə kodundan sonra keyfiyyətdə əvvəl/sonra artım iddiası yoxdur. Release/gold/baseline byte fərqləri yoxdur. Npm install yenidən işlədilmədi: mövcud node_modules istifadə edildi; typecheck/lint/build real icra olundu. Şəbəkə/lisenziya məhdudiyyətinin ətrafından keçilmədi.

## Faza qərarı və risklər

**Faza 0 ölçmə bazası yaradıldı; burada dayanıram.** Recall 90%-ə çatmır, no-harm “heç bir söz dəyişməsin” meyarı keçmir və sınaqlar ekspert tərəfindən təsdiqlənməyib. Ona görə yeni mühərriki professional, calibrated və production-qualified elan etmək olmaz; yalnız bu sınaqlardakı nəticələr bilinir.

Növbəti faza qanuni data manifesti, sənəd səviyyəli sızma nəzarəti, realist noise generatoru və ayrı kalibrləmə korpusudur. CC BY-SA/GFDL-dən çəkilərə hansı öhdəliklərin keçdiyini source-by-source analiz edib qərarı sahibə təqdim etmək lazımdır; bu fazada həmin qərar verilməyib.

Məxfilik auditi: browser correction yolunda inference service çağırışı tapılmadı. Mövcud app/page.tsx recordTransform localStorage-a input/output yazır (əvvəl istənilmiş log funksiyası); görünən ayrıca opt-in vəziyyəti bu fazada əlavə edilməyib. Yeni fazalarda razılıq/retention qaydasını açıq UX və testlə yoxlamaq lazımdır. Yeni ölçmədə şəxsi text serverə göndərilməyib.

Tam machine-readable nəticələr: `docs/evaluation/phase0/{quality,latency,latency-after,ablation,diagnostics,diversity,fixtures,overlap,checks}.json`. Təkrarlama əmrləri: `scripts/eval/README.md`.
