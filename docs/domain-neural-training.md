# Yerli İT və sənəd dövriyyəsi modeli

100 müəllif nümunəsi əlavə edildi: 35 İT, 35 sənəd dövriyyəsi, 30 dövlət idarəçiliyi. İstifadəçinin həvaləsi ilə yoxlanılıb, `assistant-reviewed` kimi işarələnib; real istifadəçi xətası və ya dilçi təsdiqi deyil. Qurum nümunələri uydurmadır, hüquqi təlimat deyil.

## Təlim

Sənəd üzrə bölgü 80 train / 10 validation / 10 test-dir. Yalnız train sənədlərinə diakritika, hərf silmə/əlavə, yerdəyişmə, klaviatura və boşluq xətaları əlavə olunur. Köhnə mənbələrlə birlikdə 8 949 train, 855 validation, 465 test cütü var; sintetik variantlar müstəqil sənəd sayılmır. Dublikat və yaxın sənədlər yoxlanılır, bölgü və mənbələr SHA-256 ilə bağlanır.

719 və 919 toxumları ilə iki kiçik attention şəbəkəsi sıfırdan 32 epoch öyrədilib. Hər biri 20 000 söz qrupu, 98 523 namizəd nümunəsi üzərində işləyib; retained validation BCE müvafiq olaraq 0.291697 və 0.294929 olub. Bunlar mətn dəqiqliyi faizləri deyil. `--selection-only` yalnız ağır təsviri hesabatı buraxır; training və validation kalibrasiyası qalır, çəkilər hesabatdan əvvəl saxlanır.

## Buraxılış qərarı

Əsas istehsal başlığı dəyişmir və birinci qərar verir. Yalnız qərarsız qaldıqda 453 təlim sözündən ibarət əlavə başlıq işləyir. Əlavə JSON təxminən 210 KB-dır; heç bir LLM API-sı, Python serveri və ya model yükləməsi yoxdur.

Ümumi redaktə variantı validation-da şəkilçi itirirdi. İlk/son hərf qoruması əlavə olundu, amma geniş regresiya yoxlaması `ünvanladığı → ünvanlandığı` və `etdii → etdi` kimi mənanı dəyişən halları üzə çıxardı. Bu variant buraxılmadı. Son variant yalnız **sözün daxilində bir düşmüş saiti** bərpa edə bilər; samit əlavə edə, hərf silə/dəyişə, sonluq yarada bilməz. Düzgün sözlər, adlar, texniki terminlər və explicit diakritiklər ümumi qoruma qatından keçir.

919 modeli, 0.7 sıralama həddi saxlanılıb; bu bal 70% düzgünlük ehtimalı deyil. Son daraldılmış variant 865 validation halında tam düzgün nəticələri 243-dən 248-ə qaldırıb, yeni yanlış düzəliş və tam düzgün nəticədə geriləmə yaratmayıb. Seçim faylı `data/neural/domain-selection-report.json`-dır. 719 və 919 inkişaf checkpointləri `data/experiments/domain/` içindədir, tətbiq bundle-ına import olunmur.

Ayrıca 10 səhv domain test mətni + 10 identity halında nəticə 12/20 → 14/20; 24 yeni kontekst + 20 identity halında 28/44 → 33/44 olub. 826 geniş yoxlamada 443 → 445, əlavə mənbələrin 1 547 yoxlamasında 868 → 868: yeni yanlış düzəliş yoxdur. Identity hallarını çıxarıb bütün bu rəqəmləri sırf səhv-mətn dəqiqliyi kimi təqdim etmək olmaz. Son iki hesabat əlavə spelling başlığını eyni köhnə cümlə bölgüsü ilə müqayisə edir.

Təlim mətninin yoxlanması ayrıca cümlə bölgüsü səhvini göstərdi: `təqdim ediləcək sənədin surəti` bölünürdü. `segmentCorrespondence` gələcək zaman feli sifəti ilə ardınca yiyəlik halda gələn ismi artıq ayırmır; ayrıca mənalı cümlələr və explicit durğu qorunur. Regresiya testləri bu ardıcıl təsiri də yoxlayır.

İnkişaf zamanı baxılmış sınaqlar artıq tam kor holdout deyil. Mövcud hesabatlar regresiya və sintetik ümumiləşdirmə sübutudur, ümumi məna anlayışı və ya real istifadəçi dəqiqliyi iddiası deyil. Söz ehtiyatı və şəkilçilərin əhatəsi məhduddur; yeni samit xətaları və sərbəst cümlə yenidənyazması bu başlığın işi deyil.

## Təkrar yaratmaq

```bash
npm ci
npm run dictionary:import -- public/dictionaries/az
npm run nlp:data -- data/nlp/wikipedia-documents.jsonl /tmp/domain/source
npm run nlp:reviewed:data -- --source=/tmp/domain/source --reviews=data/nlp/reviews/az-batch-001-splits --output=/tmp/domain/reviewed
npm run nlp:domain:data -- --base=/tmp/domain/reviewed --output=/tmp/domain/splits
npm run nlp:ablation -- --data=/tmp/domain/splits --output=/tmp/domain/candidates --variants=bounded-edits --seeds=719,919 --epochs=32 --selection-only
npm run nlp:domain:compact -- --model=/tmp/domain/candidates/bounded-edits-919.json --output=/tmp/domain/compact/bounded-edits-919.json --data=/tmp/domain/splits
npm run nlp:domain:select -- --data=/tmp/domain/splits --models=/tmp/domain/compact --floor=0.7 --baseline-model=lib/editor/neural/bounded-model.json --output=/tmp/domain/selected.json
node --import tsx scripts/verify-domain-neural-artifact.ts --data=/tmp/domain/splits --model=lib/editor/neural/domain-model.json
npm run nlp:domain:evaluate -- --model=lib/editor/neural/domain-model.json --split=test --output=/tmp/domain/test.json --enforce
npm run nlp:domain:evaluate -- --model=lib/editor/neural/domain-model.json --fresh --output=/tmp/domain/fresh.json --enforce
npm test
npm run typecheck
npm run lint
npm run build
npm run benchmark:check
```

Daha güclü məna anlayışı üçün anonimləşdirilmiş real səhv–düzgün cütlər, dilçi yoxlaması və inkişafdan ayrı yeni test dəsti lazımdır. Hazırkı nəticələrə əsasən sistemi qüsursuz və ya ChatGPT səviyyəsində təqdim etmək olmaz.
