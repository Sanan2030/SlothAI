import assert from 'node:assert/strict';
import test from 'node:test';
import { SourceInflectionEngine } from '../lib/editor/source-inflection';
import { languageServices } from '../lib/editor/language-services';
import { correctText } from '../lib/editor/correct';
import { constrainedSpelling } from '../lib/editor/lexical-constraints';
import { guardInsertedBoundaries, segmentAuthoredSentenceStarts } from '../lib/editor/syntax-boundary-guard';
import { punctuateCommas } from '../lib/editor/punctuation';

test('classified verbs compose passive, negation, nominal case and personal moods', () => {
  const source = new SourceInflectionEngine(() => false, [
    { lemma: 'göndər', pos: 'verb' }, { lemma: 'say', pos: 'verb' },
    { lemma: 'izlə', pos: 'verb' }, { lemma: 'yenilə', pos: 'verb' },
  ]);
  for (const word of ['göndərilməməlidir', 'göndərilməsinə', 'göndərilməmiş', 'göndərilməsə',
    'göndərmərəm', 'göndərmərik', 'sayımında', 'izlənərkən', 'yenilənmədiyini']) {
    assert.ok(source.analyze(word).length, word);
  }
  for (const word of ['göndərilməməlidır', 'göndərməzəm', 'göndərməzək']) {
    assert.equal(source.analyze(word).length, 0, word);
  }
});

test('literal consonants and keyboard digraphs are independent source analyses', () => {
  for (const [input, expected] of [['techizatcilarla', 'təchizatçılarla'],
    ['marshrutlara', 'marşrutlara'], ['bildirilmesine', 'bildirilməsinə'],
    ['cavablandirilmamis', 'cavablandırılmamış'], ['vermeli', 'verməli']] as const) {
    assert.equal(languageServices.spelling.resolve(input, languageServices), expected, input);
  }
  assert.equal(languageServices.spelling.resolve('borcu', languageServices), 'borcu');
});

test('nominal agreement preserves pronouns, ordinary adjectives and author meanings', () => {
  const choose = (raw: string, left: string, right: string) =>
    constrainedSpelling(raw, raw, left, right, languageServices)?.word ?? raw;
  assert.equal(choose('onun', 'Baxışdan sonra ', ' nəticəsi qeydə alındı.'), 'onun');
  assert.equal(choose('sərin', '', ' səhər havası adamı gümrah edir.'), 'sərin');
  assert.equal(choose('isin', 'Tapşırılmış ', ' nəticəsi yoxlanılır.'), 'işin');
  assert.equal(choose('adi', 'Bu ', ' qutu yerə qoyuldu.'), 'adi');
  assert.equal(correctText('Yeganə xanım sənədi təqdim etdi.').text, 'Yeganə xanım sənədi təqdim etdi.');
  assert.equal(correctText('Bu, yeganə çıxış yoludur.').text, 'Bu, yeganə çıxış yoludur.');
});

test('boundary guards separate completed clauses and retain nominal modifiers', () => {
  assert.equal(guardInsertedBoundaries('Sistemə ötürüləcək məlumatlar yoxlanılır',
    'Sistemə ötürüləcək. Məlumatlar yoxlanılır'), 'Sistemə ötürüləcək məlumatlar yoxlanılır');
  assert.equal(guardInsertedBoundaries('Sənəd imzalanacaq komanda gözləyir',
    'Sənəd imzalanacaq. komanda gözləyir'), 'Sənəd imzalanacaq. komanda gözləyir');
  const authored = 'Plan hazırlandı Növbəti mərhələ yoxlanıldı';
  assert.equal(segmentAuthoredSentenceStarts(authored), 'Plan hazırlandı. Növbəti mərhələ yoxlanıldı');
  const lower = 'Plan hazırlandı növbəti mərhələ yoxlanıldı';
  assert.equal(segmentAuthoredSentenceStarts(lower, authored), authored);
  assert.equal(guardInsertedBoundaries('Fərdi. məlumat qorunur', 'Fərdi. məlumat qorunur'), 'Fərdi. məlumat qorunur');
  assert.equal(guardInsertedBoundaries('Maliyyə icmalında gəlir gözləntisi yoxlanıldı',
    'Maliyyə icmalında gəlir. Gözləntisi yoxlanıldı'), 'Maliyyə icmalında gəlir gözləntisi yoxlanıldı');
  assert.equal(guardInsertedBoundaries('O gəlir dostu isə gözləyir',
    'O gəlir. dostu isə gözləyir'), 'O gəlir. dostu isə gözləyir');
});

test('long native conditionals and contrasted complements keep grammatical commas', () => {
  assert.equal(punctuateCommas('Nəticə fərqlənirsə səbəb yoxlanılmalıdır'), 'Nəticə fərqlənirsə, səbəb yoxlanılmalıdır');
  assert.equal(punctuateCommas('Gəlsə də nəticə dəyişmir'), 'Gəlsə də nəticə dəyişmir');
  assert.equal(punctuateCommas('Bu yalnız sənəddə deyil iş prosesində yoxlanılır'), 'Bu yalnız sənəddə deyil, iş prosesində yoxlanılır');
  assert.equal(punctuateCommas('Bu sənəddə deyil və əlavə yoxdur'), 'Bu sənəddə deyil və əlavə yoxdur');
  assert.equal(punctuateCommas('Qısa izah verilir və kimsə onu oxuyur'), 'Qısa izah verilir və kimsə onu oxuyur');
});

test('context selects a full canonical inflection without retaining a malformed suffix', () => {
  const choose=(raw:string,left:string,right:string)=>constrainedSpelling(raw,raw,left,right,languageServices)?.word;
  assert.equal(choose('deyisdirilirse','İşin vaxtı ', ' qeyd yenilənir.'),'dəyişdirilirsə');
  assert.equal(choose('de','Nümunəni ', ' əhatə etdi.'),'də');
  assert.equal(choose('isin','Tamamlanmamış ', ' növbəti mərhələyə ötürülməsi razılaşdırıldı.'),'işin');
  assert.equal(choose('aciqlanir','Uşaq sözləri eşitdikdə ', '.'),undefined);
  assert.equal(choose('sert','Bu ', ' metal bərkdir.'),undefined);
});
