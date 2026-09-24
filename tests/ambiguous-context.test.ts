import assert from 'node:assert/strict';
import { test } from 'node:test';
import { correctText } from '../lib/editor/correct';

test('context protects morning, brain and reviewed narrative spellings', () => {
  const source = 'seherler yungul qacis etmek urek damar sistemini guclendirir beynin funksiyalarini yaxsilasdirmaq ucun kitab oxumaq faydalidir pencereni acanda bir stakan purrengi cay sifaris etdim seher havasi temizdir seher yemeyi hazirdir seherin sakitliyini izledim seherin oyanisini gordum her xidmet api vasitesile elaqe qurur meseler planetimizin agciyerleridir biyo kutlenin artmasi vacibdir';
  const output = correctText(source).text;

  assert.match(output, /Səhərlər yüngül qaçış etmək/u);
  assert.match(output, /beynin funksiyalarını/u);
  assert.match(output, /pəncərəni açanda/u);
  assert.match(output, /pürrəngi çay/u);
  assert.match(output, /səhər havası/u);
  assert.match(output, /səhər yeməyi/u);
  assert.match(output, /səhərin sakitliyini/u);
  assert.match(output, /səhərin oyanışını/u);
  assert.match(output, /API vasitəsilə əlaqə qurur/u);
  // The independent clause now starts a new sentence and takes a capital M.
  assert.match(output, /Meşələr planetimizin ağciyərləridir/u);
  assert.match(output, /biokütlənin artması/u);
  assert.doesNotMatch(output, /Şəhərlər yüngül qaçış|bəynin|əlaqə qürur/u);
});
