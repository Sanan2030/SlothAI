import assert from 'node:assert/strict';
import test from 'node:test';
import { correctText } from '../lib/editor/correct';

// Cases discovered with a hand-authored corpus separate from the repository fixtures.
const corrections = [
  ['bəlkə bir az dincələk', 'Bəlkə bir az dincələk?'],
  ['mən arzu edirəm ki hamı sağlam olsun', 'Mən arzu edirəm ki, hamı sağlam olsun.'],
  ['baki dovlet universitetine mektub yazdim', 'Bakı Dövlət Universitetinə məktub yazdım.'],
  ['sehidler xiyabaninda gul qoyduq', 'Şəhidlər xiyabanında gül qoyduq.'],
  ['usaqlar meydancada oynayirdilar', 'Uşaqlar meydançada oynayırdılar.'],
  ['bu gozəl menzereye baxdiq', 'Bu gözəl mənzərəyə baxdıq.'],
  ['sirketin yeni sobesi acildi', 'Şirkətin yeni şöbəsi açıldı.'],
  ['agacin yarpagi payizda saraldi', 'Ağacın yarpağı payızda saraldı.'],
  ['dostlarim seherden rayona yollandilar', 'Dostlarım şəhərdən rayona yollandılar.'],
  ['seher yemeyi hazir olanda bizi cagirdilar', 'Səhər yeməyi hazır olanda bizi çağırdılar.'],
  ['əgər vaxtın varsa bu gün görüşək', 'Əgər vaxtın varsa, bu gün görüşək.'],
  ['bunu bilirsənmi', 'Bunu bilirsənmi?'],
  ['mən bilmirəm o nə vaxt gələcək', 'Mən bilmirəm o nə vaxt gələcək.'],
  ['git push edenden sonra vercel deploy basladi', 'Git push edəndən sonra Vercel deploy başladı.'],
] as const;

for (const [input, expected] of corrections) {
  test(`independent correction: ${input}`, () => {
    assert.equal(correctText(input).text, expected);
    assert.equal(correctText(expected).text, expected);
  });
}

test('HTML attributes remain untouched even when they contain question marks', () => {
  const input = '<a href="/hesabat?id=7">qeyd</a> vacibdir';
  const result = correctText(input).text;
  assert.equal(result, '<a href="/hesabat?id=7">qeyd</a> vacibdir.');
  assert.equal(correctText(result).text, result);
});

test('ambiguous words and declarative predictions stay unchanged', () => {
  assert.equal(correctText('gul əkdik').text, 'Gul əkdik.');
  assert.equal(correctText('bəlkə sabah yağış yağacaq').text, 'Bəlkə sabah yağış yağacaq.');
});
