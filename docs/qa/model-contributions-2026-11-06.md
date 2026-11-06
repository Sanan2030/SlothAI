# SlothAI modellərinin ölçülmüş faydası — 6 noyabr 2026

12 976 sorğu doqquz konfiqurasiyada işlədildi: səkkiz model kombinasiyası və WordLM-in lüğət məlumatını da çıxaran əlavə sınaq. Cəmi 116 784 nəticə var. Tətbiqin mənbə versiyası `7c577eadb991991f93393ea8596211bbf323c9fa`-dır. Tətbiq, model çəkiləri, qəbul hədləri və əvvəlki istinad cavabları dəyişdirilməyib. Üç model tətbiqdə avtomatik işləməyə davam edir.

[İnteraktiv, internetsiz açılan HTML hesabatı](model-contributions-2026-11-06.html) və [tam rəqəmlər](model-contributions-2026-11-06.summary.json) eyni ölçməni göstərir. HTML-dəki keçidlər yalnız ölçülmüş nəticələr arasında seçim edir, tətbiqdə modelləri söndürmür.

## Əlavə fayda

Qalan iki model işləyərkən müvafiq hissəni çıxarıb nəticə müqayisə edilib. Cədvəldəki rəqəm həmin hissənin əlavə düzgün nəticəsidir; bir-birinin üzərinə toplanmamalıdır.

| Çıxarılan hissə | 10 000 inkişaf nümunəsi | 500 ayrıca nümunə | 40 əlavə durğu nümunəsi |
|---|---:|---:|---:|
| WordLM lüğət və kontekst qərar məlumatları | 964 | 2 | 0 |
| Yalnız WordLM kontekst/ehtimal hesablamaları; lüğət sabitdir | 32 | 1 | 0 |
| CharSpell | 8 | 1 | 0 |
| PunctCase | 0 | 0 | 3 |

Tam tətbiq həmin dəstlərdə müvafiq olaraq 10 000/10 000, 397/500 və 34/40 nəticə verir. Ayrıca 2 000 düzgün mətn, 100 kalibrasiya nümunəsi və 336 mövcud durğu nümunəsi bütün konfiqurasiyalarda eyni dərəcədə keçir. Heç bir çıxarma ilə müqayisədə tam tətbiqin yeni səhv etdiyi əvvəldən düzgün nəticə aşkar edilməyib. Bu, tam tətbiqin bütün düzgün mətnləri qoruması demək deyil: yeni 40 nümunədə 24 düzgün girişdən biri mövcud durğu qaydası tərəfindən pozulur.

WordLM-in yalnız kontekst balı ölçüləndə 10 000-də 32 nümunəlik birgə üstünlük var. CharSpell tək əlavə ediləndə bu dəstdə ayrıca üstünlük yaratmır; WordLM ilə birlikdə səkkiz əlavə nəticə qazandırır. Qarşılıqlı təsiri bərabər bölən Shapley hesablaması bu 32 üstünlüyü WordLM balına 28, CharSpell-ə 4 kimi bölür. Bu, 964 lüğət/kontekst müqayisəsindən fərqli eksperimentdir.

CharSpell fərq yaradan doqquz nümunənin hamısında `surət` söz ailəsini düzəldir. Səkkiz inkişaf nümunəsi `ilkin qəbzin surəti` davamını paylaşır, ayrıca nümunədə isə `bildirişin surətini` bərpa edir. Doqquz nümunəni doqquz müstəqil səhv növü kimi təqdim etmək olmaz. Modelin əvvəlki `changedTokens` sayğacı modelin dəstəklədiyi qəbul edilmiş seçimləri göstərirdi; bu eksperiment onun ayrıca səbəb olduğu nəticə fərqini ölçür.

## Sınağın dəqiq sərhədləri

Səkkiz əsas variantda WordLM-in öyrənilmiş n-gram balları, OOV cəriməsi, empirik kontekst düzəlişləri və fallback şahidliyi çıxarılır. Mənbə lüğəti, morfologiya, namizəd axtarışı, linqvistik məhdudiyyətlər və köhnə modellər sabit qalır. Əlavə doqquzuncu variant yalnız öyrənilmiş söz siyahısını boşaldır; bütün lüğət təsdiqi/bərpası funksiyalarının gövdələri və ümumi lüğətə əsaslanan bərpa yolları saxlanılır. WordLM-in yekun mətn üzrə monitorinq hesablaması bütün variantlarda qalır; o, çıxış qərarını dəyişmir. Buna görə bu sınaq modelin yaddaşdan/yükləmədən tam çıxarılmasının ölçməsi deyil.

