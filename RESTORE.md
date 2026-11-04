# PunctCase backup — bərpa təlimatı

Tam training 2 noyabr 2026, saat 16:29 Bakı vaxtı tamamlanıb. 4 epoch işləyib; validation loss əsasında 2-ci epoch seçilib. Early stopping patience=2-dir. Bu, offline training backup-udur; app/browser inteqrasiyası hələ yoxdur. Validation mənbədən avtomatik çıxarılan işarə/registr etiketləridir, insan tərəfindən yoxlanmış real istifadəçi dəqiqliyi deyil.

## Release-dən endir və yoxla

```sh
mkdir -p punctcase-recovery
cd punctcase-recovery
for backup_file in punctcase-backup-2026-11-04.tar.gz CHECKPOINTS.json RESTORE.md SHA256SUMS; do
  curl --fail --location --output "$backup_file" "https://raw.githubusercontent.com/Sanan2030/SlothAI/punctcase-backup-2026-11-04/$backup_file"
done
sha256sum -c SHA256SUMS
tar -xzf punctcase-backup-2026-11-04.tar.gz
cd punctcase-backup
sha256sum -c SHA256SUMS
```

Alternativ: release səhifəsindəki **Source code (zip)** və ya **Source code (tar.gz)** linkini endir və aç. Bu xüsusi backup tag-ının source arxivində app kodu deyil, məhz backup tarball-ı və üç bərpa/yoxlama faylı var. Orada SHA256SUMS yoxlamasından başla. Birbaşa release asset upload endpoint-i mövcud girişlə 401 qaytardığı üçün bu təsdiqlənən Git-backed saxlama yolu seçilib.

Repo public-dir. Digər çat GitHub release səhifəsindəki faylları da endirə bilər. Download yoxlaması bitmədən faylları trusted backup kimi qəbul etmə.

## Arxivdə nə var

- `runs/punctcase-full/best.pt`: seçilmiş epoch 2-nin çəkiləri və konfiqurasiyası.
- `runs/punctcase-full/last.pt`: son tamamlanmış epoch 4, optimizer və RNG vəziyyəti.
- `epochs/epoch-1` ... `epochs/epoch-4`: hər tamamlanmış epoch üçün best/last checkpoint və həmin anın report/progress qeydləri.
- Smoke run çəkiləri, hər iki run-un report/model card/progress faylları.
- Dəqiq istifadə olunmuş training/data-gate mənbə kodu, pinlər və işləyən kod patch-i.
- Hazırlanmış datanın config/manifest/gate qəbzləri, korpusun qəbul edilmiş manifesti və hash-ləri.
- Bərpa kodu, korpus bərpa qəbzi, job statusu və tam stage logları.

Original altı korpus gzip faylı, açılmış korpus və hazırlanan böyük task-data faylları bu public release-ə daxil edilməyib.

## Kodu və modeli açmaq

Training kodunun baza commit-i: `cb5c2448602e6c6a7fcbaa390bedb53fa43b3f07`.
`source/working-changes.patch` yalnız PunctCase-only preparation dəstəyini və onun yoxlamalarını saxlayır; bu dəyişikliklər training vaxtı işlənib, main-ə push edilməyib.

Mövcud checkout və istifadəçi dəyişikliklərini qoru. Eyni baza commit-də və uyğun təmiz fayllarda `git apply --check` ilə yoxlayıb patch-i tətbiq etmək olar. Daha yeni checkout-u kor-koranə reset etmə. `source/training` və `source/scripts/data` dəqiq istifadə olunmuş mənbələrin ayrıca nüsxəsidir.

Runtime repository-dəki `bash training/setup.sh cpu` ilə qurulur: Python 3.12 və PyTorch 2.8.0+cpu. Təkcə çəkiləri yoxlamaq üçün:

```python
import torch
from training.punctcase.model import PunctCase
checkpoint = torch.load('runs/punctcase-full/best.pt', map_location='cpu', weights_only=True)
model = PunctCase(checkpoint['config']).eval()
model.load_state_dict(checkpoint['state_dict'], strict=True)
```

Bu Python modeli TypeScript/browser modeli deyil. App-a qoşmaq üçün ayrıca export/parity, qorunma/idempotency, keyfiyyət və browser gecikmə yoxlamaları tələb olunur. Başqa çatdan növbəti iş: mövcud WordLM-i qoruyaraq PunctCase browser inteqrasiyasını hazırlamaq və yoxlamalardan sonra user-in icazə verdiyi app push-u etmək.

## Trainingə davam etmək lazım olsa

Tam run completed-dir və onun `--resume` ilə avtomatik davamı dəstəklənmir. Əvvəlki epoch 1–3 backup-ları həmin vaxtın uyğun report, optimizer və RNG vəziyyətini saxlayır. Onlardan bərpa üçün uyğun orijinal prepared data və qəbul edilmiş bütün korpus faylları da əlçatan olmalıdır; hash/gate şərtlərini dəyişmə.

Korpusun zədələnmiş gzip-i istifadə olunmayıb. `session/recover-corpus.py` sağlam train-pairs daxilindəki eyni təmiz sahələrdən original train.jsonl-ı çıxarıb. Bütün altı açılmış faylın hash-i qəbul edilmiş manifestlə tam eyni olub; cümlə silinməyib və mətn dəyişməyib.

Model report-u tamamlanmanın əsas sübutudur. Supervisor job.json daxilində progress son polling anını göstərə bilər; `status`/çıxış kodu və model report-u ilə birlikdə oxu. Qovluq yolları əvvəlki cloud maşınının yollarıdır; yeni mühitdə uyğunlaşdır.
