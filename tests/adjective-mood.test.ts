import assert from 'node:assert/strict';
import test from 'node:test';
import { correctText } from '../lib/editor/correct';
import { detectExclamation, isAttributiveEla, punctuateCommas, terminalPunctuation } from '../lib/editor/punctuation';

for (const [input, expected] of [
  ['ela netice elde etmek ucun her gun mutemadi calismaq lazimdir', 'Əla nəticə əldə etmək üçün hər gün mütəmadi çalışmaq lazımdır.'],
  ['əla nəticə əldə etdik', 'Əla nəticə əldə etdik.'],
  ['əla layihə hazırdır', 'Əla layihə hazırdır.'],
  ['əla oldu', 'Əla oldu.'],
] as const) test('attributive əla does not add emotion or a comma: ' + input, () => {
  const result = correctText(input).text;
  assert.equal(result, expected);
  assert.equal(correctText(result).text, result);
});
test('explicit punctuation and genuine interjections retain their mood', () => {
  assert.equal(terminalPunctuation('Əla nəticə'), 'Əla nəticə.');
  assert.equal(isAttributiveEla('əla nəticə'), true);
  assert.equal(detectExclamation('əla nəticə'), false);
  assert.equal(punctuateCommas('Əla, nəticə hazırdır!'), 'Əla, nəticə hazırdır!');
  assert.equal(correctText('Əla nəticə!').text, 'Əla nəticə!');
  assert.equal(correctText('əla sən gəldin').text, 'Əla, sən gəldin!');
});
