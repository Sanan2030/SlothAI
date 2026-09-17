import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { correctText } from '../lib/editor/correct';

test('uploaded narrative restores vocabulary, technical names and paragraphs', () => {
  const { input } = JSON.parse(readFileSync(new URL('./fixtures/technical-day.json', import.meta.url), 'utf8'));
  const result = correctText(input).text;
  for (const phrase of ['səhər saat səkkizdə oyandım.', 'çünki işdə vacib görüş',
    'Hamı bir-birini itələyirdi.', 'Layihə təhvil verilməlidir.',
    'Ubuntu sistemində terminalı açıb loglara baxdım.', 'FastAPI servisini yenidən başlatdım.',
    'SRS sənədini hazırlayırdım.', 'Nike Air Max və Jordan Stadium',
    'Çörək, süd aldım.', 'PDF CV məlumatlarını JSON formatına',
    'Pydantic validator', 'zəng elədi. Chess.com-da şahmat oynadıq.', 'Story pointləri təyin etmək']) {
    assert.ok(result.includes(phrase), phrase);
  }
  assert.ok(result.split('\n\n').length >= 6);
  assert.equal(correctText(result).text, result);
  assert.equal(correctText(input, true).text.includes('\n'), false);
  for (const fact of ['dörd yüz kalori', 'doqquz', 'yarım saat', 'birinci', 'ikincidə']) assert.ok(result.toLocaleLowerCase('az').includes(fact));
});

test('narrative rules generalize to independent, reordered sentences', () => {
  assert.equal(correctText('axsam eve qayitdim sonra ubuntu sisteminde terminali acdim').text,
    'Axşam evə qayıtdım. Sonra Ubuntu sistemində terminalı açdım.');
  assert.equal(correctText('fastpiai servisini baslatdim sonra loglara baxdim').text,
    'FastAPI servisini başlatdım. Sonra loglara baxdım.');
  assert.equal(correctText('seher saat alti oyandim').text, 'Səhər saat altı oyandım.');
  assert.equal(correctText('şəhər çox gözəldir').text, 'Şəhər çox gözəldir.');
});

test('technical strings and dependent clauses are not rewritten as prose', () => {
  const code = '`fastpiai ashagi ubuuntu`';
  assert.equal(correctText(code).text, code);
  const url = 'https://example.com/ubuuntu?x=fastpiai';
  assert.ok(correctText(url).text.includes(url));
  assert.equal(correctText('mən gəldim amma sən getdin').text, 'Mən gəldim, amma sən getdin.');
  assert.equal(correctText('mən gələndə müdir danışırdı').text, 'Mən gələndə müdir danışırdı.');
});
