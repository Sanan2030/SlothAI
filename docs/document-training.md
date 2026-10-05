# Sənəd dövriyyəsi cümlələrindən lokal təlim

İstifadəçinin icazəsi ilə təqdim edilmiş sənəddən yalnız **145 ayrı ümumi cümlə** seçilib. Şəxs, şirkət və təşkilat adları, titul səhifələri, müəllif məlumatları, şəkillər, mündəricat, siyahı etiketləri və təkrar hissələr təlimə daxil edilməyib. Mənbə DOCX və tam sənəd repository-yə əlavə edilməyib. Sənəd mənbə kimi SHA256 ilə identifikasiya edilir; yeni data və model üzərində adların xaric edilməsinə ayrıca yoxlama aparılıb.

Seçilmiş mənbə: `data/nlp/documents/document-workflow-001.json`. Cümlələrin ilkin abzas nömrələri saxlanılır; mənbədəki bir neçə kiçik yazı/boşluq səhvi assistent tərəfindən normallaşdırılıb. Bunlar dilçi təsdiqli və ya istifadəçinin ayrı-ayrı təsdiqlədiyi hədəflər deyil. Yeni lüğət materialı yalnız seçilmiş cümlələrdən alınır; mənbədəki şirkət və şəxs adları lüğətə əlavə edilmir.

Bir sənədin bütün cümlələri yalnız **train** bölməsinə aiddir. Eyni sənəddən validation/test nümunəsi yaradılmır. NFC/fold normallaşdırılmış eyni hədəflər və token-bigram Jaccard ≥ 0.72 yaxın cümlələr çıxarılır. Mövcud `tests/fixtures/` JSON-larında bütöv normallaşdırılmış hədəf üst-üstə düşməsi: **0**.

## Təlim və iş vaxtı

- 145 əsas cümlədən 408 fərqli giriş–hədəf cütü: düzgün girişlər, xüsusi hərfləri silinmiş ASCII və sh/ch/gh variantları. Bunlar süni xətalardır, real istifadəçi səhvləri deyil; variantlar əlavə müstəqil mətn kimi sayılmır.
- 5330 unikal xüsusiyyət vektoru, 3092 müsbət nümunə, 464 söz forması.
- CPU-da deterministik SGD: 96 dövr, 24 giriş xüsusiyyəti, 12 tanh gizli vahid, **313 parametr**.
- Öz təlim dəstində BCE: 0.689513 → 0.000831. Bu göstərici ümumiləşmənin sübutu deyil.
- Əvvəlcədən sabit yüksək qəbul həddi 0.9999, fərq 0.2, ən azı iki fərqli yaxın kontekst sözü. Yeni testlərə baxaraq hədlər tənzimlənməyib; mövcud modellərin hədləri və çəkiləri dəyişdirilməyib.
- Modelin yaddaşında tam cümlələrin cavab cədvəli yoxdur: söz variantları, kontekst sayğacları və kiçik neyron çəkilər istifadə olunur. Düzgün/tanınmış söz, texniki termin və xüsusi ad qorunur; nəticə tanınmış lüğət/mənbə formasına uyğun gəlməlidir.
- Bu əlavə model yalnız ehtiyatlı ASCII/digraph söz bərpasıdır. Ümumi məna anlama, yeni fikir yazma və sərbəst qrammatik yenidənqurma modeli deyil. Namizəd, müşahidə edilmiş düzəliş və kontekst sayları da xüsusiyyətlərə daxildir; nəticə yalnız neyron ümumiləşmə kimi təqdim edilmir.
- Brauzerdə işləyir; iş vaxtı API, Python, model serveri və şəbəkə çağırışı yoxdur. Mətn və email eyni əsas düzəliş mərhələsindən istifadə edir.

## Nəticələr

| Dəst | Əvvəl | Sonra |
|---|---:|---:|
| Mənbənin ASCII girişlərində tam düzgün cümlə | 70/145 | 88/145 |
| Ayrıca müəllifləşdirilmiş 30 cümlədə tam düzgün nəticə | 27/30 | 27/30 |
| Ayrıca dəstdə leksik precision | 100% | 100% |
| Ayrıca dəstdə leksik recall | 96.74% | 96.74% |
| Ayrıca dəstdə dəyişdirilmiş düzgün giriş | 0/10 | 0/10 |
| Yeni rankerin dəyişdirdiyi düzgün mənbə cümləsi | — | 0/145 |
| Ayrıca dəstdə ikinci keçid xətası | — | 0/30 |

**70 → 88 təlim diaqnostikasıdır, müstəqil dəqiqlik deyil.** Yeni 30 cümlə assistent tərəfindən ayrıca yaradılıb və süni xətalarla qiymətləndirilib; real/human-reviewed qiymətləndirmə deyil. Bu dəstdə dəqiqlik artmayıb. Üç qalan leksik xəta: `tenzimlenir → tənzimlənir`, `xanasina → xanasına`, `saxlanilmadan → saxlanılmadan`. Təlim və qəbul hədləri bunları görüb dəyişdirilməyib.

Tam nəticələr `data/nlp/documents/document-before-report.json`, `document-evaluation-report.json` və `document-source-diagnostics.json` fayllarındadır. Yeni test SHA256 ayrıca `.sha256` faylında dondurulub. Yalnız yeni rankerin mənbədəki 145 düzgün cümləni qoruması bütün redaktorun hər düzgün mətni qoruduğu mənasına gəlmir; əvvəlki məna/üslub məhdudiyyətləri qalır.

## Yoxlamalar

4049/4049 regressiya testi, `gold:exact` 1000/1000, typecheck, lint, production build və dəyişdirilməmiş performans hədləri yoxlanılır. Son lokal isti benchmark-da p95 1000 söz üçün 1623.86 ms, 5000 söz üçün 8496.77 ms-dir; bütün hədlər keçib, bu bütün cihazlara zəmanət deyil. Yeni model təkrar təlimdə bayt-bayt eyni faylı yaradır; bu yoxlama CI-yə də əlavə olunub. Yeni runtime JSON artımı **126324 bayt = 126.324 KB = 123.363 KiB**; `lib/editor` JSON cəmi generated lüğət daxil **5197297 bayt**.

Əvvəlki commit-in CI yoxlamasında ayrıca köhnə cümlə sərhədi modelinin təkrar istehsalı pozulmuşdu: runtime-a əlavə edilmiş xüsusi ad xəbərlik formaları dondurulmuş entity xüsusiyyətlərini dəyişirdi. Classifier üçün ilkin entity tanınması ayrıldı; runtime yeni formaları tanımaqda davam edir. Dondurulmuş sərhəd modelinin özü, hesabatı, çəkiləri, təlim data bölgüsü və qəbul həddi dəyişdirilmədən yenidən bayt-bayt eyni hasil olunur.

```sh
npm run nlp:document:train -- --output=/tmp/document-model.json
cmp /tmp/document-model.json lib/editor/neural/document-model.json
npm run nlp:document:evaluate
npm test
npm run gold:exact
npm run typecheck
npm run lint
npm run build
npm run benchmark:check
```
