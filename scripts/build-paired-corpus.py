import json,pathlib,hashlib
# Independently authored correct clauses and explicit errors; synthetic variants
# are marked, never represented as real user logs or human certification.
subjects=['Müştəri','Operator','Analitik','Redaktor','Müəllim','Rəhbər','Əməkdaş','İnzibatçı','İcraçı','Mütəxəssis','Tələbə','Katib']
actions=[('sənədi yoxladı','sənədin'),('məktubu hazırladı','məktubun'),('müraciəti qeydə aldı','müraciətin'),('hesabatı göndərdi','hesabatın'),('nəticəni təsdiqlədi','nəticənin'),('məlumatı yenilədi','məlumatın'),('tapşırığı tamamladı','tapşırığın'),('qovluğu açdı','qovluğun'),('sorğunu araşdırdı','sorğunun'),('bildirişi oxudu','bildirişin'),('cədvəli düzəltdi','cədvəlin'),('səhifəni yoxladı','səhifənin')]
rows=[]
fold=lambda t:t.lower().translate(str.maketrans('əıçğöşü','eicgosu'))
for si,s in enumerate(subjects):
 for ai,(a,n) in enumerate(actions):
  # Entire subject/action family stays in one split across all error variants.
  key=f'{si}-{ai}';h=int(hashlib.sha256(key.encode()).hexdigest()[:8],16)%10
  split='test' if h==0 else 'validation' if h==1 else 'train'
  target=f'{s} {a}. Komanda {n} düzgünlüyünü yoxlayır.'
  ascii=fold(target)
  candidates=[('diacritics',ascii),('punctuation',ascii.replace('.','')),('digraph',ascii.replace('s','sh').replace('c','ch').replace('.',''))]
  words=ascii.split();at=1;w=words[at]
  if len(w)>5:
   candidates += [('missing',ascii.replace(w,w[:2]+w[3:],1)),('extra',ascii.replace(w,w[:3]+w[2]+w[3:],1)),('swap',ascii.replace(w,w[:2]+w[3]+w[2]+w[4:],1))]
  for kind,inp in candidates:
   rows.append(dict(id=f'authored-{si:02}-{ai:02}-{kind}',group=f'authored-{key}',split=split,input=inp,target=target,origin='authored-template-synthetic-error',domain='mail-rsd',kind=kind))
# Diverse manually paired token errors embedded in multiple distinct clauses.
pairs=[('oynib','oyanıb'),('zegli','zəngli'),('icdi','içdi'),('dogduqda','doğduqda'),('qovluga','qovluğa'),('melumati','məlumatı'),('senedlesme','sənədləşmə'),('mutesessis','mütəxəssis'),('teklifler','təkliflər'),('tehlukesiz','təhlükəsiz'),('neticeler','nəticələr'),('komputer','kompüter'),('proqramci','proqramçı'),('duzeldilmis','düzəldilmiş'),('gonderilmis','göndərilmiş'),('qayidacaq','qayıdacaq'),('hazirlasir','hazırlaşır'),('saxlanilmis','saxlanılmış')]
# Do not use held-out evaluation sentences; these are different authored contexts.
frames=['İclasda {w} sözü nümunə kimi göstərildi.','Redaktor {w} sözünün yazılışını yoxladı.','Müəllim lövhəyə {w} sözünü yazdı.','Tələbə {w} sözünü dəftərinə köçürdü.']
for pi,(bad,good) in enumerate(pairs):
 for fi,frame in enumerate(frames):
  rows.append(dict(id=f'lexical-{pi}-{fi}',group=f'lexical-{pi}-{fi}',split='train',input=frame.replace('{w}',bad),target=frame.replace('{w}',good),origin='authored-explicit-typo',domain='language-exercise',kind='reviewed-token-error'))
for bad,good in [('hecbir','heç bir'),('hersey','hər şey'),('birmuddet','bir müddət'),('bugunku','bugünkü')]:
 for fi,frame in enumerate(['Mən {w} barədə məlumat verdim.','Biz {w} barədə yenidən danışdıq.','Komanda {w} barədə soruşdu.']):
  # Only grammatically appropriate frames for heç bir/bir müddət.
  if good=='heç bir': frame=['{w} problem aşkar edilmədi.','{w} dəyişiklik edilməyib.','{w} məlumat silinməyib.'][fi]
  if good=='bir müddət': frame=['{w} gözləmək lazımdır.','Sistem {w} işləmədi.','Komanda {wət} sonra qayıtdı.'.replace('{wət}','{w}')][fi]
  if good=='bugünkü': frame=['{w} iclas başa çatdı.','{w} hesabat təqdim edildi.','{w} nəticələr hazırdır.'][fi]
  rows.append(dict(id=f'space-{bad}-{fi}',group=f'space-{bad}-{fi}',split='train',input=frame.replace('{w}',bad),target=frame.replace('{w}',good),origin='authored-explicit-spacing',domain='daily',kind='spacing'))
for row in rows:
 row['target']=row['target'][0].upper()+row['target'][1:] if row['target'][0]!='i' else 'İ'+row['target'][1:]
pathlib.Path('data/local-ai/paired-additions.json').write_text(json.dumps(dict(version=1,source='Assistant-authored examples and explicitly labelled synthetic corruptions; not scraped user data',rows=rows),ensure_ascii=False,indent=2)+'\n')
print(len(rows))