CharSpell həm ilkin düzəlişdə, həm PunctCase-in sabitlik yoxlamasında çıxarılır. PunctCase çıxarılanda yalnız onun əlavə təklif və qəbul mərhələsi atlanır. Əvvəlki bütün AI modelləri, ümumi lüğət, qaydalar və formatlama qalır; `w0c0p0` model olmayan baza deyil.

Alət müvəqqəti Node paketlərində mənbəni qeyd edilmiş markerlərlə dəyişir; tətbiq mənbəsinə və UI-yə deaktivasiya parametri əlavə etmir. Tam variantın çıxışları əvvəlki nəşr edilmiş tətbiqin 10 000 saxlanmış nəticəsinə və 2 976 yeni birbaşa strategiya sorğusuna bayt səviyyəsində bərabərdir. Mənbənin 132 runtime faylı dəyişməyib. Səkkiz kombinasiyada tam nəticədən fərqlənən çıxışlar təkrar emal olunanda qeyri-sabitlik aşkar edilməyib. WordLM-in öyrənilmiş lüğət məlumatı da çıxarılan əlavə variantda fərqlənən çıxışlar arasında 49 təkrar-emal qeyri-sabitliyi var; tam tətbiqin eyni çıxışlarında qeyri-sabitlik yoxdur. Bu da WordLM lüğət məlumatının qoruyucu rolunu göstərir. Nəticələrin və bütün girişlərin SHA256-ları bərpa paketində saxlanılır.

## Faydanı artırmağa mane olan səbəblər

500-lük dəstdə qalan 103 cümlədə 105 səhv söz yeri var. Faktiki çıxışı dəyişməyən diaqnostik paketdə:

- 80 yer namizəd sıralamasına çatır, 12-si `validRaw` sürətli keçidində saxlanır, 13-ündə seçim hadisəsi yoxdur.
- Düzgün variant yalnız iki yerdə hazırkı namizəd/sıralama siyahısındadır.
- 89 düzgün söz artıq WordLM-in 150 min sözlük bazasındadır. Onlardan yalnız 10-u kiçik ümumi düzəliş lüğətində də var. 16 düzgün variant hər iki lüğətdən kənardadır.
- Sadəcə mövcud ümumi lüğət axtarışını çağırmaq cəmi üç düzgün variantı tapır. WordLM söz bazası üzrə bir hərf əlavə/silmə/dəyişmə və qonşu hərflərin yer dəyişməsi prototipi 89 variantın hamısını 20 namizəd həddində tapır. İstinad cavabı axtarış siyahısına daxil edilmir.
- Bu geniş siyahıda CharSpell 43 düzgün variantı birinci, 84-ünü ilk üçlükdə sıralayır. Mövcud tətbiqin OOV, kanal, kontekst və CharSpell ballarının birləşməsi isə 12 düzgün variantı birinci, 81-ini ilk üçlükdə saxlayır. Qəbul və qoruma qaydaları bu prototipdə tətbiq edilmir. Bu rəqəmlər 43 və ya 89 yeni tətbiq düzəlişi demək deyil.

Birinci inkişaf işi WordLM lüğətini məhdud redaktə məsafəli axtarışa qoşmaqdır. Geniş siyahı üçün hədlər də uyğunlaşdırılmalıdır: tətbiqin seçim hissəsi 20 namizəd qəbul etsə də, WordLM bir sıralama çağırışında ilk səkkizi qiymətləndirir. Prototipdə bütün 20 namizədin balları səkkizlik qruplarla hesablanır. Sonra adlar, düzgün sözlər və texniki terminləri qoruyaraq səhv-kanal və model ballarını müxtəlif real səhv növlərindən ibarət yeni validation nümunələrində yoxlamaq lazımdır. Məqsəd sadəcə CharSpell çəkisini və ya epoxanı artırmaq deyil: düzgün namizədin tapılması, sıralanması və qəbul edilməsi ayrıca maneələrdir. 16 lüğətdənkənar forma üçün morfoloji bərpa və ayrıca mənbə/istinad yoxlaması tələb olunur.

