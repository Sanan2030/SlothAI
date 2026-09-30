import { readFileSync, writeFileSync } from 'node:fs';
import { productiveMorphology } from '../lib/editor/productive-morphology';
import { boundaryKey, fold, trainContextModel } from '../lib/editor/local-ai/core';
import { isFinitePredicate } from '../lib/editor/segmentation';

// Explicitly synthetic morphology exercises, not independently reviewed human data.
const seeds = readFileSync('data/local-ai/seeds.txt', 'utf8').trim().split('\n');
const supplemental = readFileSync('data/local-ai/supplemental-training.txt', 'utf8').trim().split('\n');
const base = trainContextModel([...seeds.filter((_, i) => i % 5 !== 4 && !(i >= 100 && i % 5 === 3)), ...supplemental]);
const lemmas = 'məktəb müəllim tələbə şəhər kənd küçə otaq sənəd mətn layihə məsələ şirkət müştəri əməkdaş rəhbər görüş sorğu sual cavab dəyişiklik məlumat proqram cümlə səhifə istifadəçi kitab qapı dost ailə iş gün gecə vaxt hava yol park bağ çay dağ meşə ölkə dünya tarix elm təhsil sağlamlıq həkim xəstəxana universitet dərs imtahan fikir qərar plan məqsəd nəticə proses sistem server kod fayl xəta test xidmət məhsul bazar sifariş müqavilə məktub xəbər müraciət tələb təklif həll mənbə mərhələ modul komanda əməkdaşlıq vətəndaş insan həyat ürək idman yemək meyvə ağac ulduz planet kosmos sənət musiqi xəritə dəftər qələm masa pəncərə qatar avtobus dayanacaq liman gəmi təyyarə aeroport kitabxana bağça laboratoriya telefon kompüter ekran klaviatura düymə xəstə müəllif oxucu tamaşaçı rəssam müğənni aktyor oyun idmançı meydan stadion qida tərəvəz çörək çanta paltar mühit təbiət iqlim yağış külək bulud günəş uşaq ana ata bacı qardaş qadın kişi səhra çöl nəqliyyat enerji qayda hüquq qanun mütəxəssis təqdimat hesabat resurs təhlükə sınaq texnika məqalə şəkil rəng təcrübə quş bildiriş qeydiyyat icra əsl müddət'.split(' ');
const frames = {
  nominative: ['Bu gün {w} diqqətimizi cəlb etdi.', 'Dünən {w} diqqətimizi cəlb etdi.', 'İclasda {w} diqqətimizi cəlb etdi.'],
  genitive: ['Bu gün {w} təsviri diqqətlə araşdırıldı.', 'Dünən {w} təsviri diqqətlə araşdırıldı.', 'İclasda {w} təsviri diqqətlə araşdırıldı.'],
  dative: ['Bu gün {w} xüsusi diqqət yetirildi.', 'Dünən {w} xüsusi diqqət yetirildi.', 'İclasda {w} xüsusi diqqət yetirildi.'],
  accusative: ['Bu gün {w} diqqətlə nəzərdən keçirdik.', 'Dünən {w} diqqətlə nəzərdən keçirdik.', 'İclasda {w} diqqətlə nəzərdən keçirdik.'],
  locative: ['Bu gün {w} müəyyən dəyişiklik müşahidə edildi.', 'Dünən {w} müəyyən dəyişiklik müşahidə edildi.', 'İclasda {w} müəyyən dəyişiklik müşahidə edildi.'],
  ablative: ['Bu gün {w} ətraflı bəhs etdik.', 'Dünən {w} ətraflı bəhs etdik.', 'İclasda {w} ətraflı bəhs etdik.'],
} as const;
const seen = new Set([...Object.keys(base.forms), ...Object.keys(base.groups)]);
const forms: { lemma: string; word: string; grammaticalCase: string; texts: string[] }[] = [];
for (const lemma of lemmas) {
  for (const word of productiveMorphology.generateForms({ lemma, pos: 'noun', limit: 256 })) {
    if (forms.length === 900) break;
    const key = fold(word);
    if (key.length < 3 || key === word || seen.has(key) || productiveMorphology.findByFoldedForm(key) !== word) continue;
    const analysis = productiveMorphology.analyzeWord(word).find(item => !item.features.possessivePerson && item.features.case);
    if (!analysis?.features.case) continue;
    seen.add(key);
    forms.push({ lemma, word, grammaticalCase: analysis.features.case,
      texts: frames[analysis.features.case].map(frame => frame.replace('{w}', word)) });
  }
}
if (forms.length !== 900) throw new Error(`Expected 900 new unambiguous forms, found ${forms.length}`);
const leftClauses = ['Operator sənədi yoxladı', 'Müəllim məktubu oxuyur', 'Komanda bu məsələni araşdırır', 'Mütəxəssis tədbirdə danışır', 'Rəhbər cavabı gözləyir', 'Texnik problemi düzəldir', 'İstifadəçi faylı göndərdi', 'Redaktor səhvi gördü', 'İcraçı məlumatı hazırlayır', 'Sistem işi tamamlayacaq', 'Tələbə yenə öyrənir', 'İşçi hesabatı yazdı'];
const rightClauses = ['Müştəri nəticəni gözləyir', 'Əməkdaş məktubu hazırlayır', 'Rəhbər tapşırığı təsdiqləyir', 'Müəllim dərsi izah edir', 'Həkim xəstəni müayinə edir', 'Tələbə kitabı oxuyur', 'Komanda yeni işi planlaşdırır', 'Operator qeydiyyatı tamamlayır', 'Sistem bildirişi göndərir', 'İstifadəçi cavabı yoxlayır', 'Redaktor mətni oxuyur', 'Təhlükəsizlik qrupu nəticəni araşdırır'];
const boundarySeen = new Set(Object.keys(base.boundaries));
const boundaries: { key: string; left: string; right: string; texts: string[] }[] = [];
for (const left of leftClauses) for (const right of rightClauses) {
  const predicate = left.split(' ').at(-1)!;
  const key = boundaryKey(predicate, right.split(' ')[0]);
  if (boundaries.length === 100 || boundarySeen.has(key) || !isFinitePredicate(predicate)) continue;
  boundarySeen.add(key);
  boundaries.push({ key, left, right, texts: [`Bu gün ${left[0].toLocaleLowerCase('az-AZ') + left.slice(1)}. ${right}.`, `Dünən ${left[0].toLocaleLowerCase('az-AZ') + left.slice(1)}. ${right}.`, `İclasdan sonra ${left[0].toLocaleLowerCase('az-AZ') + left.slice(1)}. ${right}.`] });
}
if (boundaries.length !== 100) throw new Error(`Expected 100 new boundary patterns, found ${boundaries.length}`);
writeFileSync('data/local-ai/expansion.json', JSON.stringify({ source: 'Synthetic exercises from bounded noun morphology and authored clauses; not human-reviewed semantic data', forms, boundaries }, null, 2) + '\n');
console.log(JSON.stringify({ newWordForms: forms.length, newBoundaryPatterns: boundaries.length, trainingTexts: forms.length * 3 + boundaries.length * 3 }));
