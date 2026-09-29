# SlothAI: hazırkı sistem və daha ağıllı redaktor üçün yol xəritəsi

29 sentyabr 2026, baxılan başlanğıc `main`: `6ab1559b7ba14f1396bc81a38fae67c054bed89c`.

## Hazırkı iş axını

`app/page.tsx` brauzerdə strategiyanı çağırır. `lib/strategies/bootstrap.ts` iki
strategiyanı (`text-corrector`, `gmail-corrector`) qeydiyyata alır. Hər ikisi
`lib/editor/correct.ts` içindəki sinxron `correctText` və `formatEmail` yolundan
istifadə edir. Mətn əvvəlcə kod, URL, HTML və texniki terminlərə görə qorunur;
sonra lüğət və aliaslar, məhdud morfologiya, kontekst ifadələri, cümlə sərhədləri,
durğu, abzas və siyahı addımlarından keçir. `POST /api/transform` eyni strategiyalara
bağlanır, ancaq əsas UI lokal hesablayır: heç bir LLM/API sorğusu göndərmir.

Lüğət mənbəyində 38 174 unikal qeyd var; importer onlardan maksimum 100 000
**səthi forma** qurur. Bu rəqəm 100 000 müstəqil söz və ya anlama qabiliyyəti
demək deyil. `legacyLemmaDictionary` həqiqi lemma təhlili aparmır,
`productiveMorphology` isə yalnız müəyyən edilmiş şəkilçi sxemlərini əhatə edir.
`spelling-candidates.ts` namizədləri məhdud məsafə ilə axtarır; son seçim üçün
tam cümlə mənasını öyrənmiş model yoxdur. Qaydalar `context.ts`, `technical.ts`,
`business.ts`, `segmentation.ts`, `punctuation.ts` və `rules/email.ts` daxilindədir.

## Aşkar məhdudiyyətlər

1. Cari 460/460 RSD/İT və 340/340 email qapısı təkrar emalda sabitlik, açar
   sözün saxlanması və məktub skeleti kimi **struktur** meyarlarını ölçür.
   Tam dil keyfiyyəti göstəricisi deyil. Saxlanmış çıxışda
   `rsd-it-201: "Production deploy sonrası health check ugurludur."`,
   `mail-002: "... qeydə alınıb zəhmət olmasa, ..."` və
   `mail-036: "Dərkənara əlavə olunmuş. Fayl ..."` görünür. Bu üçü
   ayrıca qızıl cavabla ölçülməli və ümumi qayda ilə düzəldilməlidir.
2. Qeyri-müəyyən diakritik və yeni sözlər kontekstsiz seçimə görə ya olduğu
   kimi qalır, ya yanlış dəyişir. Nadir proper noun və məhsul adlarını məcburi
   təshih etmək risklidir. Sadə lüğəti böyütmək bu ziddiyyəti həll etmir.
3. Durğu və abzas ayırması əl ilə yazılmış triggerlərə və sonlu fel
   əlamətlərinə söykənir. Uzun, durğusuz məktubda cümlə bölünməsi və
   bağlayıcıların rolu həmişə düzgün təyin edilmir.
4. İstifadəçi düzəlişləri bu gün yadda saxlanmır. `localStorage` yalnız mövzu
   rəngini saxlayır; mühərrikin təlim mexanizmi, şəxsə aid lüğəti və server
   tərəfində paylaşılan öyrənmə bazası yoxdur. Serverless prosesin yaddaşına
   əlavə olunan söz cold start, yeni instansiya və deploy arasında itəcək.
5. `correctionsMade` təxmini dəyişmiş token sayıdır, doğruluq və ya inam balı
   deyil. Yeni qiymətləndirmə üçün söz, abzas, termin və mənanın saxlanması
   ayrıca ölçülməlidir.

## Lokal və ağıllı redaktor necə qurula bilər?

