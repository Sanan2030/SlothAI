import assert from 'node:assert/strict';
import test from 'node:test';
import { correctText } from '../lib/editor/correct';
import { languageServices } from '../lib/editor/language-services';
import { analyzeSourceInflection, isEstablishedSurface } from '../lib/editor/lexicon';
import { SourceInflectionEngine } from '../lib/editor/source-inflection';

const repairs = [
  ['cavablandirdi', 'cavablandırdı'], ['menbeyini', 'mənbəyini'], ['refe', 'rəfə'], ['duzdu', 'düzdü'],
  ['sertlerini', 'şərtlərini'], ['uzvu', 'üzvü'], ['konullusu', 'könüllüsü'], ['Marsrutun', 'Marşrutun'],
  ['Marshrutun', 'Marşrutun'], ['alindighini', 'alındığını'], ['kecirdik', 'keçirdik'], ['toplantiya', 'toplantıya'],
  ['Hokumet', 'Hökumət'], ['mudirle', 'müdirlə'], ['Mekteblilere', 'Məktəblilərə'], ['toplashmishdi', 'toplaşmışdı'], ['hayata', 'həyata'],
] as const;
for (const [input, expected] of repairs) test('classified source lemma repair: ' + input, () => {
  assert.equal(languageServices.spelling.resolve(input, languageServices), expected);
  assert.equal(isEstablishedSurface(expected, languageServices), true);
  const text = `Mən «${input}» sözünü yazdım.`;
  const output = `Mən «${expected}» sözünü yazdım.`;
  assert.equal(correctText(text).text, output);
  assert.equal(correctText(output).text, output);
});
test('new source paradigms recover actual roots and do not invent POS from surfaces', () => {
  for (const [word, lemma] of [['mənbəyini', 'mənbə'], ['üzvü', 'üzv'], ['keçirdik', 'keçir'], ['məktəblilərə', 'məktəbli'], ['cavablandırdı', 'cavablandır']] as const)
    assert.ok(analyzeSourceInflection(word).some(row => row.lemma === lemma), word);
  assert.equal(analyzeSourceInflection('abıdə').length, 0);
});
test('noun homographs require sentence evidence and conflicting evidence abstains', () => {
  assert.equal(correctText('Katib senedin suretini gonderdi').text, 'Katib sənədin surətini göndərdi.');
  assert.equal(correctText('Biz sebekenin suretini olcduk').text, 'Biz şəbəkənin sürətini ölçdük.');
  const engine = new SourceInflectionEngine(() => false);
  assert.equal(engine.restore('suretini'), undefined);
  assert.equal(languageServices.spelling.resolve('suretini', languageServices), 'suretini');
  assert.equal(correctText('Biz netice elde etmek isteyirik').text, 'Biz nəticə əldə etmək istəyirik.');
  assert.equal(languageServices.spelling.resolve('elde', languageServices), 'elde');
});
test('unlisted inflections generalize beyond the reported words', () => {
  for (const [input, expected] of [['refden', 'rəfdən'], ['uzvler', 'üzvlər'], ['mudirlerden', 'müdirlərdən'],
    ['kechirdiniz', 'keçirdiniz'], ['toplashmishdim', 'toplaşmışdım'], ['marsrutlara', 'marşrutlara']] as const)
    assert.equal(languageServices.spelling.resolve(input, languageServices), expected, input);
});

test('whole lexical evidence beats unattested suffix guesses in noisy spellings', () => {
  assert.equal(correctText('Muzeyin emekdasi sergi haqqinda melumat hazirladi').text, 'Muzeyin əməkdaşı sərgi haqqında məlumat hazırladı.');
  assert.equal(correctText('Notarius qerarin suretini gonderdi').text, 'Notarius qərarın surətini göndərdi.');
});
