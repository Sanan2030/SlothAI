# Yerli redaktorun ad və durğu işarəsi yoxlaması

## Metod

`main` üzərində əvvəl 895 köhnə test, 240 regressiya, 265 ümumi holdout və 285 durğu holdout nümunəsi vardı. Yeni sınaq gözləntiləri kodun cavabından alınmayıb: `tests/fixtures/named-entity-holdout.json` daxilində yer adları, hallanma, şəxslər, oxşar ümumi sözlər və təşkilatlar üçün əvvəlcədən yazılmış şablonların mənası ayrıca yoxlanıb. `tests/fixtures/punctuation-holdout.json` üçün 50 yeni nümunədə cümlə ortasındakı sual sözləri, nidalar, bağlayıcılar, müraciətlər və abzas keçidləri sınaqdan keçirilib. Hər test həm ilkin daxilolmanı, həm də artıq düzəldilmiş mətnin ikinci keçiddə sabit qalmasını yoxlayır.

Ad siyahısı `lib/editor/entities` qovluğunda tərtib edilmiş yerli və məhdud siyahıdır. Sistem hər müraciətdə xarici servisi çağırmır. Yer və şəxs adlarının ASCII formaları Azərbaycan əlifbasına qaytarılır; səhv yığılmış yer adlarında yalnız bir hərf dəyişməsi və ya qonşu hərflərin yerdəyişməsi qəbul edilir və cümlədə coğrafi kontekst tələb olunur. Ümumi sözlə də uyğun gələn insan adları yalnız `bəy`, `xanım`, soyad və ya rəsmi müraciət kontekstində dəyişir. Terminlər, kod və Markdown üçün əvvəlki qoruma mərhələləri işləyir.

Bu deterministik redaktor naməlum adları və sərbəst yazılmış bütün dialekt formalarını etibarlı şəkildə ayırd edə bilmir; şübhəli sözlərə toxunmamaq məna dəyişikliyinin qarşısını alır. Performans və yaddaş göstəriciləri `npm run benchmark:check` ilə təkrarlanır. Holdout kateqoriyaları üçün nəticələr `docs/named-entity-holdout-results.json` və `docs/punctuation-holdout-results.json` fayllarında saxlanılır.