PunctCase əlavə 40 nümunədə üç düzgün vergül əlavə edir. İki başqa `ki` nümunəsində vergül modelin ən güclü təklifidir, amma ballar 0.991 və 0.968 olmaqla mövcud 0.995 həddindən aşağı qalır. `Əgər … yağsa` nümunəsində vergül balı təxminən 0.781-dir; müraciət formasında düzgün vergül güclü təklif deyil. Bu xam ballar real istifadəçi düzgünlüyünün kalibrasiya olunmuş ehtimalı deyil və bu nümunələrə baxıb ümumi həddi azaltmaq əsaslandırılmır.

`Təəssüf ki, …` nümunəsində ilkin qayda yanlış vergül əlavə edir. PunctCase-in ən güclü proqnozu həmin vergülün olmamasıdır, amma hazırkı redaktor mövcud durğunu saxlayır və yalnız əlavə edir. Yanlış vergülü silmək, durğunu əvəz etmək və ilkin mərhələnin həmin səhvi təkrar yaratmasının qarşısını almaq ayrıca, qoruyucu testlərlə yoxlanmalıdır. Bu dəyişiklik bu ölçmə işində tətbiq edilməyib.

## Vaxt və məhdudiyyətlər

Ayrıca, ardıcıl, beş dövrəli isti Node sınağında 1000 söz üçün medianlar: bütün hissələrlə 617.9 ms; WordLM kontekst hesablamasız 576.5 ms; CharSpell-siz 594.1 ms; PunctCase-siz 563.6 ms. Bu, eyni təkrarlanan mətn və isti keşlər üzrə CPU göstəricisidir; mobil, brauzer, soyuq başlanğıc və ya tam model yükləmə xərci deyil. Göstəriciləri toplayıb ümumi vaxt çıxarmaq olmaz.

Dəstlər müəllif tərəfindən hazırlanıb, inkişafda istifadə olunub və təkrarlanan strukturlar daşıyır; 12 976 sorğuda 12 960 fərqli xam giriş var. Əlavə durğu nümunələrinin bəziləri mövcud testlərlə eyni dil siqnallarına əsaslanır. Ümumi faiz real istifadəçi dəqiqliyi deyil. Qəbul edilmiş cavablarla tam uyğunluq bəzi düzgün üslub alternativlərini səhv saya bilər. Heç bir nümunə yeni neural çəki və ya hədd seçmək üçün istifadə edilməyib.

Növbəti əlavə training yalnız yeni, təsdiqlənmiş training məlumatında aparılmalıdır. Hazırkı holdout və QA istinadları trainingə qarışdırılmamalıdır. Yeni namizəd və qəbul siyasəti əvvəlcə ayrıca validation, sonra dəyişməyən test və düzgün sözün qorunması yoxlamalarından keçməlidir.

## Təkrar işlətmək və bərpa

```bash
node --import tsx scripts/qa/model-contributions.mjs --out=artifacts/qa/model-contributions-new
node --import tsx scripts/qa/model-contributions.mjs --stage=lexical --out=artifacts/qa/model-contributions-new
node --import tsx scripts/qa/model-contributions.mjs --stage=trace --out=artifacts/qa/model-contributions-new
node --import tsx scripts/qa/probe-model-retrieval.mjs --out=artifacts/qa/model-contributions-new
node --import tsx scripts/qa/model-contributions.mjs --stage=punctuation --out=artifacts/qa/model-contributions-new
node --import tsx scripts/qa/model-contributions.mjs --stage=stability --out=artifacts/qa/model-contributions-new
node --import tsx scripts/qa/model-contributions.mjs --stage=benchmark --out=artifacts/qa/model-contributions-new
```

Tam faktorial nəticələr, hər sorğunun cavabı, bütün model fərqləri, qalan səhvlərin çıxışla eyni diaqnostikası, prototipin namizədləri, mənbə hash-ləri və bərpa göstərişləri [GitHub Releases bərpa paketində](https://github.com/Sanan2030/SlothAI/releases/tag/model-contributions-2026-11-06) saxlanılır. Əvvəlki [tam tətbiq/model bərpası](https://github.com/Sanan2030/SlothAI/releases/tag/charspell-integration-2026-11-06) da qalır. Orijinal altı training gzip faylı və toplu hazırlanmış training məlumatı daxil edilmir.
