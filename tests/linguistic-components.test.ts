import assert from 'node:assert/strict';
import test from 'node:test';
import { correctText, formatEmail } from '../lib/editor/correct';
import { spellingCandidates, boundedEditDistance, chooseIndexedTypo } from '../lib/editor/spelling-candidates';
import { productiveMorphology } from '../lib/editor/productive-morphology';
import { segmentIndependentClauses } from '../lib/editor/segmentation';

test('indexed candidate repairs an internal omission while preserving exact words, names and protected spans', () => {
  const before = 'funksionallq sistemdə aktivdir';
  const after = correctText(before).text;
  assert.equal(after, 'Funksionallıq sistemdə aktivdir.');
  assert.equal(correctText(after).text, after);
  assert.equal(correctText('funksionallıq sistemdə aktivdir').text, after);
  assert.equal(correctText('Zyphoria funksionallq').text, 'Zyphoria funksionallıq.');
  assert.equal(correctText('`funksionallq` https://example.com/funksionallq').text,
    '`funksionallq` https://example.com/funksionallq.');
  assert.ok(spellingCandidates.candidates('funksionallq', 3).includes('funksionallıq'));
  assert.equal(boundedEditDistance('abc', 'acb', 1), 1);
  assert.equal(chooseIndexedTypo('sistme'), 'sistem');
  assert.equal(correctText('sistme aktivdir').text, 'Sistem aktivdir.');
  assert.equal(chooseIndexedTypo('məlumatt'), 'məlumat');
  assert.equal(correctText('məlumatt hazırdır').text, 'Məlumat hazırdır.');
  assert.equal(correctText('Zyphoria Velmora Xadricon Arvenix').text, 'Zyphoria Velmora Xadricon Arvenix.');
  assert.equal(correctText('Mən hər səhər evdə yatıram.').text, 'Mən hər səhər evdə yatıram.');
  assert.equal(correctText('Mən həmişə çayın kənarında qaçıram.').text, 'Mən həmişə çayın kənarında qaçıram.');
  assert.equal(chooseIndexedTypo('məktəb'), undefined);
});

test('nominal and verbal morphology has actual features, bounded generation and reversible lemmas', () => {
  const noun = productiveMorphology.analyzeWord('layihələrimizdən');
  assert.ok(noun.some(value => value.lemma === 'layihə' && value.features.case === 'ablative'));
  assert.ok(productiveMorphology.stripSuffixes('layihələrimizdən').some(value => value.stem === 'layihə'));
  assert.ok(productiveMorphology.generateForms({ lemma: 'layihə', features: { number: 'plural' }, limit: 3 }).length <= 3);
  for (const surface of ['gəlirəm', 'gəlmiş', 'gəlmir', 'gələcək', 'gələcəyəm', 'yazılır']) {
    assert.ok(productiveMorphology.isValidWordForm(surface), surface);
  }
  assert.equal(productiveMorphology.isValidWordForm('Zyphoria'), false);
  for (const [surface, lemma] of [['kitablarımızdan', 'kitab'], ['sənədlərimizdən', 'sənəd'],
    ['müqavilələrimizdən', 'müqavilə'], ['sistemlərimizdən', 'sistem'],
    ['uşağımızdan', 'uşaq'], ['ürəyimizdən', 'ürək'], ['kitablarınızdan', 'kitab']] as const) {
    assert.ok(productiveMorphology.analyzeWord(surface).some(analysis => analysis.lemma === lemma && analysis.features.case === 'ablative'), surface);
  }
  for (const [surface, lemma, mood] of [['yazaraq', 'yaz', 'converb'], ['gələrək', 'gəl', 'converb'],
    ['gəlib', 'gəl', 'converb'], ['qoruyub', 'qoru', 'converb'], ['yazmalı', 'yaz', 'necessity'],
    ['yazmalıdır', 'yaz', 'necessity']] as const) {
    assert.ok(productiveMorphology.analyzeWord(surface).some(record => record.lemma === lemma && record.features.mood === mood), surface);
  }
});

test('finite-clause segmentation keeps dependent clauses and participles attached', () => {
  assert.equal(segmentIndependentClauses('Qatar gecikirdi sərnişinlər gözləyirdi'),
    'Qatar gecikirdi. sərnişinlər gözləyirdi');
  assert.equal(segmentIndependentClauses('mən gələndə müdir danışırdı'), 'mən gələndə müdir danışırdı');
  assert.equal(segmentIndependentClauses('qəbul olunmuş sənədlər yoxlanılır'),
    'qəbul olunmuş sənədlər yoxlanılır');
});

test('mail pipeline does not fabricate names or punctuate a signature as prose', () => {
  const draft = 'mövzu: iclas haqqında\nsalam\ngörüş sabah keçiriləcək\nhörmətlə\nSanan Nabizada';
  const formatted = formatEmail(draft).text;
  assert.equal(formatted, 'Mövzu: İclas haqqında\n\nSalam,\n\nGörüş sabah keçiriləcək.\n\nHörmətlə,\nSanan Nabizada');
  assert.equal(formatEmail(formatted).text, formatted);
  assert.doesNotMatch(formatEmail('salam cavab hazirdir').text, /Nabizada/u);
  const multiline = 'Mövzu: Server vəziyyəti\nHörmətli Nərmin xanım,\nHesabat hazırdır. Sabah göndərəcəyik.\nHörmətlə,\nSanan Nabizada\nBackend Engineer';
  const mail = formatEmail(multiline).text;
  assert.ok(mail.endsWith('Hörmətlə,\nSanan Nabizada\nBackend Engineer'));
  assert.equal(formatEmail(mail).text, mail);
  const compact = formatEmail('hesabat hormetli komanda yeni sorğu qəbul edildi hormetle Sənan Nabizada').text;
  assert.match(compact, /^Mövzu: Hesabat\n\nHörmətli komanda,\n\n/u);
});