**Mərhələ 1 — ölçmə.** Bir-birindən ayrılmış təlim, development və gizli test
dəstləri hazırlamaq; hər mətn üçün müstəqil redaktə olunmuş tam çıxış,
dəyişiklik intervalı və `term/proper noun/məna` etiketləri saxlamaq. Mövcud
struktur korpuslarının ən azı müxtəlif 200–300 nümunəsini iki dil redaktorunun
gözdən keçirməsi ilə qızıl çıxışa çevirmək. `exact match` ilə yanaşı simvol
xətası, durğu sərhədi F1, termin qorunması və manual yanlış düzəliş faizini
ölçmək. Test dəsti mühərrik qaydalarını tək-tək yamaqla yazmaq üçün istifadə
edilməməlidir.

**Mərhələ 2 — hibrid qayda və namizəd sıralaması.** Qorunan URL/kod/termin
parçalarını toxunulmaz saxlayıb hər qeyri-müəyyən söz üçün lüğət, morfologiya,
klaviatura xətası və diakritik variantlarından kiçik namizəd siyahısı yaratmaq.
Cümlədə qonşu sözlər, şəkilçi uyğunluğu və termin kontekstinə əsaslanan
hesablayıcı ilə sıralamaq; zəif üstünlükdə orijinal yazılışı qorumaq.
Sərhəd və abzas üçün ayrıca model/qayda skoru lazımdır; söz düzəlişini
cümlə bölünməsi ilə qarışdırmaq səhvləri artırır.

**Mərhələ 3 — həqiqi kontekst modeli (istəyə bağlı, API-siz).** Lisenziyası
uyğun, Azərbaycan dili üçün qiymətləndirilmiş kiçik kontekst modeli
brauzerdə Web Worker + ONNX Runtime Web/WASM ilə işlədilə bilər. Model
dəstini bir dəfə endirib IndexedDB/Cache Storage-də versiyalı saxlayın;
yalnız checksum və ölçü yoxlandıqdan sonra aktivləşdirin. Əvvəl `Lite`
(indiki deterministik) və `Dərin` (model varsa) rejimlərini müqayisə edin.
Modelin disk ölçüsü, ilk açılma, zəif cihazlarda RAM və 5 000 sözlük gecikmə
ölçülmədən istehsala daxil edilməsin. Sıfırdan LLM öyrətmək bu həcmdə
etiketlənmiş korpus və cihaz büdcəsi ilə real qısa yol deyil.

**Öyrənən lüğət.** İstifadəçi nəticədə səhv sözü düzəltdikdə orijinal,
düzəldilmiş forma və cümlə kontekstini *yalnız razılıq verilərsə* anonimləşdirilmiş
namizəd kimi yazın. Şəxsi brauzer üçün IndexedDB; cihazlararası paylaşım üçün
ayrıca davamlı saxlanc, autentifikasiya, çıxarma/silmə və lisenziya siyasəti
lazımdır. Yalnız etibarlı mənbədə təkrar təsdiqlənən və ya redaktorun qəbul
etdiyi sözlər əsas lüğətə keçirilməlidir. Dərhal avtomatik əlavə edilən söz
şəxs adı, yazı xətası və ya zəhərli nümunə ola bilər; mənaya uyğunluq,
şəkilçi/lemma əlaqəsi və əks nümunə yoxlaması tələb olunur. Yeni forma sayı
üçün əvvəlcədən 30 000 və ya 100 000 hədəfi qoymaq əvəzinə, hər əlavə
paketin gizli testdə səhvi azaltdığını və sürəti pozmadığını tələb edin.

İcra sırası: əvvəl qızıl qiymətləndirmə və üç görünən qüsurun düzəlişi;
sonra istifadəçi təsdiqi ilə lokal söz namizədləri; daha sonra kiçik
kontekst modeli üzərində real keyfiyyət/latency müqayisəsi. Bu yol lokal
işləmə və məxfilik tələbini saxlayır, eyni zamanda mənaya həssas düzəlişin
faktiki artıb-artmadığını ölçür.
