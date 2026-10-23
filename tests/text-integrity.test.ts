import assert from 'node:assert/strict';
import test from 'node:test';
import { correctText, formatEmail } from '../lib/editor/correct';
import { applyPersonalLexicon } from '../lib/editor/personal-lexicon';
import { applyProposal } from '../lib/editor/inference-cache';

for (const literal of ['`10:30 da`', '`2.3.4 da`', '`Şəhidlər xiyabanında gul qoyduq`', '``10:30 da ` x``', '`10:30 da',
  '`[sened](https://example.az/a)`', '```txt\nSalam,\nHörmətlə,\nSənan\n```',
  'www.example.az/faq?q=niye#seher', 'https://example.az/10:30?value=2.3.4', 'example.az/yeni?sehife=iki',
  '```ts\nconst x = "10:30 da";\n```', '~~~txt\n2.3.4 da\n~~~']) {
  test('literal survives the entire engine and second pass: ' + literal, () => {
    const input = `Sənəd hazırdır.\n${literal}\nSənəd göndərildi.`;
    for (const options of [{}, { wordLMMode: 'experimental' as const }]) {
      const result = correctText(input, true, options).text;
      assert.ok(result.includes(literal), result);
      assert.ok(correctText(result, true, options).text.includes(literal));
      assert.ok(formatEmail(input, { omitSubject: true }, options).text.includes(literal));
    }
  });
}

test('numeric suffixes in prose still work while code stays exact', () => {
  const result = correctText('Saat 10:30 da görüş var. `10:30 da`', true).text;
  assert.ok(result.includes('10:30-da'));
  assert.ok(result.includes('`10:30 da`'));
});

test('URLs inside links and HTML attributes never create nested placeholders', () => {
  for (const input of ['[sened](https://example.az/a?seher=iki)', '<p data-url="https://example.az/a?q=iki">sened hazirdir</p>']) {
    const result = correctText(input, true).text;
    assert.ok(result.includes('https://example.az/a?'));
    assert.ok(!/[\uE000\uE001]/u.test(result));
  }
});

test('personal rules and worker proposals also preserve www URL paths', () => {
  const input = 'www.example.az/bu-seher-gozeldir';
  assert.equal(applyPersonalLexicon(input, [{ source: 'seher', target: 'səhər', left: 'bu', right: 'gozeldir' }]), input);
  const start = input.indexOf('seher');
  assert.equal(applyProposal({ revision: 1, stage: 'log-spelling', input, output: input.replace('seher', 'səhər'),
    edits: [{ start, end: start + 5, replacement: 'səhər' }] }, 1, () => true), undefined);
});
