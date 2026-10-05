# Log əsasında offline düzəliş və təlim — 5 oktyabr 2026

Başlanğıc: `main` commit `39fbdf3cdf351d9b1de200d7c766ebb42bffe16c`.

Yüklənən logda dörd qeyd, üç fərqli giriş var; böyük OCR siyahısı iki dəfə təkrarlanır. Təkrar bir dəfə nəzərə alındı. Köhnə çıxışlar düzgün hədəf kimi götürülmədi: hədəfləri assistent ayrıca redaktə etdi. Bunlar insan/dilçi tərəfindən yoxlanmış nümunələr deyil.

Şəxsi ad əvəzliklə dəyişdirildi. Şirkət, filial və xarici komanda adları təlimə daxil edilmədi. Tam orijinal log repoya əlavə edilmədi. Qeyri-müəyyən, kəsilmiş OCR fraqmentləri təlimdən çıxarıldı.

## Dəyişikliklər

- 14 ayrı cümlədən 48 müşahidə/identity/ASCII/digraf cütü hazırlandı; müşahidə edilmiş və sintetik xətalar ayrılır.
- Əlavə 24 girişli, 12 gizli vahidli, 313 parametrli lokal namizəd seçici 200 epoch təlim keçdi. Mövcud modellərin çəkiləri dəyişmədi.
- Seçim ən az iki kontekst sözünün dəstəyi, 0,999 skor həddi və 0,2 namizədlərarası fərq tələb edir. Skor kalibrə edilmiş düzgünlük ehtimalı deyil. Hədd yeni başlıq üçün təlim diaqnostikasında seçildi; əvvəlki dondurulmuş model hədləri dəyişdirilmədi.
- `dayandıqca`, `əllərində`, `hazırlaşırdılar`, `hədəflərə`, `beynində`, `ssenariləri`, `təkrarlayır`, `baxarkən` kimi formalar bərpa edilir; mənbədən alınan tanınmış defisli sözlər bütöv bərpa edilir.
- Əhəmiyyət kontekstində `kəsf` → `kəsb`; həqiqi kəşf konteksti qorunur.
- 100 yoxlanmış OCR token qeydi 99 unikal lokal xəta xəritəsinə çevrildi. Bu hissə neyron məna modeli deyil, müşahidə olunmuş xəta kanalıdır.
- OCR kanalı yalnız ən az üç qısa sətrə və iki şöbə/departament göstəricisinə malik sadə siyahılarda işləyir. Kod, URL, email və Markdown strukturu bu kanala ötürülmür.
- Sözün içindəki səhv `;`, `$`, `5`, `9` simvolları yalnız öyrənilmiş konkret tokenlərdə düzəlir; ümumi simvol əvəzləməsi yoxdur. Siyahı başlıqlarına artıq nöqtə əlavə olunmur. Aydın `departamenti`/`şöbəsi` davam sətirləri birləşdirilir.
- Filial adları dəyişdirilmir; yalnız `filiall` → `filialı` sonluğu düzəlir və ikinci keçid sabit qalır.
- Yarımçıq “... var məsələn” ayrıca tam cümləyə çevrilmir, vergül və üç nöqtə ilə saxlanır; çatışmayan nümunə uydurulmur.

## Əvvəl / sonra

| Ölçü | Əvvəl | Sonra |
| --- | ---: | ---: |
| Logdan alınmış 14 cümlənin tam uyğunluğu — təlim diaqnostikası | 4/14 | 14/14 |
| Ayrı hazırlanmış 20 yeni kontekst/format sınağının tam uyğunluğu | 6/20 | 17/20 |
| Yeni dəstdə söz səviyyəsində tam uyğunluq | 8/20 | 18/20 |
| Yeni dəstdə leksik düzəliş precision | 88,57% | 100% |
| Yeni dəstdə leksik düzəliş recall | 44,29% | 97,14% |
| Yeni dəstdə tam çıxış precision, durğu daxil | 45,90% | 98,53% |
| Yeni dəstdə ikinci keçiddə dəyişən nümunə | ölçülməyib | 0/20 |

20 nümunə ayrıca assistent tərəfindən yazılmış sintetik diaqnostik dəstdir; təlimə əlavə edilməyib və SHA-256 ilə dondurulub. Təlimlə söz ehtiyatını paylaşır və inkişaf zamanı təkrar yoxlanıb: kor, real istifadəçi testi və ümumi dil dəqiqliyi barədə sertifikat deyil. 14/14 nəticəsini müstəqil model dəqiqliyi kimi təqdim etmək olmaz.

Əlavə ranker təkbaşına lazım olan 56 token düzəlişinin 37-sində dəyişiklik etmədi: abstain 66,07%. Bu, bütöv redaktorun xəta faizi deyil; bu halların çoxunu mövcud başlıqlar düzəldir. Ranker etibarlı sözləri və zəif konteksti məqsədli şəkildə saxlayır.

Bütöv, adı əvəzlənmiş 1713 simvolluq hekayə də gözlənilən mətnlə tam uyğun gəlir və ikinci keçiddə dəyişmir. Tam OCR siyahısının ikinci keçidi də sabitdir; qeyri-müəyyən və xarici adlar üçün tam düzgünlük iddiası yoxdur.

## Qalan xətalar

1. Yeni qısa kontekstdə `hedeflere` bəzən saxlanır: kifayət qədər kontekst dəstəyi yoxdur.
2. Yeni qısa kontekstdə `tekrarlayir` bəzən saxlanır; uzun log cümləsində düzəlir.
3. Yalnız URL, email və inline koddan ibarət sətirə mövcud ümumi durğu modulu nöqtə əlavə edir. Leksik məzmun dəyişmir, amma həmin identity sınağında tam çıxış fərqlənir.
4. Kəsilmiş OCR sözləri və bərpası birmənalı olmayan başlıqlar saxlanır. Xarici komanda adlarının orfoqrafiyası bu Azərbaycan dili təliminin hədəfi deyil.

Bu dəyişiklik ümumi məna anlayışı və sərbəst cümlə yenidən yazan model yaratmır. Daha geniş real, ayrıca yoxlanmış korpus hələ lazımdır.

## Resurs və təkrar istehsal

Əlavə neyron model: 36 296 bayt; OCR kanalı: 3 053 bayt. `lib/editor` JSON cəmi 5 197 297 → 5 236 646 bayt: **+39,349 KB / +38,427 KiB**. İş vaxtı yalnız brauzerdə TypeScript və paketlənmiş JSON işləyir; Python, LLM, xarici API və model yükləmə tələb etmir.

```sh
npm run nlp:log:train
npm run nlp:log:evaluate
```

CI hər iki artefaktın təkrar yaradılmasını müqayisə edir. Rəqəmlər və fərdi səhvlər `data/nlp/logs/log-evaluation-report.json` faylındadır. Orijinal gold faylları, baseline-lar və əvvəlki modellər dəyişdirilmədi.

## Yekun yoxlama

`npm test`: 4053/4053; `gold:exact`: 1000/1000; yeni log testləri 4/4; typecheck, lint və production build keçir. Artefaktın yenidən təlimi byte-for-byte eyni nəticə verir.

`benchmark:check` bütün hədləri keçir: 1000 söz üçün p95 **1684 ms**; 5000 söz üçün p95 **8443,02 ms**. Sonuncu 37 528 simvoldur və mövcud 10 000 simvol limiti səbəbindən beş təhlükəsiz hissədə ölçülür. Bunlar bu mühitin CPU nəticələridir, bütün cihazlar üçün 10 saniyə zəmanəti deyil. Tam ölçülər `data/nlp/logs/log-benchmark-report.json` faylındadır.
