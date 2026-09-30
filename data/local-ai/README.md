# Lokal kontekst modeli — ilkin versiya

Bu kiçik, nəzarətli təlimlə öyrədilən statistik modeldir: kontekst üzrə multinomial Naive Bayes. LLM və generativ mətn modeli deyil. API, token ödənişi, Python serveri və əlavə asılılıq tələb etmir. Mətn və mail modulları eyni `correctText()` axınında modeli istifadə edir.

## Məlumatlar

`seeds.txt` bu layihə üçün assistant tərəfindən hazırlanmış 200 etalon Azərbaycan dili mətnini saxlayır; müstəqil dil redaktoru tərəfindən yoxlanmış real istifadəçi korpusu deyil. `pairs.json` hər mətn üçün beş süni səhv variantını saxlayır: diakritikasız/durğu işarəsiz mətn, diakritikasız mətn, yalnız durğu işarəsiz mətn, qeyri-standart transliterasiya, bir hərfin buraxılması. Cəmi 1000 unikal giriş/nəticə cütü var. Bunlar internetdən toplanmış və ya 1000 müstəqil insan tərəfindən yoxlanmış real nümunələr deyil.

700 cüt/140 əsas mətn təlimə, 100 cüt/20 əsas mətn validation hissəsinə, 200 cüt/40 əsas mətn testə ayrılır. İlk versiyanın əvvəlki test mətnləri reqressiya üçün saxlanılıb; bunlar yeni gizli korpus hesab edilmir. Eyni əsas mətnin bütün səhv variantları yalnız bir hissədə qalır. Model 140 unikal düzgün mətndən öyrənir; beş variant eyni sübutun süni olaraq beş dəfə sayılmasına səbəb olmur. Test mətnləri təlimə daxil edilmir.

## İşləmə

İlkin model `seher`, `suret`, `adi`, `uc`, `el`, `et` olmaqla altı qeyri-müəyyən yazılış qrupu üçün variant seçir. Yaxınlıqdakı altı sözün hər iki tərəfdəki yazılış fraqmentlərini, sağ/sol mövqeyi, mövcud məhdud morfologiyanın verdiyi birmənalı lemma/POS/hal əlamətlərini müqayisə edir. Durğu işarəsi olan cümlələr arasında kontekst daşınmır. Həqiqi sintaktik parser və tam lemma sistemi deyil. Təlimdən öyrənilən saylar `lib/editor/local-ai/model.json` faylında saxlanılır; inference tam lokal TypeScript kodudur. Yüksək nəticə fərqi və ən azı iki dəstəkləyən kontekst əlaməti tələb olunur; zəif və ziddiyyətli kontekstdə mövcud qaydalara qayıdır. Açıq Azərbaycan hərfləri, kod blokları və URL-lər dəyişdirilmir.

Model özbaşına istifadəçi jurnalından təlim keçmir. Redaktorun əvvəlki şəxsi lüğət mexanizmi ayrıca işləyir. Yeni qruplar və kontekstlər üçün düzgün, yoxlanmış mətnləri artırmaq və yenidən təlim etmək lazımdır. Etibarlılıq balı kalibrə edilmiş düzgünlük ehtimalı deyil; insan kimi məna anlama iddiası yoxdur.

## Təkrarlama

- `npm run local-ai:train` — korpusu, təlim artefaktını və təlim hesabatını yenidən yaradır.
- `npm run dictionary:import -- public/dictionaries/az` — mövcud redaktor lüğətini hazırlayır.
- `npm run local-ai:validate` — ayrıca validation hissəsində müqayisə aparır; model seçimi üçün istifadə edilə bilər.
- `npm run local-ai:evaluate` — test hissəsində adi mühərriki və modellə işləyən mühərriki müqayisə edir; geriləmə olarsa qeyri-sıfır çıxış kodu verir.
- `npm test` — model müqaviləsi, məlumat ayrılması və mövcud reqressiya testlərini işlədir.

`training-report.json` modelin söz variantı qərarlarını, `evaluation-report.json` isə bütün test girişlərini, gözlənilən nəticələri, əvvəlki və yeni çıxışları saxlayır. Tam mətn uyğunluğu hələ aşağıdır; xüsusən sərbəst cümlə sərhədləri və `sh/ch` transliterasiyası ayrıca inkişaf tələb edir. Bu kiçik süni testin nəticələri bütün Azərbaycan dili üzrə dəqiqlik hesab edilməməlidir.
