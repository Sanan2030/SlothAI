"""Deterministic contract fixtures. Never imports the editor or learns its outputs."""
import hashlib
import html
import json
from pathlib import Path

SENTENCES = '''Uşaq rəngli qələmlə şəkil çəkir.
Bağban gülləri səhər sulayır.
Müəllim yeni mövzunu izah edir.
Şagird çantasını masaya qoydu.
Həkim xəstəni diqqətlə dinlədi.
Sürücü maşını dayanacaqda saxladı.
Satıcı müştəriyə qəbz verdi.
Kitabxanaçı köhnə kitabları yığdı.
Aşpaz tərəvəzləri xırda doğradı.
Dərzi köynəyin düyməsini tikdi.
Rəssam divara mənzərə çəkdi.
Fotoqraf uşaqların şəklini çəkdi.
Bağda ağacların yarpaqları saraldı.
Yağışdan sonra hava təmizləndi.
Güclü külək pəncərəni açdı.
Qar dağların zirvəsini örtdü.
Çayın suyu sahilə çatdı.
Quşlar yuvalarına qayıtdılar.
Pişik yumşaq yastıqda yatır.
İt həyətin qapısını qoruyur.
At yaşıl çəmənlikdə gəzir.
Balıqçı torunu dənizə atdı.
Gəmi limana yaxınlaşdı.
Qatar körpüdən yavaş keçdi.
Təyyarə buludların arasından çıxdı.
Avtobus növbəti dayanacaqda dayandı.
Velosipedçi dar küçədən keçdi.
Sərnişin biletini nəzarətçiyə göstərdi.
Turist xəritədə yolu axtardı.
Səyyah çantasını oteldə qoydu.
Mühəndis avadanlığı yenidən yoxladı.
Usta qapının kilidini dəyişdi.
Elektrik naqili diqqətlə yoxlandı.
İşıqlar axşam avtomatik yandı.
Telefonun ekranı qəfil söndü.
Kompüterin yaddaşı doldu.
Printer kağızı düzgün götürmədi.
İstifadəçi parolunu yenilədi.
Əməkdaş sənədi elektron poçtla göndərdi.
Operator müraciəti qeydiyyata aldı.
Rəhbər hesabatı diqqətlə oxudu.
Mühasib hesabı yenidən yoxladı.
Müştəri müqaviləni imzaladı.
Şirkət yeni ofis açdı.
Komanda layihəni vaxtında bitirdi.
İclas günortadan sonra başladı.
Təklif yazılı şəkildə təqdim edildi.
Sifariş anbara göndərildi.
Məhsulun qiyməti dəyişmədi.
Ödəniş uğurla tamamlandı.
Tələbə imtahana hazırlaşır.
Tədqiqatçı nəticələri müqayisə etdi.
Laboratoriyada yeni cihaz quraşdırıldı.
Təcrübənin nəticəsi qeydə alındı.
Məqalə elmi jurnalda çap olundu.
Universitet yeni proqram elan etdi.
Mühazirə böyük zalda keçirildi.
Seminarın mövzusu əvvəlcədən bildirildi.
İştirakçılar suallarını yazdılar.
Sertifikatlar tədbirdən sonra verildi.
Futbolçu topu qapıya vurdu.
Hakim oyunu dayandırdı.
Azarkeşlər komandanı alqışladılar.
İdmançı məşqdən sonra dincəldi.
Üzgüçü hovuzda məşq edir.
Şahmatçı növbəti gedişi düşündü.
Yarışın qalibi mükafat aldı.
Stadionun qapıları erkən açıldı.
Məşqçi oyunçulara tapşırıq verdi.
Komandanın kapitanı çıxış etdi.
Ailə axşam yeməyinə toplandı.
Ana süfrəyə isti çay qoydu.
Ata uşaqlara nağıl danışdı.
Nənə bağda çiçək əkdi.
Baba köhnə şəkillərə baxdı.
Bacı qardaşına hədiyyə aldı.
Qonaqlar qapının qarşısında gözlədilər.
Qonşu itmiş açarı tapdı.
Dostlar parkda görüşdülər.
Uşaqlar həyətdə oyun oynadılar.
Muzeydə qədim əşyalar sərgilənir.
Teatrın tamaşası vaxtında başladı.
Aktyor səhnəyə çıxdı.
Müğənni yeni mahnı oxudu.
Orkestr tamaşaçıları salamladı.
Rəqqas musiqinin ritminə uyğun hərəkət etdi.
Yazıçı romanın son fəslini bitirdi.
Şair yeni şeirini səsləndirdi.
Nəşriyyat kitabın üz qabığını dəyişdi.
Oxucu maraqlı hissəni qeyd etdi.
Fermer məhsulu bazara apardı.
Çörəkçi isti çörəyi sobadan çıxardı.
Arıçı pətəkləri yoxladı.
Çoban sürünü yaylağa apardı.
Torpaq yağışdan sonra yumşaldı.
Toxumlar münbit torpağa səpildi.
Meyvələr səbətlərə yığıldı.
Anbarın temperaturu ölçüldü.
Soyuducunun qapısı bağlı qaldı.
Mağazanın vitrini yeniləndi.'''.splitlines()
assert len(SENTENCES) == len(set(SENTENCES)) == 100
TRANSLITERATE = str.maketrans('əçğıöşüƏÇĞİÖŞÜ', 'ecgiosuECGIOSU')

