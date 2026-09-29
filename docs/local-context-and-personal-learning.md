# Lokal kontekst və şəxsi lüğət

Mühərrik indiki deterministik strategiyaları saxlayır. `contextual-choices.ts`
qeyri-müəyyən `seher` və `suret` yazılışlarında cümlənin bütün sözlərindən
mövzu ipucları yığır. Ziddiyyətli və ya zəif sübutda yazılışa toxunmur.
Bu kiçik kontekst sıralayıcısı öyrədilmiş LLM deyil; digər mənaca çətin
sözlərə avtomatik ümumiləşdirilmir.

Nəticədə **Nəticəni redaktə et** seçin, yanlış sözü düzəldin və redaktə
sahəsindən çıxın. Yalnız söz sayı eyni qalan, birə-bir uyğun gələn tək söz
dəyişiklikləri namizəd olur. **Şəxsi lüğət** bölməsində hər namizədi
**Təsdiqlə** və ya **Sil** ilə idarə edin. Təsdiq olunmuş düzəliş növbəti
emalda eyni yazılış və qonşu söz konteksti olduqda tətbiq edilir. Tək sözlük
giriş üçün tək sözlük qayda ayrıca işləyir. Qaydanı sonradan silmək olar.

Brauzer `localStorage`-də yalnız məhdud sayda söz cütü və yaxınlıqdakı
bir sözlük kontekst saxlayır; tam mətn, API açarı və ya model göndərilmir.
Yaddaş bağlanıbsa redaktə işləyir, lakin şəxsi düzəlişin saxlanmadığı
ekranda bildirilir. Bu məlumatlar başqa cihazlara ötürülmür və tətbiqin
əsas lüğətinə avtomatik keçmir. Köhnə və yeni versiyalar ayrıca açarla
ayrılır; maksimum 100 namizəd və 100 təsdiqli düzəliş saxlanır.

Məhdudiyyət: cümlə siqnalları yalnız iki çoxmənalı forma üçün başlanğıcdır.
Bütün Azərbaycan mətnini etibarlı düzəltmək üçün ayrıca yoxlanılmış tam
çıxışlı korpus, daha geniş morfoloji analiz və ölçülmüş kontekst modeli
lazımdır. Struktur testində keçmək tam dil doğruluğu demək deyil.
