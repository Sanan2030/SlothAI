import assert from 'node:assert/strict';
import { test } from 'node:test';
import { correctText } from '../lib/editor/correct';

test('context protects morning, brain and reviewed narrative spellings', () => {
  const source = 'seherler yungul qacis etmek urek damar sistemini guclendirir beynin funksiyalarini yaxsilasdirmaq ucun kitab oxumaq faydalidir pencereni acanda bir stakan purrengi cay sifaris etdim';
  const output = correctText(source).text;

  assert.match(output, /Səhərlər yüngül qaçış etmək/u);
  assert.match(output, /beynin funksiyalarını/u);
  assert.match(output, /pəncərəni açanda/u);
  assert.match(output, /pürrəngi çay/u);
  assert.doesNotMatch(output, /Şəhərlər yüngül qaçış|bəynin/u);
});
