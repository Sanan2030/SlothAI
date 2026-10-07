import json,hashlib,pathlib,re
root=pathlib.Path(__file__).resolve().parents[2]
# Assistant-authored clauses, never mined from model predictions or evaluation targets.
raw='''təhsil|Müəllim dərsin məqsədini izah etdi;Şagird kitabxanadan roman götürdü;Sinif rəhbəri davamiyyəti yoxladı;Tələbə məruzənin planını hazırladı;Laborant təcrübə üçün cihazları seçdi;Direktor dərs cədvəlini təsdiqlədi;Valideyn məktəbin həyətində gözlədi;Məzun qəbul sənədini təqdim etdi;Təlimçi məsələni lövhədə həll etdi;Kitabxanaçı köhnə dərsliyi bərpa etdi
səhiyyə|Həkim xəstənin təzyiqini ölçdü;Tibb bacısı sarğını dəyişdi;Cərrah əməliyyatın gedişini izah etdi;Əczaçı dərmanın təlimatını oxudu;Pasiyent qəbul üçün növbə götürdü;Laboratoriya nəticəni səhər göndərdi;Fizioterapevt məşqin müddətini azaltdı;Dietoloq qidalanma planını hazırladı;Stomatoloq dişin şəklini çəkdi;Klinika təcili yardıma xəbər verdi
nəqliyyat|Sürücü yol nişanını vaxtında gördü;Dispetçer avtobusun vaxtını dəyişdi;Sərnişin dayanacaqda bilet aldı;Maşinist qatarı ehtiyatla saxladı;Bələdçi vaqonun qapısını bağladı;Mexanik mühərrikin yağını yoxladı;Nəzarətçi keçid kartını oxutdu;Kuryer bağlamanı ünvana çatdırdı;Pilot uçuşun istiqamətini dəyişdi;Kapitan limana yaxınlaşdı
enerji|Mühəndis turbinin gücünü hesabladı;Usta elektrik xəttini təmir etdi;Texnik sayğacın göstəricisini yazdı;Operator stansiyanın yükünü azaltdı;Briqada kabelin yerini müəyyənləşdirdi;Mütəxəssis batareyanın tutumunu ölçdü;Nəzarətçi transformatoru yoxladı;İşçi günəş panelini təmizlədi;Qrup ehtiyat generatoru işə saldı;Analitik istehlakın artımını araşdırdı
kənd təsərrüfatı|Fermer əkin sahəsini suvardı;Aqronom torpaqdan nümunə götürdü;Bağban ağacın quru budağını kəsdi;Çoban sürünü otlağa apardı;Arıçı pətəyin qapağını açdı;Traktorçu sahənin kənarında dayandı;Biçinçi taxılın nəmliyini yoxladı;İşçi toxumları anbara daşıdı;Mütəxəssis gübrənin miqdarını hesabladı;Sahibkar məhsulu bazara çıxardı
maliyyə|Mühasib ödəniş sənədini yoxladı;Auditor hesabın qalığını təsdiqlədi;Analitik büdcənin strukturunu araşdırdı;Kassir müştəriyə qəbz verdi;İqtisadçı qiymət artımını izah etdi;Menecer xərclərin siyahısını hazırladı;İnvestor layihənin riskini qiymətləndirdi;Xəzinədar vəsaiti hesaba köçürdü;Nəzarətçi müqavilənin məbləğini yoxladı;Ekspert maliyyə hesabatını tamamladı
hüquq|Vəkil müqavilənin şərtini izah etdi;Hakim iclasın vaxtını bildirdi;Katib müraciəti qeydə aldı;Notarius sənədin surətini təsdiqlədi;İddiaçı ərizəni məhkəməyə verdi;Ekspert sübutun mənbəyini araşdırdı;Hüquqşünas qərarın əsasını yoxladı;Şahid hadisənin yerini göstərdi;Müdafiəçi etirazını yazılı bildirdi;Tərəflər razılaşmanı imzaladı
dövlət idarəetməsi|Katib rəsmi məktubu qeydiyyata aldı;İnspektor müəssisənin fəaliyyətini yoxladı;Komissiya müraciətin məzmununu araşdırdı;Vətəndaş qəbul üçün ərizə yazdı;Şöbə müdiri hesabatı imzaladı;Bələdiyyə nümayəndəsi təklifi dinlədi;İcraçı qərarın surətini göndərdi;Mütəxəssis xidmətin müddətini açıqladı;Nümayəndə yeni qaydanı izah etdi;İdarə arxivə sorğu göndərdi
sənəd dövriyyəsi|Arxivçi sənədin tarixini yoxladı;Redaktor məktubun başlığını dəyişdi;Katib əlavələrin sayını qeyd etdi;Operator imzanın etibarlılığını yoxladı;İcraçı bildirişin surətini saxladı;Şöbə protokolu rəhbərliyə göndərdi;Müfəttiş qeydiyyat jurnalını açdı;Mütəxəssis sənədin versiyasını seçdi;Əməkdaş cavab məktubunu hazırladı;Komissiya aktın mətnini təsdiqlədi
proqramlaşdırma|Proqramçı funksiyanın nəticəsini yoxladı;Mühəndis API üçün test yazdı;Komanda backend modulunu yenilədi;Analitik database sxemini araşdırdı;Tərtibatçı commit mesajını düzəltdi;Tester serverin cavabını ölçdü;Mütəxəssis framework versiyasını yoxladı;Menecer deploy vaxtını bildirdi;Operator JSON faylını açdı;İcraçı Git branch adını saxladı
kibertəhlükəsizlik|Ekspert giriş jurnalını araşdırdı;İnzibatçı hesabın parolunu dəyişdi;Analitik şübhəli trafiki aşkar etdi;Mühəndis sertifikatın tarixini yoxladı;Operator ehtiyat nüsxəni bərpa etdi;Komanda təhlükəsizlik qaydasını yenilədi;Nəzarətçi icazələrin siyahısını hazırladı;İşçi məxfi faylı şifrələdi;Mütəxəssis bildirişin mənbəyini yoxladı;İnzibatçı şəbəkənin sərhədini qorudu
telekommunikasiya|Texnik antenanın istiqamətini dəyişdi;Mühəndis siqnalın səviyyəsini ölçdü;Operator bağlantının müddətini yoxladı;Usta fiber kabeli birləşdirdi;Abunəçi xidmətin keyfiyyətini soruşdu;Dispetçer nasazlığı qeydə aldı;Mütəxəssis tezlik cədvəlini hazırladı;İşçi qurğunun yerini müəyyənləşdirdi;Qrup ötürücünün gücünü azaltdı;Analitik şəbəkənin yükünü hesabladı
astronomiya|Astronom teleskopun obyektivini təmizlədi;Tədqiqatçı ulduzun parlaqlığını ölçdü;Alim planetin orbitini hesabladı;Müşahidəçi səmanın şəklini çəkdi;Ekspert qalaktikanın məsafəsini araşdırdı;Komanda peykin trayektoriyasını yoxladı;Tələbə tutulmanın vaxtını hesabladı;Mühəndis cihazın sensorunu dəyişdi;Operator siqnalın gecikməsini ölçdü;Araşdırmaçı müşahidənin nəticəsini yazdı
ekologiya|Ekoloq çayın suyundan nümunə götürdü;Mütəxəssis havanın keyfiyyətini ölçdü;Könüllü sahildə tullantıları topladı;Tədqiqatçı quşların sayını qeyd etdi;İşçi fidanı torpağa əkdi;Komanda meşənin sərhədini xəritəyə çəkdi;Ekspert torpağın çirklənməsini araşdırdı;Nəzarətçi suyun sərfini yoxladı;Qrup ehtiyatların istifadəsini planlaşdırdı;Alim iqlimin dəyişməsini izah etdi
mədəniyyət|Kurator sərginin kataloqunu hazırladı;Rəssam tablonun rəngini seçdi;Aktyor səhnənin işığını yoxladı;Rejissor tamaşanın planını dəyişdi;Musiqiçi alətin kökünü yoxladı;Dirijor orkestri məşqə çağırdı;Bələdçi abidənin tarixini danışdı;Restavrator köhnə xalçanı bərpa etdi;Tənqidçi əsərin üslubunu araşdırdı;Təşkilatçı festivalın vaxtını açıqladı
idman|Məşqçi komandanın heyətini seçdi;İdmançı məşqin müddətini artırdı;Hakim oyunun qaydasını izah etdi;Üzgüçü hovuzun uzunluğunu ölçdü;Qaçışçı məsafəni vaxtında tamamladı;Fizioterapevt zədənin səbəbini araşdırdı;Kapitan rəqibin taktikasını yoxladı;Təlimçi hərəkətin texnikasını göstərdi;Azarkeş stadionda yerini tapdı;Komanda yarışın nəticəsini müzakirə etdi
qida|Aşpaz yeməyin duzunu yoxladı;Çörəkçi xəmirin çəkisini ölçdü;Qənnadçı tortun formasını seçdi;Ofisiant sifarişi mətbəxə çatdırdı;Mütəxəssis məhsulun tərkibini araşdırdı;İşçi soyuducunun temperaturunu azaltdı;Menecer menyunun qiymətini dəyişdi;Alıcı meyvənin yetişməsini yoxladı;Ekspert südün keyfiyyətini qiymətləndirdi;Satıcı ərzağı rəfə düzdü
turizm|Bələdçi səfərin marşrutunu izah etdi;Turist muzeyin girişini tapdı;Menecer otağın qiymətini bildirdi;Səyyah dağın zirvəsinə qalxdı;Təşkilatçı səfərin tarixini dəyişdi;Qonaq şəhərin xəritəsini aldı;İşçi rezervasiyanın statusunu yoxladı;Ekspert yolun təhlükəsizliyini araşdırdı;Qrup dayanacağın yerini seçdi;Fotoqraf mənzərənin şəklini çəkdi
tikinti|Memar binanın planını hazırladı;Usta divarın hündürlüyünü ölçdü;Mühəndis təməlin möhkəmliyini yoxladı;İşçi materialı meydançaya daşıdı;Briqadir işin müddətini hesabladı;Ekspert layihənin riskini araşdırdı;Operator kranın yükünü azaltdı;Nəzarətçi betonun tərkibini yoxladı;Texnik borunun diametrini ölçdü;Podratçı müqaviləni imzaladı
logistika|Anbardar yükün çəkisini ölçdü;Operator sifarişin ünvanını yoxladı;Kuryer çatdırılmanın vaxtını bildirdi;Dispetçer maşının yerini müəyyənləşdirdi;İşçi bağlamanın etiketini dəyişdi;Menecer daşınmanın qiymətini hesabladı;Nəzarətçi konteynerin möhürünü yoxladı;Komanda ehtiyatların sayını qeyd etdi;Ekspert zədənin səbəbini araşdırdı;Qrup yükü başqa anbara köçürdü
meteorologiya|Sinoptik hava proqnozunu hazırladı;Müşahidəçi küləyin sürətini ölçdü;Texnik termometrin göstəricisini yazdı;Ekspert yağıntının miqdarını hesabladı;Komanda buludun hərəkətini araşdırdı;Operator stansiyanın məlumatını göndərdi;Alim temperaturun artımını izah etdi;Mühəndis sensorun işləməsini yoxladı;Tədqiqatçı rütubətin səviyyəsini ölçdü;Mütəxəssis xəbərdarlığın vaxtını dəyişdi
geologiya|Geoloq süxurun tərkibini araşdırdı;Tədqiqatçı quyudan nümunə götürdü;Mühəndis layın dərinliyini ölçdü;Ekspert xəritənin miqyasını yoxladı;Komanda çatın istiqamətini qeyd etdi;Alim vulkanın fəaliyyətini izah etdi;İşçi cihazı yamaca daşıdı;Operator ölçmənin nəticəsini saxladı;Mütəxəssis sahənin sərhədini müəyyənləşdirdi;Qrup qazıntının planını hazırladı
riyaziyyat|Tələbə tənliyin həllini tapdı;Müəllim sübutun məntiqini izah etdi;Alim funksiyanın həddini hesabladı;Tədqiqatçı modelin parametrini seçdi;Analitik ehtimalın qiymətini yoxladı;Şagird fiqurun sahəsini ölçdü;Ekspert hesablamanın dəqiqliyini araşdırdı;Komanda nəticəni başqa üsulla yoxladı;Mütəxəssis dəyişənin mənasını açıqladı;İcraçı cədvəlin sütununu tamamladı
pərakəndə satış|Satıcı malın qiymətini dəyişdi;Alıcı məhsulun ölçüsünü yoxladı;Kassir ödənişin məbləğini bildirdi;Menecer endirimin müddətini açıqladı;İşçi vitrinə yeni məhsul qoydu;Nəzarətçi qəbzin tarixini yoxladı;Mütəxəssis tələbatın artımını araşdırdı;Anbardar ehtiyatın sayını qeyd etdi;Operator sifarişin statusunu yenilədi;Mağaza müştərinin sualını cavablandırdı
gündəlik həyat|Qonşu həyətin qapısını bağladı;Dostum görüşün vaxtını dəyişdi;Uşaq çantasını otağa apardı;Ailə səhər yeməyini hazırladı;Qonaq pəncərənin yanına keçdi;Sakin binanın girişini təmizlədi;Qardaşım kitabı rəfə qoydu;Bacım məktubun mətnini oxudu;Yoldaşım səfərin planını hazırladı;Ev sahibi açarı masanın üstünə qoydu'''
fold=str.maketrans('əçğıöşüƏÇĞİÖŞÜ','ecgiosuECGIOSU')
protected={'API','JSON','Git','backend','database','commit','framework','deploy','branch','fiber'}
def corrupt(s,kind):
    if kind=='identity': return s
    def change(m):
        w=m.group();
        if w in protected:return w
        if kind=='ascii':return w.translate(fold)
        if kind=='digraph':return w.replace('ç','ch').replace('ş','sh').replace('ğ','gh').replace('Ç','Ch').replace('Ş','Sh')
        if kind=='partial':return w.replace('ə','e').replace('ı','i')
        return w
    if kind in ['ascii','digraph','partial']:s=re.sub(r'\w+',change,s)
    elif kind=='case':s=s[0].lower()+s[1:]
    elif kind=='punctuation':s=s.rstrip('.')
    elif kind=='transpose':
        ms=[m for m in re.finditer(r'[a-zəçğıöşü]{5,}',s) if m.group() not in protected]
        m=ms[len(ms)//2];w=m.group();s=s[:m.start()]+w[:2]+w[3]+w[2]+w[4:]+s[m.end():]
    elif kind=='delete':
        ms=[m for m in re.finditer(r'[a-zəçğıöşü]{5,}',s) if m.group() not in protected];m=ms[-1];w=m.group();s=s[:m.start()]+w[:2]+w[3:]+s[m.end():]
    return s
hold=[];cal=[]
for d,line in enumerate(raw.splitlines()):
    domain,clauses=line.split('|');clauses=clauses.split(';');assert len(clauses)==10
    for j,c in enumerate(clauses):
        for v in range(2):
            text=c+'.' if v==0 else 'Yekun qeydə görə, '+c[0].lower()+c[1:]+'.'
            # Six identities per domain = 150/500. Corruption assignment fixed before any inference.
            kind='identity' if j<3 else ['ascii','digraph','partial','case','punctuation','transpose','delete'][(j-3+v+d)%7]
            inp=corrupt(text,kind)
            if inp==text and kind!='identity':kind='ascii';inp=corrupt(text,kind)
            assert inp!=text or kind=='identity'
            hold.append(dict(id=f'p0-h-{d:02}-{j:02}-{v}',documentId=f'holdout-{d:02}-{j:02}',domain=domain,category=kind,input=inp,expected=text))
    # Different documents/texts reserved for future calibration only; not scored during phase 0.
    for j in range(4):
        text=['Bu sahədə məlumatların keyfiyyəti ayrıca yoxlanılacaq.','Məsul əməkdaş yeni təklifləri yazılı şəkildə bildirəcək.','Araşdırmanın nəticələri növbəti toplantıda müzakirə olunacaq.','Növbəti mərhələnin vaxtı əlavə bildirişdə göstəriləcək.'][j]
        text='Hesabatın '+domain+' bölməsində qeyd edilib: '+text[0].lower()+text[1:]
        cal.append(dict(id=f'p0-c-{d:02}-{j}',documentId=f'calibration-{d:02}-{j}',domain=domain,category='ascii',input=corrupt(text,'ascii'),expected=text))
words=json.loads((root/'lib/editor/generated/az-words.json').read_text())
words=sorted(set(w for w in words if re.fullmatch('[a-zəçğıöşü]{4,22}',w)),key=lambda w:hashlib.sha256(('no-harm-seed-20261007'+w).encode()).hexdigest())[:2000]
no=[dict(id=f'p0-n-{i:04}',documentId=f'no-harm-{i:04}',domain='dictionary-form-mention',category='identity',probeWord=w,input=f'Mətndə {w} sözü işlənib.',expected=f'Mətndə {w} sözü işlənib.') for i,w in enumerate(words)]
base=root/'data/evaluation/phase0';base.mkdir(parents=True,exist_ok=True)
for name,rows,origin in [('holdout-500',hold,'assistant-authored, not human-reviewed; 250 clause documents, two contextual variants each'),('no-harm-2000',no,'MPL-2.0 pinned Hunspell-derived forms in assistant-authored metalinguistic sentences; not independent linguistic gold'),('calibration-100',cal,'assistant-authored, not human-reviewed; reserved, never used for model selection or evaluation in phase 0')]:
    data=dict(schemaVersion=1,purpose='calibration-only' if name.startswith('calibration') else 'evaluation-only',provenance=origin,trainingAllowed=False,cases=rows)
    b=(json.dumps(data,ensure_ascii=False,indent=2)+'\n').encode();(base/(name+'.json')).write_bytes(b);(base/(name+'.sha256')).write_text(hashlib.sha256(b).hexdigest()+'  '+name+'.json\n')
manifest={'baseCommit':'b3b5af74c366b1e57d9c64ce284384d8ad69ca66','seed':20261007,'holdout':{'sentences':len(hold),'domains':25,'identity':150,'documentClusters':250,'limitation':'Repeated subjects/actions and 250 paired clauses; not 500 independent documents or representative real user errors.'},'noHarm':{'forms':len(words),'source':'public/dictionaries/az/metadata.json','license':'MPL-2.0','limitation':'Dictionary membership is not expert certification; mention contexts do not test all natural inflections or meanings.'},'calibration':{'sentences':len(cal),'used':False,'limitation':'Four repeated frames across 25 domains; must be expanded before reliable calibration.'},'trainingAllowed':False}
(base/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('Created 500 holdout / 2000 unique no-harm probes / 100 calibration.')
