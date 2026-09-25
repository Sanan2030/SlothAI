import assert from 'node:assert/strict';
import test from 'node:test';
import { correctText, formatEmail } from '../lib/editor/correct';
import { namedEntities, resolveEntityWord } from '../lib/editor/entities/resolver';
import { caseSuffixes } from '../lib/editor/entities/morphology';

const examples = [
  ['naxcivan muxtar respublikasinda idim', 'Naxçıvan Muxtar Respublikasında idim.'],
  ['qara deniz haqqinda danisdiq', 'Qara dəniz haqqında danışdıq.'],
  ['baki seherine getdim', 'Bakı şəhərinə getdim.'],
  ['qebeleye gedirəm', 'Qəbələyə gedirəm.'],
  ['eli bey mene yazdi', 'Əli bəy mənə yazdı.'],
  ['20 yanvar barədə yaz', '20 Yanvar barədə yaz.'],
  ['bu gün səma buludludur', 'Bu gün səma buludludur.'],
  ['bağda fidan əkdik', 'Bağda fidan əkdik.'],
  ['bu mənə ilham verdi', 'Bu mənə ilham verdi.'],
  ['ilham mənbəyi təbiətdir', 'İlham mənbəyi təbiətdir.'],
  ['müzakirə sona çatdı', 'Müzakirə sona çatdı.'],
  ['sadiq dost tapmaq çətindir', 'Sadiq dost tapmaq çətindir.'],
  ['lalə bağda açdı', 'Lalə bağda açdı.'],
  ['mən ümid edirəm', 'Mən ümid edirəm.'],
  ['mən arzu edirəm', 'Mən arzu edirəm.'],
  ['dəniz sakitdir', 'Dəniz sakitdir.'],
  ['fidan xanım gəldi', 'Fidan xanım gəldi.'],
  ['naxcivn seherine getdim', 'Naxçıvan şəhərinə getdim.'],
  ['naixcivan seherine getdim', 'Naxçıvan şəhərinə getdim.'],
  ['naxcivann seherine getdim', 'Naxçıvan şəhərinə getdim.'],
  ['sumqaytdan gelirəm', 'Sumqayıtdan gəlirəm.'],
] as const;
for (const [input, expected] of examples) test(`typed entity/context: ${input}`, () => {
  assert.equal(correctText(input).text, expected);
  assert.equal(correctText(expected).text, expected);
});
test('typed inventory carries source and policies for every item', () => {
  assert.ok(namedEntities.length > 240);
  assert.equal(new Set(namedEntities.map(item => item.id)).size, namedEntities.length);
  for (const entity of namedEntities) assert.ok(entity.source && entity.capitalizationPolicy && entity.inflectionPolicy);
});
test('inflected place names normalize suffix harmony', () => {
  assert.deepEqual(resolveEntityWord('naxcivana'), 'Naxçıvana');
  assert.deepEqual(resolveEntityWord('sumqayitdan'), 'Sumqayıtdan');
  assert.ok(caseSuffixes('Qəbələ').includes('yə'));
});
test('email signature resolves name and surname using the same path', () => {
  assert.match(formatEmail('Mövzu: Görüş\nSalam,\nGörüşə gəlirəm.\nHörmətlə,\nəli əliyev').text, /Hörmətlə,\nƏli Əliyev$/u);
});
