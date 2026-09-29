# Müstəqil korpusun etalon yoxlaması

`rsd-it-holdout.json` faylında 460, `email-holdout.json` faylında 340 giriş var. `report-independent-corpora.ts` yalnız açar söz, struktur və təkrar emal sabitliyini yoxlayır. Oradakı `passed` sayı düzgün redaktə sayı **deyil**.

`tests/fixtures/independent-reviewed.json` əl ilə yoxlanmış, giriş identifikatoru ilə əlaqələndirilmiş tam etalon nəticələri saxlayır. `tests/independent-gold.test.ts` bunları sətirbəsətir müqayisə edir. Yeni etalon üçün orijinal giriş və ideal cavab ayrıca redaktə olunmalı, mühərrikin hazırkı çıxışı avtomatik kopyalanmamalıdır; əks halda test yalnız köhnə xətanı dondurar.

`npm run gold:audit` nəzərdən keçirilən və gözləyən girişləri göstərir. `npm run gold:complete` yalnız 800 girişin hər birinin əl ilə etalonu olduqda uğurlu olur. Bu mərhələdə 41 nümunə nəzərdən keçirilib, 759 nümunə gözləyir. Tam doğruluq iddiası üçün qalan girişlərin də redaktor tərəfindən ayrıca yoxlanması tələb olunur.
