# a–h düzəlişləri və ayrıca qiymətləndirmə

Baza: `8a8f5ca`; söz/morfologiya commit-i: `62fac36`; kontekst/durğu commit-i: `04e8350`.
İş vaxtı yeni LLM, API, Python, şəbəkə çağırışı və dependency əlavə edilməyib. Mövcud neyron çəkilər və hədlər dəyişdirilməyib.

## Konkret a–h nəticələri

Səkkiz giriş cari baza ilə təkrarlandı. Baza tam hədəflərin 0/8-ni verirdi; düzəlişlərdən sonra 8/8 dəqiqdir və ikinci keçid dəyişmir. Tam giriş/baza çıxışı/hədəf/yeni çıxış `a-h-requested-results.json` faylındadır.

| Xəta | Düzəliş |
|---|---|
| a | sür + dü və müştəri + lər + lə formalarının bərpası |
| b | şəkilçili sh/ch yazılışı, hazırla + ş + malı analizi; çünki vergülü |
| c | abidə üçün yoxlanılmamış şəkilçi təxmininin rəddi; Bakıdır xəbərlik forması |
| d | danışıq variantı necəsən; çıxaq optativi və sual/dəvət sərhədi |
| e | yalnız aydın status + eyni/sabit/dəyişməz kontekstində qalıb; winner və ziddiyyətli kontekstdə abstain |
| f | ol + malı + dır + lar zənciri və son nöqtə |
| g | tamamlanmış xəbərdən sonra ona görə səbəb bağlayıcısının vergülü |
| h | texniki təyin + yiyəlikli nominativ isim + ikinci xəbər olduqda sərhəd |

Legacy fallback artıq tanınmış kök və həqiqi lemma qaytarır; POS məlum olmayan lüğət köklərinə saxta POS təyin edilmir. Bu, Azərbaycan dilinin tam morfoloji analizatoru deyil. Mövcud dondurulmuş feature mühərrikləri dəyişməyib. Runtime paradigmləri lemma ilə indekslənib.
Leksik və statistik söz namizədləri yerli lüğət, kurasiya edilmiş terminlər və ya morfoloji analizlə təsdiqlənməlidir. Tanınma düzgün mənanın sübutu deyil: başqa düzgün sözə yanlış çevrilmə hələ mümkündür.
Email abzaslandırılmasında əlavə tapılan URL/e-poçt/kod nöqtələrinin parçalanması da düzəldilib.

## Dondurulmuş 300 cümlə

300 fərqli hədəf, 20 tematik kompozisiya ailəsi × 5 mübtəda × 3 xəbər. 60 dəyişməməli giriş, 60 digraph və 180 diakritika girişidir. Nümunələr assistent tərəfindən yaradılıb; real istifadəçi, human-reviewed və ya dilçi təsdiqli data deyil. Bir ailənin nümunələri korrelyasiyalıdır; 300 müstəqil real dil müşahidəsi kimi təqdim edilmir.
Təlim/tənzimləmə üçün istifadə edilməyib. SHA256 tətbiq kodu dəyişməzdən əvvəl commit `3694a01` ilə dondurulub; əvvəl nəticələrinin məzmunu və son nəticələr yalnız kod/gold yoxlamaları tamamlandıqdan sonra açılıb. `data/` JSON-larında normallaşdırılmış bütöv hədəf üst-üstə düşməsi: 0. Leksik sözlərin train ilə ortaq olması təbiidir; real sənəd və məna ümumiləşməsi barədə sertifikat yoxdur.
Hash: `4c81864af86066a234a8cb94e0b8e13ccf268bc9e78bf4c409fd58436ed46187`.

| Göstərici | Əvvəl | Sonra |
|---|---:|---:|
| Tam düzgün cümlə | 244/300 (81.33%) | 244/300 (81.33%) |
| Söz düzəlişi precision | 98.40% | 98.49% |
| Yanlış söz düzəlişi / bütün təklif edilmiş söz düzəlişləri | 1.60% | 1.51% |
| Söz düzəlişi recall | 94.06% | 94.06% |
| Söz F0.5 | 97.50% | 97.57% |
| Söz WER | 3.97% | 3.91% |
| CER (durğu daxil) | 0.91% | 0.89% |
| Dəyişdirilmiş düzgün giriş | 1/60 | 1/60 |
| İkinci keçiddə dəyişmə | 0/300 | 0/300 |
| Leksik abstain | 4.60% | 4.60% |

