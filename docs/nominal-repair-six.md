# Altı nominal düzəliş xətası

Başlanğıc main: `414c0a43e0b5c22d9d3a567b3040128ecc531c2e`.

| Girişdəki söz | Düzgün forma | Əvvəlki səbəb |
| --- | --- | --- |
| maktubları | məktubları | Düzgün namizədin balı 0,777 idi, hədd 0,9 idi. |
| qovluqqların | qovluqların | Təkrar hərf namizədi tapılırdı, balı 0,276 idi. |
| Əməkkdaşları | Əməkdaşları | Düzgün namizəd tapılırdı, balı 0,792 idi. |
| Taləbələrin | Tələbələrin | Düzgün namizəd tapılırdı, balı 0,623 idi. |
| senadlərini | sənədlərini | Tam şəkilçili forma kiçik neural namizəd lüğətində yox idi. |
| Hesabbatlardakı | Hesabatlardakı | Təkrar hərf və nisbi şəkilçili forma üçün namizəd yox idi. |

## Ümumi düzəliş

Modelin ümumi qəbul həddi və çəkiləri dəyişdirilməyib. Yeni konservativ
morphology fallback yalnız tanınmayan isim formalarında işləyir:

1. Təlimdə öyrənilmiş düzgün sözlərdən, reviewed productive morphology
   analizindən keçən isim kökləri üçün kiçik samit-skelet indeksi qurulur.
2. Tək yanaşı təkrar hərf və ya təlimdə müşahidə edilmiş tək sait əvəzlənməsi
   ilə kök namizədləri yaranır. Konsonant əvəzlənməsi və böyük edit fərqi bu
   fallback-də təxmin edilmir.
3. Kökə mətnin öz şəkilçisi əlavə olunur; yaranan forma eyni lemma üçün
   morfoloji analizdən keçməlidir. ASCII şəkilçilərində yalnız uyğun, birmənalı
   diakritika bərpası edilir.
4. `-dakı/-dəki` yalnız doğrulanmış yerlik halın üzərində, `-la/-lə` isə
   doğrulanmış adlıq isim formasında və ahəng qanununa uyğun qəbul olunur.
5. Bir neçə mümkün kök varsa proqram seçim etmir. Açıq yazılmış Azərbaycan
   hərfləri dəyişdirilmir; düzgün sözlər və qorunan İT terminləri əvvəlki
   mexanizm tərəfindən saxlanılır.

Kök axtarışı 32 inspeksiya, bucket 8 kök, kök uzunluğu 16, söz uzunluğu
24 simvolla məhduddur. Tam lüğət hər sorğuda gəzilmir. Bu, yeni generativ
neyron model və ya tam məna anlayan parser deyil: mövcud neural sıralama,
öyrənilmiş typo kanalları və reviewed morphology birlikdə işləyir.

Altı cümlə üçün xüsusi replacement cədvəli əlavə olunmayıb. Bu cümlələr
və etalonlar təlimə köçürülməyib; korpus və model artefaktı dəyişməyib.
Nəticə başqa cümlələrdə `maktubların`, `qovluqqdan`, `əməkkdaşlarımızdan`,
`taləbələrimizə`, `senadlərimin`, `hesabbatlarımdakı` kimi formalara da keçir.

## Yoxlama

* Altı xəta: həm mətn, həm mail formatında düzgün çıxış.
* Müxtəlif kontekst dəsti: əvvəl 14/20, indi 20/20 tam uyğun çıxış.
* 13 əlavə fərqli cümlə/forma, ambiguity və qoruma yoxlamaları: 21 yeni test.
* Tam test dəsti: 3 814 test keçdi.
* Cari lexical neural mərhələsi: 50 exercise-dən 37 tam uyğun çıxış;
  50 qrammatik exercise və 14 əvvəlki probe tam uyğun qalır.

Bu dəst inkişaf zamanı baxılmış reqressiya dəstidir, kor ümumi dil accuracy
ölçüsü deyil. Global neural sigmoid balı düzgünlük ehtimalı kimi təqdim edilmir.
TypeScript, lint, build və 10 saniyəlik performance gate nəticələri
`nominal-repair-six-verification.json` faylında saxlanılır.
