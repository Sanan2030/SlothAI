import assert from 'node:assert/strict';
import test from 'node:test';
import { correctText } from '../lib/editor/correct';
import { languageServices } from '../lib/editor/language-services';

for (const [input, expected] of [['Idman', 'İdman'], ['Icra', 'İcra'], ['Insan', 'İnsan'], ['Idmanci', 'İdmançı'], ['Istanbul', 'İstanbul']] as const) {
  test('ASCII title-case I uses its verified native lemma: ' + input, () => {
    assert.equal(languageServices.spelling.resolve(input, languageServices), expected);
    const result = correctText(`${input} haqqında məlumat verildi.`).text;
    assert.equal(result, `${expected} haqqında məlumat verildi.`);
    assert.equal(correctText(result).text, result);
  });
}
test('explicit dotless I, dotted İ, acronyms and protected spans are stable', () => {
  for (const word of ['Işıq', 'İnsan', 'IT', 'API', 'Integer', 'Image'])
    assert.equal(languageServices.spelling.resolve(word, languageServices), word);
  const source = 'İnsan IT və API haqqında https://example.com/Idman ünvanına yazdı.';
  assert.equal(correctText(source).text, source);
});
