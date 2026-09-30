# Lokal kontekst modeli — ilkin versiya

Bu kiçik, nəzarətli təlimlə öyrədilən statistik modeldir: kontekst üzrə multinomial Naive Bayes. LLM və generativ mətn modeli deyil. API, token ödənişi, Python serveri və əlavə asılılıq tələb etmir. Mətn və mail modulları eyni `correctText()` axınında modeli istifadə edir.

## Məlumatlar

`seeds.txt` 100 müəllif tərəfindən yazılmış düzgün Azərbaycan dili mətnidir. `pairs.json` hər mətn üçün beş süni səhv variantını saxlayır: diakritikasız/durğu işarəsiz mətn, diakritikasız mətn, yalnız durğu işarəsiz mətn, qeyri-standart transliterasiya, bir hərfin buraxılması. Cəmi 500 unikal giriş/nəticə cütü var. Bunlar internetdən toplanmış və ya 500 müstəqil insan tərəfindən yoxlanmış real nümunələr deyil.

400 cüt/80 əsas mətn təlimə, 100 cüt/20 əsas mətn testə ayrılır. Eyni əsas mətnin bütün səhv variantları yalnız bir hissədə qalır. Model 80 unikal düzgün mətndən öyrənir; beş variant eyni sübutun süni olaraq beş dəfə sayılmasına səbəb olmur. Test mətnləri təlimə daxil edilmir.

## İşləmə

İlkin model yalnız `seher` və `suret` kimi iki qeyri-müəyyən yazılış qrupu üçün variant seçir. Yaxınlıqdakı altı sözün hər iki tərəfdəki yazılış fraqmentlərini müqayisə edir. Təlimdən öyrənilən saylar `lib/editor/local-ai/model.json` faylında saxlanılır; inference tam lokal TypeScript kodudur. Yüksək nəticə fərqi və ən azı iki dəstəkləyən kontekst əlaməti tələb olunur; zəif və ziddiyyətli kontekstdə mövcud qaydalara qayıdır. Açıq Azərbaycan hərfləri, kod blokları və URL-lər dəyişdirilmir.

Model özbaşına istifadəçi jurnalından təlim keçmir. Redaktorun əvvəlki şəxsi lüğət mexanizmi ayrıca işləyir. Yeni qruplar və kontekstlər üçün düzgün, yoxlanmış mətnləri artırmaq və yenidən təlim etmək lazımdır. Etibarlılıq balı kalibrə edilmiş düzgünlük ehtimalı deyil; insan kimi məna anlama iddiası yoxdur.

## Təkrarlama

- `npm run local-ai:train` — 500 cütü, təlim artefaktını və təlim hesabatını yenidən yaradır.
- `npm run dictionary:import -- public/dictionaries/az` — mövcud redaktor lüğətini hazırlayır.
- `npm run local-ai:evaluate` — test hissəsində adi mühərriki və modellə işləyən mühərriki müqayisə edir; geriləmə olarsa qeyri-sıfır çıxış kodu verir.
- `npm test` — model müqaviləsi, məlumat ayrılması və mövcud reqressiya testlərini işlədir.

`training-report.json` modelin söz variantı qərarlarını, `evaluation-report.json` isə bütün test girişlərini, gözlənilən nəticələri, əvvəlki və yeni çıxışları saxlayır. Tam mətn uyğunluğu hələ aşağıdır; xüsusən sərbəst cümlə sərhədləri və `sh/ch` transliterasiyası ayrıca inkişaf tələb edir. Bu kiçik süni testin nəticələri bütün Azərbaycan dili üzrə dəqiqlik hesab edilməməlidir.
