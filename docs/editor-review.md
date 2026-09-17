# Redaktorun nümunələrlə yoxlanması

Yeni gündəlik, işgüzar, texniki və uzun mətnlər redaktordan keçirildi; aşağıdakı səhvlər ilkin nəticələrdə müşahidə olundu və düzəldildi.

| Giriş | Əvvəlki problem | Yeni nəticə |
| --- | --- | --- |
| `ne gozel gundur` | Xəbər cümləsi səhvən sualla bitirdi, diakritika çatışmırdı | `Nə gözəl gündür.` |
| `nece islediyini bilirem` | Dolayı sual sual cümləsi sayılırdı | `Necə işlədiyini bilirəm.` |
| `bugun bakida hava yaxsidir sabah genceye gedeceyem` | Xüsusi adlar, “bu gün” və cümlə sərhədi | `Bu gün Bakıda hava yaxşıdır. Sabah Gəncəyə gedəcəyəm.` |
| `men geldim sen getdin biz gorusduk` | İkinci cümlənin sərhədi və söz bərpası çatışmırdı | `Mən gəldim. Sən getdin. Biz görüşdük.` |
| `sənəd ( layihə ) hazırdır` | Mötərizə daxilində artıq boşluqlar | `Sənəd (layihə) hazırdır.` |
| `men de gelirem bundan elave senedleri getirirem` | “də” və “gətirirəm” bərpa olunmurdu | `Mən də gəlirəm.` və yeni abzasda `Bundan əlavə sənədləri gətirirəm.` |
| E-poçtda `Hörmətlə,` altındakı `Sənan` | İmzaya cümlə kimi nöqtə əlavə edilirdi | İmza nöqtəsiz saxlanılır |

`tests/editor-regressions.test.ts` yeni nümunələrin gözlənilən nəticələrini, ikinci redaktədə sabitliyi, düzgün mətnin saxlanmasını, onluq ədədləri, URL və kodu, e-poçt imzasını və 10 000 simvol limitinə yaxın mətni yoxlayır. Mövcud testlərlə birlikdə 31 test var; bütün nümunələr qaydalı redaktor üçündür, AI istifadə edilmir.

Bu, bütün Azərbaycan dili üçün dəqiqlik göstəricisi deyil. Naməlum sözlər, mürəkkəb dolayı nitq və mənadan asılı cümlə sərhədləri hələ səhv qala bilər. Söz bazasına yalnız yoxlanmış formalar əlavə edilib; hər naməlum sözü oxşar sözlə əvəz edən riskli ümumi qayda əlavə edilməyib.
