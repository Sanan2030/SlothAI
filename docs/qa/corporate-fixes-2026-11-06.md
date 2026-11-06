# Korporativ sınaqdan sonra düzəlişlər — 6 noyabr 2026

Eyni 1 000 sorğuda (100 000 giriş sözü) düzgün cavabların sayı **297-dən 825-ə** yüksəldi. Əvvəlki 703 səhvdən **528-i düzəldi**, **175-i qalır**. Əvvəl düzgün qiymətləndirilmiş 297 cavab qorundu. Bu, müəllif tərəfindən yaradılmış, bloklardan qurulmuş inkişaf dəstinin nəticəsidir; real istifadəçi və ya müstəqil insan qiymətləndirməsi deyil.

## Səbəblər və dəyişikliklər

- Təsnif edilmiş söz kökləri üçün məchul növ, inkar, vacib şəkli, şərt, zaman və isimləşmiş feil şəkilçilərinin kombinasiyaları çatışmırdı. Məhdud, mənbəyə bağlı paradiqmalar genişləndirildi. `vermeli → vərəmli`, `borcu → boruçu` kimi yanlış kök təxminləri düzgün təsnif edilmiş formaya üstün gələ bilməz. İsim kimi işlənən `məsul` ayrıca təsnif edildi.
- `ch/sh/gh` həmişə bir hərf kimi oxunurdu. Literal hərflər və klaviatura diqrafları ayrı alternativlər oldu: `təchizatçılarla` və `marshrutlara → marşrutlara` birlikdə işləyir.
- WordLM-in birləşdirilmiş seçimində 20 namizəddən yalnız ilk 8-i qiymət alırdı. Birləşdirilmiş WordLM/CharSpell seçimi indi bütün məhdud hovuzu 8-lik paketlərlə qiymətləndirir. Əvvəlki fallback yolu öz 8 namizədlik davranışını saxlayır. Təlim olunmuş lüğətdən bir redaktə məsafəsində namizədlər gətirilir; təsdiqlənmiş müəllif sözü və adlar qorunur. Yeni avtomatik əvəzləmə mövcud CharSpell fərq həddini keçməlidir.
- Sözün əvvəli düzələndə yanlış şəkilçi saxlanırdı (`dəyişdirilirse`). Məna/POS qaydası mümkün olduqda tam təsnif edilmiş formadan istifadə edir (`dəyişdirilirsə`). Zəif isim uyğunluğu daha güclü kontekst və şəxs adı qərarını əvəz etmir.
- Cümlə bölücüləri `gəlir gözləntisi`, `ötürüləcək məlumatlar` kimi söz birləşmələrini ayırırdı. Ortaq sərhəd yoxlaması morfologiya və isim əlaqələrini nəzərə alır. Müəllifin böyük hərfi yalnız tamamlanmış cümlə ilə birlikdə sərhəd sübutudur; modelin öz əlavə etdiyi böyük hərf belə sübut sayılmır. Müəllifin mövcud durğusu qorunur.
- Ad siyahısındakı `Yeganə` adi `yeganə` sözünü böyük hərflə yazırdı. Ad kimi istifadəsi titul/soyad konteksti ilə fərqləndirilir. Şərt şəkillərinin vergülü və `yalnız … deyil, …` qarşılaşdırması da yoxlanır.

Bunlar runtime morfologiya, namizəd axtarışı və seçim düzəlişləridir. Qiymətləndirmə cümlələri tətbiqə və model çəkilərinə daxil edilməyib. Aktiv 22 JSON model/siyasət artefaktı əvvəlki versiya ilə bayt-bayt eynidir. Təlim hədləri aşağı salınmayıb. CharSpell, WordLM və PunctCase avtomatik qalır; yüklənməsi hər sorğuda fayda verməsi demək deyil.

## Qiymətləndirmə və qalan iş

Dondurulmuş referenslə tam uyğunluq **669/1 000**-dir. Qalan **156 qəbul olunmuş cavab** referensdə çatışmayan şərt vergüllərini düzgün bərpa edir. Əvvəlki audit `istisna varsa, onun` düzəlişini artıq qəbul etmişdi. Yeni baxış `tələb yaranarsa, ayrıca qərar alınmalıdır` şərt budaq cümləsindəki vergülü ayrıca təsdiqləyir. Girişlər və orijinal referenslər dəyişməyib. Qaydalar qiymətləndirmə skriptindədir və tətbiqə import edilmir.

Qalan 175 cavab: **144 söz/şəkilçi seçimi**, **27 durğu/cümlə sərhədi**, **4 registr**. Namizədin tapılması onun seçiləcəyi demək deyil: bəzi düzgün namizədlər hovuzdadır, amma mövcud model xətalı girişə üstünlük verir və ya seçim fərqi etibar həddindən aşağı qalır. Məsələn, diaqnostik baxışda `təsvirndə` üçün `təsvirində` tapılıb, lakin CharSpell fərqi təxminən 3,7 olub; mövcud hədd 4-dür. Bir neçə halın daha düzəlməsi üçün bu həddi ümumi şəkildə azaltmaq təsdiqlənməmiş dəyişiklik olardı.

Təkrar emalda **998/1 000** cavab sabitdir. Dəyişən iki ilk cavab (`corp100k-0216`, `corp100k-0341`) artıq səhv sayılır; ikinci cavab birinci nəticənin yerinə hesablanmır. Bütün 250 literal nümunəsi qorunub, texniki xəta yoxdur.

## Yoxlama və bərpa

- 5 610 test: **5 602 keçdi, 8 əvvəlcədən qeyd edilmiş TODO**, adi uğursuzluq yoxdur; lint, TypeScript və production build keçdi.
- Köhnə dondurulmuş 10 000 nümunə: iki uyğunluq bayrağında 40 000 transformasiya, hər ikisində 10 000 düzgün və sabit nəticə. Son məhdudlaşdırma ayrıca 272 aid nümunədə hər iki bayraqla yoxlanılıb; son cümlə sərhədi düzəlişindən sonra 10 000 giriş yenidən tam yoxlanılıb.
- Ayrı phase0 dəstində 2 000 düzgün mətnin hamısı qorunur; 500 holdout nümunəsində nəticə 397/500 olaraq qalır. Bu dəst tətbiq wrapper-indən ayrı `correctText` yoxlamasıdır.
- Brauzerdə həqiqi UI vasitəsilə yaradılmış Worker və Node yolu eyni dondurulmuş 1 000 sorğu ilə müqayisə edilir. Tam nəticələr və dəqiq source/CI qəbzləri release arxivindədir.
- Köhnə artefaktların təkrar istehsalı ayrıca checkout-da icra edilir; müvəqqəti öyrədilən artefaktlar tətbiqə köçürülmür. Yeni CharSpell/WordLM/PunctCase checkpoint-i promote edilməyib.

Ətraflı müqayisə, 175 qalan səhv, CSV, oflayn HTML hesabat, diaqnostik izlər, SHA-256 qəbzləri və bərpa təlimatı: [GitHub Releases](https://github.com/Sanan2030/SlothAI/releases/tag/corporate-fixes-2026-11-06).

Giriş korpusunun SHA-256: `bf8f629724bbef6410c3d371f8cd432ae7f99219d393575e5d7c4beea22d7471`. Köhnə nəticə və yeni nəticə ayrıca saxlanır. Altı orijinal training gzip faylı və kütləvi hazırlanmış training data arxivə daxil edilmir.
