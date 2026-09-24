import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server';
import { correctText, formatEmail } from '../lib/editor/correct';
import { getStrategyRegistry } from '../lib/strategies/bootstrap';
import { POST } from '../app/api/transform/route';
import { GET } from '../app/api/strategies/route';

test('corrects the reported sentence without AI', () => {
  assert.equal(correctText('salam necesen mende yaxsiyam amma bu aralar pisem').text,
    'Salam, necəsən? Mən də yaxşıyam, amma bu aralar pisəm.');
});
test('restores known words and preserves ambiguous words', () => {
  assert.equal(correctText('dusunmek qelirem sira yag gul').text, 'Düşünmək gəlirəm sira yag gul.');
  assert.equal(correctText('kitab məndədir').text, 'Kitab məndədir.');
  assert.equal(correctText('məndə kitab var').text, 'Məndə kitab var.');
  assert.equal(correctText('Zyphoria ucun').text, 'Zyphoria üçün.');
});
test('preserves URLs, emails, numbers, code, identifiers and acronyms', () => {
  const values = ['https://example.com/dusunmek?a=1', 'sanan@example.com', '12.50', '16.09.2026', '14:30', '`const x = "salam";`', 'user_id', 'API'];
  const result = correctText(values.join(' ')).text;
  values.forEach(value => assert.ok(result.includes(value), value));
  const block = '```js\nconst metn = "salam";\n```';
  assert.equal(correctText(block).text, block);
});
test('preserves paragraphs and detects explicit enumeration markers', () => {
  assert.equal(correctText('salam\n\nsabah qelirem').text, 'Salam.\n\nSabah gəlirəm.');
  assert.equal(correctText('plan: 1) metni yaz 2) sehvleri duzelt').text,
    'Plan:\n1. Mətni yaz.\n2. Səhvləri düzəlt.');
  assert.equal(correctText('birinci sinif ikinci mertebe').text.includes('\n1.'), false);
  assert.equal(correctText('1) metn 2) sehv', true).text.includes('\n'), false);
});
test('existing punctuation and email structure remain stable on repeated processing', () => {
  for (const source of ['Salam, necəsən? Mən də yaxşıyam.', 'https://example.com/test.', 'Mövzu: Müraciət\n\nSalam,\n\nSabah gəlirəm.\n\nHörmətlə,', '1. Mətni yaz.\n2. Səhvləri düzəlt.']) {
    const once = correctText(source).text;
    assert.equal(correctText(once).text, once);
  }
  const email = formatEmail('salam sabah goruse qelirem').text;
  assert.match(email, /^Mövzu: Müraciət\n\nSalam,\n\nSabah görüşə gəlirəm\.\n\nHörmətlə,$/);
  assert.equal(formatEmail(email).text, email);
});
test('rejects blank and oversized inputs, processes the full allowed length', () => {
  assert.throws(() => correctText(' \n '));
  assert.throws(() => correctText('a'.repeat(10001)));
  assert.equal(correctText('a'.repeat(10000)).text.length, 10001);
});
test('both strategies and HTTP routes work with every network request forbidden', async () => {
  const fetch = globalThis.fetch;
  const provider = process.env.LLM_PROVIDER;
  globalThis.fetch = async () => { throw new Error('Network must never be called'); };
  process.env.LLM_PROVIDER = 'unsupported-value-must-be-ignored';
  try {
    assert.equal((await GET()).status, 200);
    for (const strategy of getStrategyRegistry().listStrategies()) {
      const direct = await getStrategyRegistry().get(strategy.id).transform({ text: 'salam necesen' });
      assert.equal(direct.metadata.engine, 'local-rules');
      const result = await POST(new NextRequest('http://localhost/api/transform', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategyId: strategy.id, text: 'salam necesen' }),
      }));
      assert.equal(result.status, 200);
      assert.equal((await result.json()).transformedText, direct.transformedText);
    }
    const invalid = await POST(new NextRequest('http://localhost/api/transform', { method: 'POST', body: '{}' }));
    assert.equal(invalid.status, 400);
  } finally {
    globalThis.fetch = fetch;
    if (provider === undefined) delete process.env.LLM_PROVIDER;
    else process.env.LLM_PROVIDER = provider;
  }
});

test('reviewed inflections are restored without replacing unknown names', () => {
  assert.equal(correctText('mekteblerden muellimlere musterilerin senedleri').text,
    'Məktəblərdən müəllimlərə müştərilərin sənədləri.');
  // Two finite clauses with different subjects need a sentence boundary.
  assert.equal(correctText('biz dusunuruk siz isleyirsiniz').text, 'Biz düşünürük. Siz işləyirsiniz.');
  assert.equal(correctText('Zyphoria ucun').text, 'Zyphoria üçün.');
});

test('phrase rules, clause boundaries and punctuation work together', () => {
  const examples = [
    ['biz gedirem sen gelirem', 'Biz gedirik. Sən gəlirsən.'],
    ['zehmet olmasa senedleri gonderin tesekur edirem', 'Zəhmət olmasa, sənədləri göndərin. Təşəkkür edirəm.'],
    ['men dusunurem ki bu yaxsidir', 'Mən düşünürəm ki, bu yaxşıdır.'],
    ['salam,,, necesen???', 'Salam, necəsən?'],
    ['niye proqram islemir', 'Niyə proqram işləmir?'],
    ['hers ey', 'Hers ey.'],
    ['hecne birsey sagol', 'Heç nə bir şey sağ ol.'],
  ];
  for (const [input, expected] of examples) {
    const actual = correctText(input).text;
    assert.equal(actual, expected, input);
    assert.equal(correctText(actual).text, actual, 'Repeated correction: ' + input);
  }
});

test('formatting honors explicit lists and preserves requested paragraph layout', () => {
  assert.equal(correctText('plan 1. metni yaz 2. sehvleri duzelt').text,
    'Plan:\n1. Mətni yaz.\n2. Səhvləri düzəlt.');
  const source = 'men gedirem sabah qelirem bundan elave senedleri gonderirem';
  assert.equal(correctText(source).text, 'Mən gedirəm. Sabah gəlirəm.\n\nBundan əlavə sənədləri göndərirəm.');
  assert.equal(correctText(source, true).text.includes('\n'), false);
});

test('model-free editor preserves protected spans and dependent clauses', () => {
  const source = 'prof. Eli www.example.com user_id 12.50 14:30';
  const corrected = correctText(source).text;
  for (const protectedPart of ['prof.', 'www.example.com', 'user_id', '12.50', '14:30']) {
    assert.ok(corrected.includes(protectedPart));
  }
  assert.equal(correctText('mən gələndə sən gedirsən').text, 'Mən gələndə sən gedirsən.');
  assert.equal(correctText('məndə kitab var').text, 'Məndə kitab var.');
});