PAYLOADS = [
    'https://example.az/api/search?q=seher&lang=az',
    'https://docs.example.az/guide#qeydiyyat',
    'https://bank.example.az:8443/loan?term=12&rate=9.5',
    'https://example.az/a%20b/c%2Fd?x=%26',
    'https://example.az/file.tar.gz?download=true',
    'https://example.az/path_(draft)/entry',
    'https://example.az/search?name=Əli&city=Bakı',
    'https://example.az/redirect?next=https%3A%2F%2Fother.az',
    'https://example.az/v1/items/550e8400-e29b-41d4-a716-446655440000',
    'https://example.az/log?at=2026-10-15T18:30:00Z',
    'http://localhost:3000/api/health', 'http://127.0.0.1:8080/status',
    'https://sub.domain.example.az/a/b/c', 'https://example.az/?empty=&flag',
    'https://example.az/?arr[]=one&arr[]=two', 'https://example.az/a+b?q=c+d',
    'https://example.az/%C9%99riz%C9%99', 'https://example.az/?x=1;y=2',
    'https://example.az/report.pdf#page=4', 'https://example.az/?quote=%22test%22',
    'https://example.az/?path=%2Ftmp%2Fwork', 'https://example.az/.well-known/security.txt',
    'http://intranet.example.az:9000/dashboard', 'https://example.az/?unicode=İşıq',
    'www.example.az/faq?q=niye',
    'sanan+review@example.az', 'first.last@dept.example.az', 'user_name@example.org',
    'a-b@example.net', 'billing+invoice-2026@example.com', 'qa.team@test.example.az',
    'noreply@notifications.example.az', 'support@bank.example.az', 'press@museum.example.az',
    'hello@restaurant.example.az', 'orders@bakery.example.az', 'security@example.io',
    'dev.ops@staging.example.dev', 'author+draft@journal.example.edu', 'hr@careers.example.az',
    'name.surname+tag@example.co.uk', 'office@branch.example.az', 'audit-log@example.info',
    'reports_annual@example.biz', 'test123@example.app', 'test.user@sub-domain.example.az',
    'it-helpdesk@example.cloud', 'invoice+refund@example.shop', 'admin@localhost.example.test',
    'student@university.example.edu',
    '`const seher = "suret";`', '`user_id !== null`', '`GET /api/v1/documents`',
    '`SELECT * FROM users WHERE name = \'Əli\';`', '`npm run build -- --debug`',
    '`git diff --cached --check`', '`curl -H "X-Test: seher" /api/health`',
    '`{"city":"Baki","message":"salam"}`', '`[1, 2, {"x": true}]`',
    '`a?.b ?? "default"`', '`x => x * 2`', '`foo.bar(baz[0])`', '`a && b || !c`',
    '`/(?<word>\\p{L}+)/gu`', '`<span data-id="x">seher</span>`',
    '`C:\\Users\\sanan\\file.txt`', '`/home/sanan/Desktop/project`',
    '`2026-10-15T22:25:00+04:00`', '`550e8400-e29b-41d4-a716-446655440001`',
    '`sha256:abcdef0123456789`', '`İŞIQ !== IŞIQ`', '`x = "əçğıöşü"`',
    '`obj["__proto__"]`', '`--no-verify`', '`a\u0308 !== ä`',
]
CODE = [
    ('js','const seher = "suret";\nconsole.log(seher);'),
    ('ts','interface User { ad: string }\nconst user: User = { ad: "Əli" };'),
    ('py','def salam(ad):\n    return f"Salam {ad}"'),
    ('sql','SELECT ad, soyad\nFROM users\nWHERE aktiv = true;'),
    ('json','{\n  "seher": "Baki",\n  "enabled": true\n}'),
    ('html','<div class="seher">\n  <span>suret</span>\n</div>'),
    ('css','.seher {\n  color: red;\n  margin: 0 auto;\n}'),
    ('sh','#!/bin/sh\nprintf "%s\\n" "salam"'),
    ('yaml','seher:\n  ad: Baki\n  aktiv: true'),
    ('toml','[seher]\nad = "Baki"\naktiv = true'),
    ('go','func salam() string {\n    return "salam"\n}'),
    ('rs','fn main() {\n    println!("seher");\n}'),
    ('java','class Seher {\n    String ad = "Baki";\n}'),
    ('c','int main(void) {\n    return 0;\n}'),
    ('cpp','std::string seher = "Baki";\nstd::cout << seher;'),
    ('php','<?php\n$seher = "Baki";\necho $seher;'),
    ('rb','seher = "Baki"\nputs seher'),
    ('swift','let seher = "Baki"\nprint(seher)'),
    ('kt','val seher = "Baki"\nprintln(seher)'),
    ('xml','<seher>\n  <ad>Baki</ad>\n</seher>'),
    ('ini','[seher]\nad=Baki\nport=8080'),
    ('diff','- seher\n+ şəhər'),
    ('csv','ad,seher\nƏli,Baki'),
    ('text','ilk setir\n\nson setir'),
    ('','əçğıöşü\nİ I ı i\n🙂 🧑‍💻'),
]
PAYLOADS += ['```'+lang+'\n'+body+'\n```' for lang,body in CODE]
assert len(PAYLOADS) == len(set(PAYLOADS)) == 100

