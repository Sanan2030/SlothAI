"""Author-designed compositional evaluation cases; never imports engine output."""
import hashlib,json
from pathlib import Path
fold=str.maketrans('əçğıöşüƏÇĞİÖŞÜ','ecgiosuECGIOSU')
def raw(text):
    return text.translate(fold).lower()
scenarios=[
 ('Sənəd','sənəd','qeydiyyat'),('Məktub','məktub','poçt'),('Sorğu','sorğu','müraciət'),
 ('Hesabat','hesabat','analitika'),('Müqavilə','müqavilə','hüquq'),('Fayl','fayl','ixrac'),
 ('Layihə','layihə','plan'),('Sifariş','sifariş','ödəniş'),('Bildiriş','bildiriş','xəbər'),
 ('Təklif','təklif','biznes'),
]
actions=[
 'qeydiyyata alınıb.', 'hazırdır.', 'sabah göndəriləcək.', 'yenidən yoxlanılır.',
 'arxivdə saxlanılır.', 'bu gün təsdiqlənib.', 'komandaya təqdim olunub.',
 'əlavədə göstərilir.', 'müştəriyə göndərilib.', 'hələ tamamlanmayıb.',
]
reports=[
 'Yeni sənəd hazırdır.', 'Məktub qeydiyyata alınıb.', 'Sorğu sistemə daxil olub.',
 'Hesabat arxivdə saxlanılır.', 'Müqavilə təsdiqlənib.', 'Fayl yenidən yoxlanılıb.',
 'Layihə komandaya təqdim olunub.', 'Sifariş qəbul olunub.', 'Bildiriş göndərilib.',
 'Təklif rəhbərliyə təqdim edilib.', 'Qeydiyyat tamamlanıb.', 'Yoxlama başa çatıb.',
 'Sənəd müştəriyə göndərilib.', 'Məktub şəxsi kabinetdə görünür.', 'Sorğu icraya yönləndirilib.',
 'Hesabatın yeni variantı hazırdır.', 'Fayl serverdə saxlanılır.', 'Müraciət qeydə alınıb.',
 'Test uğurla tamamlanıb.', 'Sistem yenidən işə salınıb.',
]
requests=['Nəticəni yoxlayın.', 'Rəyinizi bildirin.', 'Cavabı göndərin.', 'Məlumatı təsdiqləyin.', 'Sənədi nəzərdən keçirin.']
cases=[]
for i,(subject,noun,domain) in enumerate(scenarios):
 for j,action in enumerate(actions):
  expected=subject+' '+action
  cases.append(dict(id=f'fresh-text-{i*10+j+1:03}',mode='text',domain=domain,input=raw(expected).rstrip('.'),expected=expected))
for i,report in enumerate(reports):
 for j,request in enumerate(requests):
  body=report+' '+request
  # Alternate fully structured and dense inline correspondence.
  subject=f'Yoxlama {i+1}-{j+1}'
  if j%2:
   text=f'Mövzu: {subject}\nHörmətli komanda,\n'+raw(body).replace('.','')+'\n\nHörmətlə,\nLayihə komandası'
   signature='Layihə komandası'
  else:
   text=f'movzu {subject} salam komanda '+raw(body).replace('.','')+' hormetle senan'
   signature='Sənan'
  expected=f'Mövzu: {subject}\n\nHörmətli komanda,\n\n{body}\n\nHörmətlə,\n{signature}'
  cases.append(dict(id=f'fresh-mail-{i*5+j+1:03}',mode='email',domain='correspondence',input=text,expected=expected))
assert len(cases)==200 and len({x['input'] for x in cases})==200
for row in cases:row['inputSha256']=hashlib.sha256(row['input'].encode()).hexdigest()
result=dict(review=dict(reviewer='assistant-editor',method='200 compositional cases authored before evaluation from 10 subjects, 10 distinct actions, 20 reports and 5 requests. These are structured synthetic evaluations, not a blind natural-language corpus. No output copied from engine.',trainingUse='none; evaluation only'),cases=cases)
Path('tests/fixtures/additional-gold-200.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
