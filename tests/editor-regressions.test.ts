import { test } from 'node:test';
import assert from 'node:assert/strict';
import { correctText, formatEmail } from '../lib/editor/correct';

const examples = [
  ['İşgüzar müraciət', 'salam her vaxtiniz xeyir zehmet olmasa sabahki gorusun vaxtini deqiqlesdirin', 'Salam, hər vaxtınız xeyir. Zəhmət olmasa, sabahkı görüşün vaxtını dəqiqləşdirin.'],
  ['Mürəkkəb cümlə', 'men bilirem ki senedler hazirdir amma hele gonderilmedi', 'Mən bilirəm ki, sənədlər hazırdır, amma hələ göndərilmədi.'],
  ['Nida cümləsi', 'ne gozel gundur', 'Nə gözəl gündür!'],
  ['Dolayı sual', 'nece islediyini bilirem', 'Necə işlədiyini bilirəm.'],
  ['Müstəqil sual', 'nece isleyir', 'Necə işləyir?'],
  ['Siyahı', 'plan: 1) senedi hazirla 2) yoxla 3) gonder', 'Plan:\n1. Sənədi hazırla.\n2. Yoxla.\n3. Göndər.'],
  ['Dırnaq', '“salam” dedi', '“Salam” dedi.'],
  ['Mötərizə', 'sənəd ( layihə ) hazırdır', 'Sənəd (layihə) hazırdır.'],
  ['Onluq ədədlər', 'qiymet 12,50 manatdir', 'Qiymət 12,50 manatdır.'],
  ['Əlaqə məlumatı', 'elaqe: test@example.com, https://example.com/a.', 'Əlaqə: test@example.com, https://example.com/a.'],
  ['Abzas', 'men de gelirem bundan elave senedleri getirirem', 'Mən də gəlirəm.\n\nBundan əlavə sənədləri gətirirəm.'],
  ['Xüsusi adlar', 'bugun bakida hava yaxsidir sabah genceye gedeceyem', 'Bu gün Bakıda hava yaxşıdır. Sabah Gəncəyə gedəcəyəm.'],
  ['Ardıcıl cümlələr', 'men geldim sen getdin biz gorusduk', 'Mən gəldim. Sən getdin. Biz görüşdük.'],
  ['Boşluqsuz durğu', 'salam!necesen?men yaxsiyam', 'Salam! Necəsən? Mən yaxşıyam.'],
  ['Düzgün mətn', 'Mən gələndə sən gedirsən.', 'Mən gələndə sən gedirsən.'],
  ['Yer bildirən söz', 'Kitab məndədir.', 'Kitab məndədir.'],
  ['Qısaltma', 'API işləyir.', 'API işləyir.'],
  ['Kod', '`const x = "salam";`', '`const x = "salam";`'],
] as const;

for (const [name, input, expected] of examples) {
  test(name, () => {
    const result = correctText(input).text;
    assert.equal(result, expected);
    assert.equal(correctText(result).text, result, 'A second pass must not change the result');
  });
}

test('email signatures remain unpunctuated and stable', () => {
  const input = 'salam\nzehmet olmasa melumatlari gonderin\nhormetle\nSənan';
  const result = formatEmail(input).text;
  assert.equal(result, 'Mövzu: Müraciət\n\nSalam,\n\nZəhmət olmasa, məlumatları göndərin.\n\nHörmətlə,\nSənan');
  assert.equal(formatEmail(result).text, result);
});

test('dense 10,000 character text preserves protected facts through every paragraph', () => {
  const sentence = 'sened hazirdir bundan elave https://example.com/ID_42 12,50 14:30 API. ';
  const input = sentence.repeat(Math.floor(10000 / sentence.length));
  const output = correctText(input).text;
  for (const value of ['https://example.com/ID_42', '12,50', '14:30', 'API']) {
    assert.equal(output.split(value).length, input.split(value).length);
  }
  assert.equal(correctText(input, true).text.includes('\n'), false);
});
