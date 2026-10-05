import test from 'node:test';
import assert from 'node:assert/strict';
import { correctText, formatEmail } from '../lib/editor/correct';
import { resolveRemainingPredicate, punctuateCausalTransition, segmentTechnicalNounClauses } from '../lib/editor/conservative-clauses';

export const requestedCases = [
  ['a', 'sirket yeni layiheni ireli surdu ve musterilerle gorush kecirdi', 'Şirkət yeni layihəni irəli sürdü və müştərilərlə görüş keçirdi.'],
  ['b', 'her kes evvelceden hazirlashmali idi chunki imtahan cetin olacaqdi', 'Hər kəs əvvəlcədən hazırlaşmalı idi, çünki imtahan çətin olacaqdı.'],
  ['c', 'azerbaycanin paytaxti bakidir ve orada cox sayda tarixi abide var', 'Azərbaycanın paytaxtı Bakıdır və orada çox sayda tarixi abidə var.'],
  ['d', 'neceyisen bu gun hava cox gozeldir gel gezmeye cixaq', 'Necəsən? Bu gün hava çox gözəldir, gəl gəzməyə çıxaq.'],
  ['e', 'mehsulun qiymeti endirim olunub lakin keyfiyyeti eyni qalib', 'Məhsulun qiyməti endirim olunub, lakin keyfiyyəti eyni qalıb.'],
  ['f', 'Muellimler telebelerin biliyini yoxlayanda obyektiv olmalidirlar', 'Müəllimlər tələbələrin biliyini yoxlayanda obyektiv olmalıdırlar.'],
  ['g', 'komputerim yavash isleyir ona gore yenisini almaq isteyirem', 'Kompüterim yavaş işləyir, ona görə yenisini almaq istəyirəm.'],
  ['h', 'serverde xeta bash verdi database baglantisi kesildi biz bunu duzeltdik', 'Serverdə xəta baş verdi. Database bağlantısı kəsildi. Biz bunu düzəltdik.'],
];
for (const [id, input, expected] of requestedCases) test('a–h release ' + id + ', stable second pass', () => {
  assert.equal(correctText(input).text, expected);
  assert.equal(correctText(expected).text, expected);
});
test('ambiguous winner nouns and conflicting cues abstain', () => {
  for (const text of ['Qalib mükafat aldı.', 'O, qalib oldu.', 'Keyfiyyəti eyni qalib komanda seçildi.', 'qalib', 'Qalibin adı məlumdur.'])
    assert.equal(resolveRemainingPredicate(text), text);
  assert.equal(resolveRemainingPredicate('Məhsulun keyfiyyəti sabit qalib.'), 'Məhsulun keyfiyyəti sabit qalıb.');
});
test('causal commas preserve author punctuation and nonclausal phrases', () => {
  for (const text of ['Kompüter işləyir, ona görə yenisini almaq istəyirəm.', 'Ona görə hədiyyə aldım.', 'Mən ona görə gəlmişəm.'])
    assert.equal(punctuateCausalTransition(text), text);
});
test('foreign modifier boundaries require a nominative possessed subject', () => {
  assert.equal(segmentTechnicalNounClauses('Xəta baş verdi database bağlantısı kəsildi'), 'Xəta baş verdi. database bağlantısı kəsildi');
  for (const text of ['O, məlumat verdi database bağlantısını yoxladı', 'O, məlumat verdi database bağlantısı haqqında danışdı', 'Xəta baş verdi, database bağlantısı kəsildi'])
    assert.equal(segmentTechnicalNounClauses(text), text);
});
test('both modes preserve URL, email, foreign terms and code', () => {
  const input = 'API işləyir, amma backend https://example.com/a və test@example.com üçün `git commit` saxlayır.';
  for (const actual of [correctText(input).text, formatEmail(input, { omitSubject: true }).text])
    for (const term of ['API', 'backend', 'https://example.com/a', 'test@example.com', '`git commit`']) assert.ok(actual.includes(term));
});
