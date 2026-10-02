import assert from 'node:assert/strict';
import test from 'node:test';
import { correctText } from '../lib/editor/correct';
const correct = (text: string) => correctText(text, true).text;
test('headings, emphasis, table separators and escaped pipes retain structure', () => {
  const input = '# hesabat\r\n\r\n**netice** yaxsidir\r\n\r\n| sahə | dəyər |\r\n| :--- | ---: |\r\n| veziyyet | yaxsi |';
  const expected = '# Hesabat\r\n\r\n**Nəticə** yaxşıdır.\r\n\r\n| Sahə | Dəyər |\r\n| :--- | ---: |\r\n| Vəziyyət | Yaxşı |';
  assert.equal(correct(input), expected); assert.equal(correct(expected), expected);
  assert.equal(correct('| API | `a|b` |\n|---|---|\n| kod | a\\|b |').split('\n')[1], '|---|---|');
});
test('fences including unclosed and alternate markers preserve code byte-for-byte', () => {
  for (const input of ['```ts\nconst x = "salam"\n```', '~~~txt\nraw qelirem\n~~~', '```\nconst x = 1']) assert.equal(correct(input), input);
});
test('link destinations, attributes, list prefixes and task markers are immutable', () => {
  assert.equal(correct('[sened](https://example.com/a_(b)?id=7)'), '[Sənəd](https://example.com/a_(b)?id=7).');
  assert.equal(correct('1) sorgu gonderildi\n2) cavab hazirdir'), '1) Sorğu göndərildi.\n2) Cavab hazırdır.');
  assert.equal(correct('- [x] sorgu gonderildi'), '- [x] Sorğu göndərildi.');
  assert.ok(correct('<span data-id="salam?x=7">sorgu hazirdir</span>').includes('data-id="salam?x=7"'));
});

test('HTML block tags, quoted attributes, comments and executable/code content remain intact', () => {
  const input = '<div data-note="a > b"><p>sorgu hazirdir</p><table><tr><td>veziyyet</td><td>yaxsi</td></tr></table><!-- raw sorqu --><pre>const x = "salam";</pre></div>';
  const result = correct(input);
  assert.equal(result, '<div data-note="a > b"><p>Sorğu hazırdır.</p><table><tr><td>Vəziyyət</td><td>Yaxşı</td></tr></table><!-- raw sorqu --><pre>const x = "salam";</pre></div>');
  assert.equal(correct(result), result);
  assert.equal(correct('<script>if (a < b) alert("salam")</script>'), '<script>if (a < b) alert("salam")</script>');
  assert.equal(correct('<div><p>salam</div>'), '<div><p>salam</div>');
});
