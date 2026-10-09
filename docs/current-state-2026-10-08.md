# SlothAI — cari vəziyyət və əsas düzəlişlər

**9 oktyabr yeniləməsi:** qəbul edilmiş altı korpus arxivi və təzə tam data gate
yoxlamadan keçdi. CharSpell, WordLM və PunctCase üçün 100k train / 10k validation
CPU smoke təlimləri tamamlandı. Ölçülər və qalan mərhələlər
[yeni təlim hesabatındadır](training/smoke-2026-10-09.md); aşağıdakı audit
8 oktyabr versiyasının tarixi nəticələrini saxlayır.

Yoxlama tarixi: **8 oktyabr 2026, Bakı vaxtı**.
Təhlil olunan versiya: `0bf77b94ab53b507faa6d753fda0a2d43ac202d5`.
Bu yeniləmə README və audit sənədlərini dəyişir; yeni korpus təlimi aparılmır.

## Cari nəticə

SlothAI işləyən yerli Azərbaycan dili redaktorudur. Mətn düzəltməsi, e-poçt
formatlaması, Worker emalı, dəyişikliklərin göstərilməsi, şəxsi lüğət qaydaları
və istifadəçinin təsdiqlədiyi testlərin fayla yazılması mövcuddur. Kiçik neyron
klassifikatorlar, statistik modellər və qaydalar işləyir. Ümumi dil modeli və
ya sərbəst mətn üçün təsdiqlənmiş qrammatika/semantika keyfiyyəti yoxdur.

Mərhələ 1-in qəbul edilmiş korpus manifesti və arxiv auditləri saxlanır.
Mərhələ 2-də sözün dilçilik etiketi qarşısında qorunması əlavə edilib.
Sonrakı təlimlər üçün import, hash yoxlaması, split qorunması, hazırlıq,
CPU/CUDA seçimi, checkpoint və smoke hesabatı alətləri mövcuddur.
Mərhələlər 3–7 tamamlanmış sayılmır; yeni CharSpell/WordLM/PunctCase
modelləri təlim almamış və redaktora qoşulmamışdır.

Yoxlama başlananda uzaq `main` (`9bd4531`) bu versiyadan 15 commit geridə idi;
tarixçələr ayrılmamışdı. İstifadəçinin son göstərişinə əsasən tamamlanmış
dəyişikliklər yoxlamalardan sonra normal push ilə `main`-ə çatdırılır.

## İşləyən funksiyaların yoxlanması

Mövcud production build lokal `next start` ilə işə salındı:

| Yoxlama | Nəticə |
| --- | --- |
| Ana səhifə | HTTP 200, SlothAI adı mövcuddur. |
| `/api/strategies` | HTTP 200, mətn və e-poçt strategiyaları mövcuddur. |
| Mətn: `men bu gun mektebe getdim` | HTTP 200: `Mən bu gün məktəbə getdim.` |
| E-poçt: `hesabat hazirdir`, salamlaşma `Salam,` | HTTP 200: salamlaşma + `Hesabat hazırdır.` + `Hörmətlə,`. |
| Boş mətn / naməlum strategiya | Müvafiq HTTP 400 / 404. |
| Qəbul edilməyən salamlaşma `Salam` | HTTP 400; API əvvəlcədən müəyyənləşdirilmiş siyahını tələb edir. |
| `/api/health` | HTTP 200; yalnız servis canlılığı, model hazırlığı yoxlanmır. |
| `npm run training:status` | Gözlənilən exit 2, `blocked`; manifest və altı korpus faylı yoxdur. |

Browser UI üçün yeni avtomatlaşdırılmış end-to-end yoxlama aparılmadı; UI
funksiyaları mənbə kodundan və mövcud uğurlu regressiya yoxlamalarından müəyyənləşdirildi.

## Əsas düzəlişlər — prioritet sırası

P0 təlimə başlamaq üçün bloklayıcıdır. P1 real keyfiyyət və yeni model buraxılışı
üçün vacibdir. P2 resurs, giriş dayanıqlığı və server istismarı üçündür.

