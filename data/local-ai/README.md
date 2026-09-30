# Lokal kontekst modeli — ilkin versiya

Bu kiçik, nəzarətli təlimlə öyrədilən statistik modeldir: kontekst üzrə multinomial Naive Bayes. LLM və generativ mətn modeli deyil. API, token ödənişi, Python serveri və əlavə asılılıq tələb etmir. Mətn və mail modulları eyni `correctText()` axınında modeli istifadə edir.

## Məlumatlar

`seeds.txt` bu layihə üçün assistant tərəfindən hazırlanmış 200 etalon Azərbaycan dili mətnini saxlayır; müstəqil dil redaktoru tərəfindən yoxlanmış real istifadəçi korpusu deyil. `pairs.json` hər mətn üçün beş süni səhv variantını saxlayır: diakritikasız/durğu işarəsiz mətn, diakritikasız mətn, yalnız durğu işarəsiz mətn, qeyri-standart transliterasiya, bir hərfin buraxılması. Cəmi 1000 unikal giriş/nəticə cütü var. Bunlar internetdən toplanmış və ya 1000 müstəqil insan tərəfindən yoxlanmış real nümunələr deyil.

700 cüt/140 əsas mətn təlimə, 100 cüt/20 əsas mətn validation hissəsinə, 200 cüt/40 əsas mətn testə ayrılır. İlk versiyanın əvvəlki test mətnləri reqressiya üçün saxlanılıb; bunlar yeni gizli korpus hesab edilmir. Eyni əsas mətnin bütün səhv variantları yalnız bir hissədə qalır. Model 140 əsas təlim mətni və `supplemental-training.txt` faylındakı 20 əlavə təlim mətnindən öyrənir; əlavə mətnlər bütün təlim/validation/test qruplarından ayrıca və fərqlidir; beş variant eyni sübutun süni olaraq beş dəfə sayılmasına səbəb olmur. Test mətnləri təlimə daxil edilmir.

## İşləmə

İlkin model `seher`, `suret`, `adi`, `uc`, `el`, `et` olmaqla altı qeyri-müəyyən yazılış qrupu üçün variant seçir. Yaxınlıqdakı altı sözün hər iki tərəfdəki yazılış fraqmentlərini, sağ/sol mövqeyi, mövcud məhdud morfologiyanın verdiyi birmənalı lemma/POS/hal əlamətlərini müqayisə edir. Durğu işarəsi olan cümlələr arasında kontekst daşınmır. Həqiqi sintaktik parser və tam lemma sistemi deyil. Təlimdən öyrənilən saylar `lib/editor/local-ai/model.json` faylında saxlanılır; inference tam lokal TypeScript kodudur. Yüksək nəticə fərqi və ən azı iki dəstəkləyən kontekst əlaməti tələb olunur; zəif və ziddiyyətli kontekstdə mövcud qaydalara qayıdır. Açıq Azərbaycan hərfləri, kod blokları və URL-lər dəyişdirilmir.

Model özbaşına istifadəçi jurnalından təlim keçmir. Redaktorun əvvəlki şəxsi lüğət mexanizmi ayrıca işləyir. Yeni qruplar və kontekstlər üçün düzgün, yoxlanmış mətnləri artırmaq və yenidən təlim etmək lazımdır. Etibarlılıq balı kalibrə edilmiş düzgünlük ehtimalı deyil; insan kimi məna anlama iddiası yoxdur.

## Öyrənilən söz formaları və cümlə sərhədləri

Üçüncü versiya 93 birmənalı söz formasını öyrənir. Forma ən azı üç müxtəlif təlim mətnində görünməli, eyni qatlanmış yazılış üçün təlimdə başqa variant olmamalıdır. Tətbiq zamanı ən azı iki dəstəkləyən qonşu əlamət lazımdır; tək naməlum sözü avtomatik dəyişmir. Bu, kontekstdən asılı öyrənilmiş lüğətdir, bütün yeni sözləri başa düşən model deyil.

Cümlə sərhədi üçün felin son fraqmenti və növbəti sözün başlanğıcı üzrə müsbət/mənfi müşahidələr sayılır. Eyni nümunə ən azı iki dəfə cümlə sonu kimi görünməli və təlimdə davam nümunəsi olmamalıdır. Cari artefaktda 9 təkrar müşahidə edilmiş nümunə var. Düzəliş yalnız sonlu xəbərdən sonra, boşluqda tətbiq olunur; mövcud durğu, bağlayıcılar və `ki/əgər` ilə bağlı tabeli kontekst qorunur. Bu məhdud qoruqlar sintaktik analizə zəmanət vermir.

`previous-version-comparison.json` eyni 200 əvvəldən baxılmış süni testdə əvvəlki versiya ilə müqayisəni saxlayır: tam uyğunluq 36-dan 44-ə, söz düzəlişi məsafəsi 422-dən 400-ə dəyişib; 19 mətn yaxşılaşıb, ölçülən geriləmə yoxdur. Bu artıq işlənmiş reqressiya korpusudur, müstəqil gizli keyfiyyət testi deyil.

## Təkrarlama

- `npm run local-ai:train` — korpusu, təlim artefaktını və təlim hesabatını yenidən yaradır.
- `npm run dictionary:import -- public/dictionaries/az` — mövcud redaktor lüğətini hazırlayır.
- `npm run local-ai:validate` — ayrıca validation hissəsində müqayisə aparır; model seçimi üçün istifadə edilə bilər.
- `npm run local-ai:evaluate` — test hissəsində adi mühərriki və modellə işləyən mühərriki müqayisə edir; geriləmə olarsa qeyri-sıfır çıxış kodu verir.
- `npm test` — model müqaviləsi, məlumat ayrılması və mövcud reqressiya testlərini işlədir.

`training-report.json` modelin söz variantı qərarlarını, `evaluation-report.json` isə bütün test girişlərini, gözlənilən nəticələri, əvvəlki və yeni çıxışları saxlayır. Tam mətn uyğunluğu hələ aşağıdır; xüsusən sərbəst cümlə sərhədləri və `sh/ch` transliterasiyası ayrıca inkişaf tələb edir. Bu kiçik süni testin nəticələri bütün Azərbaycan dili üzrə dəqiqlik hesab edilməməlidir.
