import assert from 'node:assert/strict';
import test from 'node:test';
import { correctText } from '../lib/editor/correct';
import { analyzeSourceInflection } from '../lib/editor/lexicon';
import { languageServices } from '../lib/editor/language-services';

const cases = [
  ['caylarin suyu yazda artir', 'Çayların suyu yazda artır.'],
  ['çayların suyu yazda artır', 'Çayların suyu yazda artır.'],
  ['alqoritm boyuk siyahini suretle cesidledi', 'Alqoritm böyük siyahını sürətlə çeşidlədi.'],
  ['sagird suyun temperaturunu qeyd etdi', 'Şagird suyun temperaturunu qeyd etdi.'],
  ['şagird suyun temperaturunu qeyd etdi', 'Şagird suyun temperaturunu qeyd etdi.'],
] as const;
for (const [input, expected] of cases) test('CI morphology regression: ' + input, () => {
  assert.equal(correctText(input).text, expected);
  assert.equal(correctText(expected).text, expected);
});

test('singular water buffer class preserves the whole inflection paradigm', () => {
  for (const word of ['suyum', 'suyun', 'suyu', 'suya', 'suyuna', 'suyunu', 'suyunda', 'suyundan', 'sular', 'suların', 'suları']) {
    assert.ok(analyzeSourceInflection(word).some(row => row.lemma === 'su'), word);
    assert.equal(languageServices.spelling.resolve(word, languageServices), word, word);
  }
  // The exception must not produce *sum/*susu or affect ordinary vowel-final nouns.
  for (const word of ['sum', 'susu']) assert.equal(analyzeSourceInflection(word).some(row => row.lemma === 'su'), false);
  for (const word of ['şöbəsi', 'otağı', 'üzvü']) assert.ok(analyzeSourceInflection(word).length > 0, word);
});

test('unique whole surface evidence does not force ambiguous speed/copy inflections', () => {
  assert.equal(languageServices.spelling.resolve('suretle', languageServices), 'sürətlə');
  assert.equal(languageServices.spelling.resolve('suretini', languageServices), 'suretini');
  assert.equal(correctText('Katib senedin suretini gonderdi').text, 'Katib sənədin surətini göndərdi.');
  assert.equal(correctText('Biz sebekenin suretini olcduk').text, 'Biz şəbəkənin sürətini ölçdük.');
  assert.equal(correctText('bezi heyvanlar qisda yuxuya gedir').text, 'Bəzi heyvanlar qışda yuxuya gedir.');
});