| Prioritet | Problem və sübut | Görüləcək iş / qəbul meyarı |
| --- | --- | --- |
| **P0 — korpus** | `training:status` kanonik manifest və altı JSONL faylının olmadığını göstərir. Arxiv gate nəticəsi bu maşında bulk yoxlamasının əvəzi deyil. | Altı orijinal gzip hissəsini təmin etmək; import zamanı sıxılmış/açılmış hash və ölçüləri yoxlamaq; tam data gate keçmədən hazırlıq/təlimə başlamamaq. |
| **P1 — real mətn və düzgün sözlərin qorunması** | Arxiv holdout: 393/500 tam düzgün, 108 buraxılmış xəta və bir zədələnmiş düzgün söz. Ayrıca 2,000 mention kontekstində sıfır zərər var. 12 istifadəçi mənşəli development nümunəsindən yalnız 4-ü tam düzgündür; bu kiçik dəst kor test deyil. | Ayrı insan yoxlamalı real mətn qiymətləndirməsi qurmaq; ümumi kontekst üzrə səhv dəyişiklikləri ölçmək; təlim/kalibrasiya üçün bu testləri istifadə etməmək. Mention guard-ı bütün mətn üçün zəmanət saymamaq. |
| **P1 — namizəd söz axtarışı** | Aktiv `boundedCandidates` 1,600 sorğu və 24 nəticə ilə məhduddur; ümumi iki redaktə məsafəli axtarış yoxdur. SQLite offline indeksi browser implementasiyası deyil. | Mərhələ 3 üçün binary namizəd indeksi və morfologiya inteqrasiyasını hazırlamaq; train/development üzərində retrieval recall@10 və eyni şəraitdə browser latency ölçmək. Phase0 hədəflərini qaydaya çevirməmək. |
| **P1 — təlim nümunələrinin əhatəsi** | CharSpell hazırlığı yalnız bir söz→bir söz dəyişmələrini və identity sözlərini öyrədir. Birləşdirmə/ayırma və digər çoxsözlü dəyişmələr sayılıb ötürülür; target namizədlərdə yoxdursa nümunə də ötürülür. | İlk hazırlıqda category/skip/identity saylarını və retrieval misses-i yoxlamaq; tələb olunan spacing xətaları üçün ayrıca mexanizm planlamaq. Namizəd olan nümunələrdəki accuracy-ni bütün xətalara aid etməmək. |
| **P1 — təlim və browser buraxılışı** | CharSpell/PunctCase Python modelləri və WordLM aləti mövcuddur; həqiqi smoke/full nəticələri, TypeScript/int8 eksportu və Worker inteqrasiyası yoxdur. | Yalnız qəbul edilmiş train split ilə 100k–500k smoke; ölçülmüş resursa əsasən tam təlim. Sonra eksport, golden parity ≤1e-3, ablation və shadow→opt-in→default mərhələləri. Mövcud çəkiləri avtomatik əvəz etməmək. |
| **P1 — kalibrasiya və mərhələ gate-ləri** | Ayrıca ən azı 5,000 real xəta cütü verilməyib. Full-run guard uğurlu smoke, arxitektura və hash uyğunluğunu yoxlayır; bütün keyfiyyət gate-lərini avtomatik tətbiq etmir. WordLM lambda seçimi yoxdur. | Ayrı `data/calibration/` yaratmaq; threshold/lambda/no-harm seçimini burada etmək; mərhələ qəbul hesabatlarını buraxılış yoxlamasına bağlamaq. Test/phase0 yalnız son ölçmə üçün qalmalıdır. |
| **P2 — WordLM naməlum sözləri** | Train-də çıxış sinfi olmayan söz `<unk>`-a düşə bilər; həmin sinif də müşahidə edilməyibsə ehtimal sıfır, perplexity sonsuz olur. Suffix sinifləri yalnız heuristikadır. | OOV siyasətini train əsasında müəyyənləşdirmək, normallaşmanı və sonlu ehtimalları yoxlamaq; perplexity ilə yanaşı düzəliş faydası və no-harm ölçmək. Sıfır ehtimalları süni floor ilə gizlətməmək. |
| **P2 — Unicode etiket offset-ləri** | `word_matches` NFC mətnində offset verir, `tag_sentence` isə boşluq/durğunu orijinal mətnindən kəsir. Texniki diaqnostikada NFC `Gözəl.` üçün etiket `2`, NFD `Gözəl.` üçün `-100` oldu. | Tokenlər, qorunan span-lər və punctuation üçün eyni normalizasiya/offset bazası seçmək; NFC/NFD parity-ni qorumaq. Qəbul edilmiş bulk faylları əldə edilmədiyindən onların təsirləndiyi iddia edilmir. |
| **P2 — az resurs və soyuq açılış** | Expert Worker seçimi CPU sayına/data-saving seçiminə baxır, RAM-a baxmır; əlavə Worker-lər lüğət/model nüsxələri yarada bilər. Node benchmarkı mobil browser ölçməsi deyil. | Real aşağı resurslu cihazlarda cold/warm p95 və yaddaşı ölçmək; model/lüğət yükləməsini tənbəl etmək, indeks ölçülərini və Worker siyasətini ölçmələrə görə seçmək. |
| **P2 — server və deploy yoxlamaları** | API limiter yalnız proses yaddaşındadır; health model hazırlığını yoxlamır. `main` qorunmur; Vercel build statusu tam CI-nin keçməsini təmin etmir. | Server API geniş istifadə olunacaqsa ortaq limiter və engine readiness yoxlaması əlavə etmək. Deploy-u uğurlu yoxlamalarla əlaqələndirmək; main-ə çatdırılma seçimini saxlayaraq uğursuz build/test-i görünən etmək. |