cases = []
def add(kind, title, input, expected='', **details):
    cases.append(dict(id=f'{kind}-{sum(c["kind"]==kind for c in cases)+1:03}',
                      kind=kind, title=title, input=input, expected=expected, details=details))

for sentence in SENTENCES:
    # Reference sentences are authored above. Expectations are never editor snapshots.
    noisy = sentence.translate(TRANSLITERATE).lower().rstrip('.')
    add('correction', 'ASCII restoration: '+sentence, noisy, sentence)
    add('clean', 'Preserve correct sentence: '+sentence, sentence, sentence)
for literal in PAYLOADS:
    add('literal-engine','Preserve literal in document: '+literal,
        'Yoxlanılacaq məlumat:\n'+literal+'\nSənəd hazırdır.', literal)
    prefix='əvvəl '+('\ue000\ue001 ' if len(cases)%7 == 0 else '')
    add('literal-shield','Shield literal from structural edits: '+literal,
        prefix+literal+' sonra',prefix.replace('əvvəl','ƏVVƏL')+literal+' SONRA')

ATTACKS = ['<script>alert("x")</script>', '<img src=x onerror=alert(1)>',
           '<svg/onload=alert(1)>', '<iframe src="javascript:alert(1)"></iframe>',
           '<a href="javascript:alert(1)">a & b</a>', '<!-- seher -->',
           '" onclick="alert(1)', "' onmouseover='alert(1)", '<style>body{display:none}</style>',
           '<math><mtext>şəhər</mtext></math>', '<object data="x"></object>',
           '<template><img src=x></template>', '&lt;script&gt; & "İ"',
           '</code></p><script>x</script>', '<input autofocus onfocus=alert(1)>',
           '<video><source onerror=alert(1)></video>', '<form action="javascript:x">şərh</form>',
           '<details open ontoggle=alert(1)>ə</details>', '<link rel=stylesheet href=x>',
           '<!--\n<b>çoxsətirli</b>\n-->' ]
