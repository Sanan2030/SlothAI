# Yeni 10 000 nümunə — 4 noyabr 2026

Bu, assistentin yazdığı **inkişaf və səhv axtarışı** toplusudur. Mail, IT,
RSD, maliyyə, təhsil, sağlamlıq, nəqliyyat, alış-veriş, ətraf mühit və
mədəniyyət üzrə hərəsində 1 000 ssenari var: 2 000 mail və 8 000 adi mətn.

400 yeni hadisə və 300 yeni davam cümləsi müxtəlif, təkrarlanmayan cütlərlə
birləşdirilib. Ayrı-ayrı hissələr başqa kombinasiyalarda təkrarlanır;
bu, 10 000 müstəqil real istifadəçi müşahidəsi deyil. Say artırmaq üçün
təkcə ad və rəqəm dəyişdirilməyib.

`cases.jsonl.gz` tətbiq ilk dəfə işlədilməzdən əvvəl dondurulub. Girişlər,
əvvəlcədən yazılmış düzgün cavablar və yaradılma mənbələri `MANIFEST.json`
ilə hash-lənib. Tətbiqin nəticələri cavabları yazmaq üçün istifadə edilməyib.
Səhvləri düzəltmək üçün bu topluya baxıldığından son nəticə kor test və ya
ümumi real istifadəçi dəqiqliyi kimi təqdim edilmir.

`GOLD_REVIEW.json` ayrıca dil yoxlamasında tapılmış 23 cavab səhvini açıq
qeyd edir: **unutulmuş → unudulmuş**. İlkin gzip və bütün girişlər dəyişməyib.
Yoxlayıcı bu qeydləri cavablara ayrıca tətbiq edir. Əvvəlki və yeni
nəticələrin müqayisəsi eyni təsdiqlənmiş cavablarla aparılır.

Yenilik yoxlaması `ec966e2` commit-indəki tətbiq testləri və qiymətləndirmə
toplularından çıxarılmış 7 225 əvvəlki mətnə qarşıdır. Normallaşdırılmış tam
üst-üstə düşmə və ortaq ardıcıl səkkiz söz yoxdur. Söz üçlüklərinin Jaccard
yaxınlığı üçün rədd həddi 0.35-dir. `NOVELTY_REVIEW.json` düzəldilmiş
cavabları da təkrar yoxlayır. Əlavə `SOURCE_NOVELTY_REVIEW.json` qəbul edilmiş
təmiz train/validation/test korpusunun **5 000 000 sətrini** ayrıca yoxlayır:
tam eynilik, ortaq ardıcıl səkkiz söz və 0.35 həddində yaxınlıq yoxdur;
ən yüksək Jaccard **0.166667**-dir. Oxunan üç faylın SHA-256-ları qəbul edilmiş
manifestlə eynidir. Mənbə yalnız oxunub və rədd yoxlamasında istifadə edilib;
hədəfləri yazmaq, dəyişmək və model öyrətmək üçün istifadə edilməyib.
Bu nəticələr bütün internetdə heç bir oxşar mətn olmadığı iddiası deyil.

```sh
python3 scripts/qa/audit-novelty.py
node --import tsx scripts/qa/evaluate-novel-10000.ts --out=/tmp/yeni-qa-run
# Production build işlədikdən sonra:
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium \
  node --import tsx scripts/qa/browser-novel-10000.ts \
  --url=http://127.0.0.1:3104 \
  --node-results=/tmp/yeni-qa-run/results.jsonl --out=/tmp/yeni-browser-run
```

Çıxış qovluğu əvvəlcədən mövcud olmamalıdır. Node yoxlaması hər nümunəni
standart və PunctCase rejimində, sonra sabitlik üçün ikinci dəfə işlədir.
Brauzer yoxlaması real tətbiqin editor Worker-ində 20 000 sorğu göndərir,
hər nəticəni Node ilə müqayisə edir; 20 000 ayrıca UI klikini təqlid etmir.
Mail salamı və imza ətrafındakı boşluq düzülüşü qiymətdə normallaşdırılır.
Hərf, söz və durğu fərqləri gizlədilmir.

Bu material model çəkilərini öyrətmək üçün istifadə edilməyib. Tam nəticə,
səhv siyahısı və bərpa arxivi GitHub Release-də saxlanır; əsas hesabat
`docs/qa/novel-10000-2026-11-04.md` faylındadır.