Mənbələr: [candidate generation](../lib/editor/neural/bounded-candidates.ts),
[CharSpell hazırlığı](../training/prepare.py), [təlim guard-ları](../training/run.py),
[WordLM](../training/wordlm.py), [Unicode etiketləri](../training/text.py),
[Worker seçimi](../lib/workers/expert-pool.ts), [API limiter](../lib/rate-limit.ts),
[health endpoint](../app/api/health/route.ts).

## Data və ölçmələr haqqında sərhədlər

Qəbul edilmiş split: **3,287,357 train / 1,082,532 validation / 630,111 test**.
5M təmiz cümlə və 5M sintetik cüt insan tərəfindən tam yoxlanmayıb;
OCR/yazılış/seqmentasiya qalıqları mümkündür, e-poçt janrı zəifdir.
Identity cütləri bütün split-lərdə cəmi 1,058,544-dür; hamısının train olması
iddia edilmir. Yeni model kartında bu məhdudiyyətlər saxlanmalıdır.

Qəbul edilmiş `MANIFEST.json` faylının SHA-256-sı lokal yenidən hesablanıb
receipt ilə uyğunluğu təsdiqləndi:

```text
dcfbaf41c84d3eb1c92ad47ff3a633d5fae692a6075597ac579298f48cccb2fd
```

Bu yalnız repodakı manifestin bütövlüyüdür; çatışmayan bulk fayllarının hash-i
yoxlanmış sayılmır. CharSpell üçün cütlər/identity, WordLM üçün təmiz train,
PunctCase üçün təmiz cümlədən etiketlər istifadə edilməlidir. Validation model
seçimidir, kalibrasiya deyil; test və phase0 öyrədilməməlidir.

Arxiv Stage 2 ölçmələri: precision **99.439%**, recall **83.125%**,
recall bootstrap 95% intervalı **[78.9649%, 86.2342%]**. Holdoutun təkrarlanan
şablon/sintetik quruluşu real istifadəçi mətnini təmsil etmir. Preservation
dəstində sıfır hadisə gələcək mətnlər üçün sıfır risk demək deyil.

## Yoxlamaların sübutu və bu dəyişiklik

`0bf77b9` commitinin iki GitHub production yoxlaması, iki offline-contract
yoxlaması və Vercel preview deploy statusu uğurludur. Nümunə CI run-ları:
[production](https://github.com/Sanan2030/SlothAI/actions/runs/37770158870),
[offline contracts](https://github.com/Sanan2030/SlothAI/actions/runs/37770158820).
Lokal arxiv [verification.json](../training/verification.json) 4,515 Node,
18 data və 16 training contract keçdiyini, typecheck/lint/build/benchmark
nəticələrini qeyd edir. Bu sənədləşdirmə yeniləməsi həmin runtime-ı dəyişmir.
Yeni yoxlamalar yuxarıdakı production sorğuları, readiness/manifest yoxlaması,
Unicode texniki diaqnostikası, 29 yerli sənəd keçidi və 30 npm əmri istinadının
uğurlu yoxlanması və `git diff --check` ilə məhdudlaşır.

Avtomatik browser jurnalı son 50 nəticəni lokal saxlayır; JSON eksportu
istifadəçi hərəkətidir. Şəxsi lüğət yalnız təsdiqlənmiş qaydaları tətbiq edir.
Bu audit qeydiyyat və data hüquqları siyasətini dəyişmir.
5M smoke/full təlimi başladılmayıb, GPU icrası və real korpus sürəti ölçülməyib.

Ətraflı: [Stage 2](stage2/README.md),
[qəbul edilmiş korpus](stage1/collection/accepted-2026-10-08.md),
[sonradan təlim üçün addımlar](../training/README.md),
[əsas README](../README.md).
