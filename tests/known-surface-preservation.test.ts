import test from 'node:test';
import assert from 'node:assert/strict';
import words from '../lib/editor/generated/az-words.json';
import { correctText } from '../lib/editor/correct';
import { dictionaryCandidates } from '../lib/editor/dictionary';
import { restoreWord, isEstablishedSurface } from '../lib/editor/lexicon';
import { languageServices } from '../lib/editor/language-services';

const sample = words.filter((word, index) => index % 31 === 0 && /^[a-zəçğıöşü]{3,28}$/u.test(word)
  && /[əçğıöşü]/u.test(word) && dictionaryCandidates(word)?.has(word)).slice(0, 600);
test('600 independently selected dictionary surfaces survive lexical repair', () => {
  assert.equal(sample.length, 600);
  for (const word of sample) {
    assert.equal(restoreWord(word, languageServices).toLocaleLowerCase('az-AZ'), word, word);
    assert.equal(isEstablishedSurface(word, languageServices), true, word);
  }
});
test('correct dictionary words remain intact inside 60 quoted prose sentences', () => {
  for (const word of sample.slice(0, 60)) {
    const input = `Mən «${word}» sözünü oxudum.`;
    assert.equal(correctText(input).text, input, word);
    assert.equal(correctText(input, false, { modelPolicy: 'always' }).text, input, word);
  }
});
test('exhibition surfaces remain correct in both model policies and on second pass', () => {
  for (const input of ['Sərgi bu gün açıldı.', 'Sərginin açılışı sabah olacaq.', 'Mən sərgi haqqında yazdım.']) {
    for (const modelPolicy of ['always', 'unresolved'] as const) assert.equal(correctText(input, false, { modelPolicy }).text, input);
    assert.equal(correctText(correctText(input).text).text, input);
  }
});
