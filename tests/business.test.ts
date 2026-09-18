import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { correctText, formatEmail } from '../lib/editor/correct';

const { input } = JSON.parse(readFileSync(new URL('./fixtures/corporate-letter.json', import.meta.url), 'utf8'));

test('corporate letter repairs vocabulary, context and technical names', () => {
  const result = correctText(input).text;
  for (const phrase of ['Hörmətli müştəri nümayəndəsi,\n\nŞirkətimizin',
    'müvafiq ekspertlərimiz', 'infrastrukturunuzun yenilənməsi', 'bulud sistemlərinə',
    'etibarlı tərəfdaş', 'böyük məmnunluq', 'təkliflərimizi diqqətinizə çatdırırıq.',
    'gələcəkdəki inkişaf hədəfləriniz', 'gecikmələr isə', 'mexanizmləri işə düşəcəkdir.',
    'pik saatlarında', 'kəsintisiz ötürülməsidir.', 'REST və gRPC protokolları',
    'heç bir maneə yaratmayacaqdır.', 'dəqiqlik yoxlanılacaqdır.', 'Məxfi məlumatların',
    'məhdudiyyətlər də', 'giriş-çıxış əməliyyatları', 'tamamilə qarşısını almaq',
    'Fəlakətdən bərpa', 'müəyyən edilməsi ilə bağlı', 'Mütəxəssislərimiz',
    'Əməliyyatların kəsintisizliyi', 'lisenziyalaşdırılması', 'video təlimatlar da',
    'hesabatlılıq modulları', 'tələblər sənədini formalaşdıracaqlar.',
    'hesab-fakturalar', 'e-poçt ünvanlarına', 'qat-qat sürətləndirəcək',
    'daha sadə və anlaşılan', 'yanınızdadır. Diqqətiniz']) {
    assert.ok(result.includes(phrase), phrase);
  }
  assert.ok(result.endsWith('Hörmətlə,\nKorporativ müştəri əlaqələri bölməsi və sistem inteqrasiyası komandası'));
});

test('commercial commitments and payment periods retain their exact meaning', () => {
  const result = correctText(input).text;
  for (const fact of ['doxsan doqquz tam onda doqquz faiz',
    'iyirmi dörd saat, yeddi gün', 'maksimum on beş dəqiqə',
    'səkkiz həftə ərzində', 'rüblük və ya illik', 'hər ay müntəzəm']) {
    assert.ok(result.includes(fact), fact);
  }
});

test('all six stages become a list with schedule and signature outside it', () => {
  const result = correctText(input).text;
  assert.equal((result.match(/^\d\. /gm) ?? []).length, 6);
  assert.ok(result.includes('mərhələdən ibarətdir:\n1. İnfrastrukturun'));
  assert.ok(result.includes('\n2. Test mühiti'));
  assert.ok(result.includes('\n6. Tam şəkildə canlı rejimə keçid baş tutacaqdır.\n\nÜmumi keçid'));
  assert.equal(correctText(result).text, result);
});

test('preserve-formatting mode retains input line breaks and no generated list', () => {
  const result = correctText(input, true).text;
  assert.equal(result.split('\n').length, input.split('\n').length);
  assert.doesNotMatch(result, /^\d\. /m);
  assert.ok(result.includes('Altıncı mərhələdə isə'));
  const email = formatEmail(input).text;
  assert.equal(formatEmail(email).text, email);
});

test('stage recognition rejects gaps and descriptive uses of ordinal words', () => {
  for (const text of [
    'Plan iki əsas mərhələdən ibarətdir. Birinci mərhələdə test aparılacaq. Üçüncü mərhələdə iş bitəcək.',
    'Birinci mərhələdə test aparılacaq.',
    'Birinci sinif ikinci mərtəbədədir.',
  ]) assert.doesNotMatch(correctText(text).text, /^\d\. /m);
});

test('business rules also work in short unseen messages and preserve literal code', () => {
  assert.equal(correctText('mefhi melumatlar muafiq ekspertlerimiz terefinden yoxlanilacaq').text,
    'Məxfi məlumatlar müvafiq ekspertlərimiz tərəfindən yoxlanılacaq.');
  assert.equal(correctText('video rehberler de teqdim edilecekdir').text,
    'Video təlimatlar da təqdim ediləcəkdir.');
  const literal = '`rest ve grpc protokollari mefhi melumatlar`';
  assert.equal(correctText(literal).text, literal);
  const url = 'https://example.com/texnki?email=a@b.az';
  assert.ok(correctText(url).text.includes(url));
});