for attack in ATTACKS:
    for mark in ('bold','italic','underline','quote','code'):
        add('rich-html', f'Clipboard escapes {mark}: {attack}',attack,
            '<p><'+{'bold':'strong','italic':'em','underline':'u','quote':'q','code':'code'}[mark]+'>'
            +html.escape(attack,quote=True).replace('&#x27;','&#39;')+'</'
            +{'bold':'strong','italic':'em','underline':'u','quote':'q','code':'code'}[mark]+'></p>',
            marks=[mark], block='paragraph')

DIFF_BASES = ['Şəhər sürətlə böyüyür.', 'İşıq açıqdır.', 'IŞIQ və İŞIQ fərqlidir.',
              'Sənədin surəti arxivdədir.', 'Ana\n\nUşaq', 'şəxs-adı dəyişmir',
              'Qeyd: “əla”!','👩‍💻 kod yazır.', 'Cafe\u0301 açıqdır.', 'API v2.0 hazırdır.']
for base in DIFF_BASES:
    variants = [('',base,'insert-document'),(base,'','delete-document'),
                (base,base,'identity'),(base,'Yeni '+base,'prefix-insert'),
                (base,base+' Son.','suffix-insert'),('Silinsin '+base,base,'prefix-delete'),
                (base+' Silinsin',base,'suffix-delete'),(base,base.replace(' ','\t'),'whitespace'),
                (base,base+'\n🙂','emoji-insert'),(base,'Tamamilə başqa mətn.','replace-document')]
    for before,after,mode in variants:
        add('diff',f'{mode}: {base}',before,after,mode=mode)

WORDS=[('yanlis','yanlış'),('ugurlu','uğurlu'),('seher','şəhər'),('suret','surət'),
       ('melumat','məlumat'),('sened','sənəd'),('muqavile','müqavilə'),('muraciet','müraciət'),
       ('tesdiq','təsdiq'),('qebul','qəbul'),('unvan','ünvan'),('odenis','ödəniş'),
       ('elaqe','əlaqə'),('qaygi','qayğı'),('isci','işçi'),('cagiris','çağırış'),
       ('layihe','layihə'),('numune','nümunə'),('duzgun','düzgün'),('ehtiyac','ehtiyaclı')]
for source,target in WORDS:
    for mode in ('pending','confirmed','mismatch','sentence-boundary','protected-code'):
        add('personal-context',f'{mode}: {source} → {target}',f'Bu {source} nümunədir.',
            f'Bu {target} nümunədir.', source=source,target=target,mode=mode)

invalid_words = [None,False,True,0,1,[],{},'', ' ', '\t', '\n', '1', '12ab',
                 'a1','a_b','a.b','a/b','<b>ad</b>','a b','a--b','-ad','ad-',
                 "'ad","ad'",'a’','a\u200bb','a\u0000b','🙂','a'*41,'ş'*41]
for field in ('source','target'):
    for value in invalid_words:
        add('personal-storage',f'Reject invalid {field}: {value!r}',
            json.dumps({field:value},ensure_ascii=False),field=field,value=value)
invalid_context = [None,False,True,0,[],{},['bu'],{'left':'bu'},1.5,-1,42,'a'*41,'ş'*41,'🙂'*21,'\n'*41]
for field in ('left','right'):
    for value in invalid_context:
        add('personal-storage',f'Reject invalid {field}: {value!r}',
            json.dumps({field:value},ensure_ascii=False),field=field,value=value)
for raw in ('{','[','null','false','true','0','"string"','[]','{"pending":null}','{"confirmed":{}}'):
    add('personal-storage','Recover from invalid storage root: '+raw,raw,mode='root')

