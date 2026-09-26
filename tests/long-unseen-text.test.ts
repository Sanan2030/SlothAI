import assert from 'node:assert/strict';
import { test } from 'node:test';
import { correctText } from '../lib/editor/correct';

const source = [
  'bugun seher bakida hava serin idi amma men gecikirdim ona gore avtobusa tələsdim ofise catanda komanda artıq daily standup edirdi men backlogdaki yeni taskin prioritetini sorusdum product owner dedi ki bu funksiya musteri ucun vacibdir cunki onlar her gun hesabat yukleyirler sonra backendde api responseun niye gecikdiyini arasdirdiq gorduk ki database sorgusunda indeks yoxdur redis cache elave etdikden sonra sorgular daha suretli isledi gunortadan sonra elinin gonderdiyi pull requesti yoxladim kodun daxilinde TODO retry logic yazisi var idi amma testler kecirdi axsam isə bakı metrosunda internet zeyif idi deye deploy prosesini eve catandan sonra davam etdirdim',
  '',
  'sabah ucun planim:',
  '1) loglari yoxlamaq',
  '2) xetani tekrar etmek',
  '3) duzelisi stagingde test etmek',
].join('\n');

test('long unseen technical diary uses reviewed spelling, boundaries and list formatting', () => {
  const output = correctText(source).text;
  for (const expected of [
    'Bu gün səhər Bakıda hava sərin idi, amma mən gecikirdim, ona görə avtobusa tələsdim.',
    'Ofisə çatanda komanda artıq daily standup edirdi.',
    'Mən backlogdakı yeni taskın prioritetini soruşdum.',
    'Product owner dedi ki, bu funksiya müştəri üçün vacibdir, çünki onlar hər gün hesabat yükləyirlər.',
    'Sonra backenddə API response-un niyə gecikdiyini araşdırdıq.',
    'Gördük ki, database sorğusunda indeks yoxdur.',
    'Redis cache əlavə etdikdən sonra sorğular daha sürətli işlədi.',
    'Günortadan sonra Əlinin göndərdiyi pull request-i yoxladım.',
    'TODO retry logic yazısı var idi, amma testlər keçirdi.',
    'Axşam isə Bakı metrosunda internet zəif idi deyə deploy prosesini evə çatandan sonra davam etdirdim.',
    'Sabah üçün planım:', '1. Logları yoxlamaq.', '2. Xətanı təkrar etmək.', '3. Düzəlişi staging-də test etmək.',
  ]) assert.ok(output.includes(expected), expected);
  assert.equal(correctText(output).text, output);
});
