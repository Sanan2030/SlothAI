import json,pathlib
pairs=[
('operator qovluga yeni sened elave etdi','Operator qovluğa yeni sənəd əlavə etdi.'),
('redaktor senedlesme prosesini yeniden yoxladi','Redaktor sənədləşmə prosesini yenidən yoxladı.'),
('istifadeci tehlukesiz baglanti qurdu','İstifadəçi təhlükəsiz bağlantı qurdu.'),
('muhendis komputeri axsam sondurdu','Mühəndis kompüteri axşam söndürdü.'),
('usaq isti cay icdi','Uşaq isti çay içdi.'),
('qonaq kofe icib pencereni acdi','Qonaq kofe içib pəncərəni açdı.'),
('musteri gonderilmis teklifleri oxudu','Müştəri göndərilmiş təklifləri oxudu.'),
('analitik saxlanilmis neticeleri muqayise etdi','Analitik saxlanılmış nəticələri müqayisə etdi.'),
('rehber mutesessis ile gorusdu','Rəhbər mütəxəssis ilə görüşdü.'),
('sabah yeni proqramci ise baslayacaq','Sabah yeni proqramçı işə başlayacaq.'),
('zengli saat calanda tez oynib isiqi yandirdim','Zəngli saat çalanda tez oyanıb işığı yandırdım.'),
('gunes dogduqda yolumuza davam etdik','Günəş doğduqda yolumuza davam etdik.'),
('komekci zegli saati masaya qoydu','Köməkçi zəngli saatı masaya qoydu.'),
('komanda duzeldilmis fayli yeniden gonderdi','Komanda düzəldilmiş faylı yenidən göndərdi.'),
('musteri sabah qayidacaq','Müştəri sabah qayıdacaq.'),
('telebe imtahana hazirlasir','Tələbə imtahana hazırlaşır.'),
('backend API cavabini JSON formatinda qaytarir','Backend API cavabını JSON formatında qaytarır.'),
('GitHub commit ve Vercel deploy haqqinda danisdiq','GitHub commit və Vercel deploy haqqında danışdıq.'),
('PostgreSQL bazasinda melumatlar saxlanilir','PostgreSQL bazasında məlumatlar saxlanılır.'),
('hecbir fayl silinmedi','Heç bir fayl silinmədi.'),
('hersey evvelki kimi qaldi','Hər şey əvvəlki kimi qaldı.'),
('birmuddet gozleyib yeniden yoxladiq','Bir müddət gözləyib yenidən yoxladıq.'),
('bugunku gorus saat onda basladi','Bugünkü görüş saat onda başladı.'),
('Mən loglara baxdım.','Mən loglara baxdım.'),
('Sürət həddi dəyişməyib.','Sürət həddi dəyişməyib.'),
('Surət arxivdə saxlanılır.','Surət arxivdə saxlanılır.'),
('Sənədin adı dəyişməyib.','Sənədin adı dəyişməyib.'),
('Əli Bakı şəhərində yaşayır.','Əli Bakı şəhərində yaşayır.'),
('Azərbaycan Respublikası barədə danışdıq.','Azərbaycan Respublikası barədə danışdıq.'),
('render framework startup database','Render framework startup database.'),
('`const userName = "seher";`','`const userName = "seher";`'),
('https://example.com/qovluga?id=7','https://example.com/qovluga?id=7'),
('operator qovluğu açdı müştəri sənədi oxudu','Operator qovluğu açdı. Müştəri sənədi oxudu.'),
('əməkdaş məktubu göndərdi rəhbər cavabı gözləyir','Əməkdaş məktubu göndərdi. Rəhbər cavabı gözləyir.'),
('sistem sorğunu aldı komanda nəticəni yoxladı','Sistem sorğunu aldı. Komanda nəticəni yoxladı.'),
('mən sənədi oxuyub qeydləri yazdım','Mən sənədi oxuyub qeydləri yazdım.'),
('dedi ki sənədi oxuyub qeydləri yazacaq','Dedi ki, sənədi oxuyub qeydləri yazacaq.'),
('əgər sistem işləsə nəticəni göndərəcəyik','Əgər sistem işləsə, nəticəni göndərəcəyik.'),
('Komanda backend endpointini yoxladı.','Komanda backend endpointini yoxladı.'),
('Hesabatda 12.5 və 1.2.3 göstərilib.','Hesabatda 12.5 və 1.2.3 göstərilib.'),
]
rows=[]
for i,(inp,target) in enumerate(pairs):
 rows.append(dict(id=f'challenge-{i+1:03}',input=inp,target=target,mode='text',preserveFormatting=i in (30,31),domain='protected' if i>=23 and i<32 else 'daily-mail-it',origin='separately-authored-evaluation-only'))
# Same content also exercises the actual mail strategy, without training it.
for i,(inp,target) in enumerate(pairs[:23]):
 rows.append(dict(id=f'challenge-mail-{i+1:03}',input=inp,target='Salam, hər vaxtınız xeyir.\n\n'+target+'\n\nHörmətlə,',mode='mail',preserveFormatting=False,domain='mail',origin='separately-authored-evaluation-only'))
pathlib.Path('data/local-ai/challenge-v2.json').write_text(json.dumps(dict(source='63 separately authored text/mail evaluations; fixed targets, excluded from training; assistant review, not linguist certification',rows=rows),ensure_ascii=False,indent=2)+'\n')