for at,sentence in enumerate(SENTENCES):
    mode=('roundtrip','normalized-replay','module-isolation','format-isolation','greeting-isolation')[at%5]
    add('expected-results',f'{mode}: {sentence}',sentence,sentence,mode=mode)

api=[]
def req(title,body,status=400,raw=False):
    api.append((title,body,status,raw))
base={'strategyId':'text-corrector','text':'Sənəd hazırdır.'}
for value in (None,False,True,0,1,[],{},['mətn'],{'text':'mətn'},'', ' ', '\t','\r\n','\u00a0','\u2003', 'a'*10001,'🙂'*5001):
    req('Invalid text '+repr(value)[:70],{**base,'text':value})
for field in ('preserveFormatting','omitSubject'):
    for value in (None,'true','false',0,1,[],{},['true'],{'value':True}):
        req(f'Invalid option {field}: {value!r}',{**base,'options':{field:value}})
for value in (None,False,True,0,[],{},'','salam','Hello,','<script>x</script>'):
    req('Invalid email greeting '+repr(value),{**base,'options':{'emailGreeting':value}})
for field in ('model','wordLMAnalysis','__proto__','constructor','temperature','device','prompt','apiKey','stream','language'):
    req('Unknown strict option '+field,{**base,'options':{field:'unexpected'}})
for value in (None,False,True,0,['text-corrector'],[],{},'',' ','a'*65):
    req('Invalid strategy identifier '+repr(value),{**base,'strategyId':value})
for value in (False,True,0,1,'text',[],['x']):
    req('Invalid options shape '+repr(value),{**base,'options':value})
for value in (None,False,True,0,'text',[],{}, {'text':'Sənəd hazırdır.'}):
    req('Invalid request shape '+repr(value),value)
for raw in ('','{','[','undefined','{"text":','{"x":NaN}','{"x":1,}','not-json'):
    req('Malformed JSON '+repr(raw),raw,raw=True)
for identifier in ('missing-strategy','Text-Corrector','gmail_corrector','../text-corrector'):
    req('Unknown strategy '+identifier,{**base,'strategyId':identifier},404)
for at in range(8):
    req('Valid strategy document '+SENTENCES[at],{**base,'text':SENTENCES[at]},200)
assert len(api)==100,len(api)
for title,body,status,raw in api:
    add('api',title,body if raw else json.dumps(body,ensure_ascii=False),status=status)

counts={kind:sum(c['kind']==kind for c in cases) for kind in sorted({c['kind'] for c in cases})}
assert len(cases)==1000,counts
assert set(counts.values())=={100},counts
assert len({c['id'] for c in cases})==len({c['title'] for c in cases})==1000
fingerprints=[hashlib.sha256(json.dumps({k:v for k,v in c.items() if k not in ('id','title')},sort_keys=True,ensure_ascii=False).encode()).hexdigest() for c in cases]
assert len(set(fingerprints))==1000,'Duplicate semantic case'
result={'schemaVersion':1,'description':'1000 distinct deterministic contract scenarios across ten application areas; not a blind linguistic accuracy benchmark.',
        'referencePolicy':'Hand-authored language references and independent invariants; no application output snapshots.',
        'counts':counts,
        'knownIssues':{
            'correction-002':'ASCII səhər/sulayır are not restored in the gardening sentence.',
            'correction-009':'ASCII xırda is not restored in the cooking sentence.',
            'correction-020':'The yard/team homograph is incorrectly resolved as heyətin.',
            'correction-059':'ASCII İştirakçılar is not restored.',
            'correction-078':'ASCII açarı is not restored in the lost-key context.',
            'correction-081':'ASCII sərgilənir is not restored.',
            'correction-082':'ASCII tamaşası is not restored.',
            'correction-088':'The poet/other homograph is not resolved as Şair.',
            'literal-engine-025':'The editor protects the www domain but rewrites its path/query.'},
        'cases':cases}
Path(__file__).with_name('unique-regression-1000.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
