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