Leksik precision/recall: NFC, hərf tokenləri, registr saxlanılır, eyni mənbə token span-ında dəqiq tək-reference edit uyğunluğu. Full-output metrics əlavə olaraq durğu/boşluğu hesablayır. Abstain: bərabər token saylı sətirlərdə reference-ə görə səhv olan, çıxışda isə giriş kimi qalan tokenlər / reference səhv tokenləri; bu, kalibrə edilmiş model əminliyi deyil. Sonra: 48/1043.

**Ümumi cümlə dəqiqliyi artmayıb. 56 cümlə hələ hədəfə uyğun deyil.** A–h düzəlişləri bu yeni dəsti bütövlükdə həll etmir. Dəsti görüb tuning etmədik; bütün uğursuz giriş/hədəf/çıxışlar `release-holdout-after.json` içindədir.

## Qalan söz səhvləri

| Faktiki → hədəf | Token sayı |
|---|---:|
| cavablandirdi → cavablandırdı | 16 |
| sürətini → surətini | 8 |
| şərği → sərgi | 5 |
| menbeyini → mənbəyini | 4 |
| refe → rəfə | 4 |
| duzdu → düzdü | 4 |
| sertlerini → şərtlərini | 3 |
| uzvu → üzvü | 3 |
| Insan → İnsan | 2 |
| Şərğinin → Sərginin | 2 |
| konullusu → könüllüsü | 2 |
| Idmanci → İdmançı | 2 |
| Idman → İdman | 2 |
| Icra → İcra | 2 |
| alindighini → alındığını | 1 |
| Marsrutun → Marşrutun | 1 |
| Marshrutun → Marşrutun | 1 |
| Seher → Şəhər | 1 |

Ən vacib qalıqlar: sərgi kimi artıq düzgün sözün dəyişdirilməsi; surət/sürət və səhər/şəhər mənalarının qarışması; yeni törəmə köklər; ASCII böyük I/İ; tam sintaktik və semantik analizin olmaması. Lüğətə/modelə etibarlı söz əlavə etmək təkbaşına bu məna problemlərini həll etmir.

## Mövcud gold hədəfi barədə qeyd

`rsd-it-103` üçün dondurulmuş hədəf `Mobil imza prosesində vaxt asımı baş verdi.` yazılışını saxlayır. Vaxtın aşılması mənasında bu forma dil baxımından ayrıca yoxlanmalıdır; daha təbii ifadə `vaxt həddi aşıldı` ola bilər. Gold faylı dəyişdirilməyib. Lüğətdə ayrıca mövcud `as` kökünün adi isim paradigmi `asımı` formasını morfoloji tanıyır; bu tanınma həmin cümlənin mənasını təsdiqləmir.

## Yoxlamalar və ölçü

- `npm test`: 4045/4045; 1000 gold testində dəqiq çıxış və sabit ikinci keçid.
- `npm run gold:exact`: 1000/1000; mövcud gold/hədlər/baseline-lar dəyişməyib.
- `npm run typecheck`, `npm run lint`, `npm run build`: keçib.
- `npm run benchmark:check -- --json`: bütün hədlər keçib; p95 1000 söz 1424.82 ms, 5000 söz 7377.45 ms. 5000 sözlük sənəd 5 təhlükəsiz hissədə işlənir. Bunlar lokal isti benchmark ölçüləridir, bütün cihaz/mətn üçün zəmanət deyil.
- `lib/editor` JSON: 5,070,973 bayt; bunun 1,627,323 baytı generated lüğətdir, qalan 3,443,650 bayt digər artefaktlardır. Əvvəl/sonra eynidir: **artım 0 KB (0 KiB)**.

```sh
npm ci
npm test
npm run gold:exact
npm run typecheck
npm run lint
npm run build
npm run benchmark:check
node --import tsx scripts/evaluate-release-holdout.ts --output=/tmp/slothai-holdout.json
```
