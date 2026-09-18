import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { correctText } from '../lib/editor/correct';

test('second uploaded narrative preserves facts and repairs reviewed spellings', () => {
  const { input } = JSON.parse(readFileSync(new URL('./fixtures/technical-day-extended.json', import.meta.url), 'utf8'));
  const result = correctText(input).text;
  for (const phrase of ['bir neçə', 'ödənişi edib', 'nə isə', 'FastAPI', 'DevOps',
    'Docker', 'NVMe SSD', 'Swagger', 'OpenAPI', 'DBML', 'ER diaqram',
    'PostgreSQL', 'Redis', 'BPMN', 'Lucidchart', 'gRPC', 'REST',
    'as is və to be', '3d model', '5 pointdir', '13 pointdir', 'Anası zəng',
    'dörd yüz kalori', 'dərin yuxuya getdim.']) {
    assert.ok(result.toLocaleLowerCase('az').includes(phrase.toLocaleLowerCase('az')), phrase);
  }
  assert.doesNotMatch(result, /nə işə|bir necə|ödənişi ədib|as iş|, ancaq eyni/iu);
  for (const transition of ['Nə isə günorta', 'Axşam saat beşdə', 'İdmandan çıxıb', 'Gecə saat ikiyə']) {
    assert.ok(result.includes('\n\n' + transition), transition);
  }
  assert.ok(result.startsWith('Salam, bu gün səhər saat yeddi yarıda'));
  assert.equal(correctText(result).text, result);
  assert.equal(correctText(input, true).text.includes('\n'), false);
});

test('ambiguous words use narrow context without corrupting correct forms', () => {
  assert.equal(correctText('ne ise bir nece usaq odenisi edib cixdi').text,
    'Nə isə bir neçə uşaq ödənişi edib çıxdı.');
  assert.equal(correctText('Ədib kitab yazdı. Sən de görüm, nə oldu?').text,
    'Ədib kitab yazdı. Sən de görüm, nə oldu?');
  assert.equal(correctText('ər və arvad').text, 'Ər və arvad.');
  assert.equal(correctText('er diagram gosterdim').text, 'ER diaqram göstərdim.');
  assert.equal(correctText('hamı ise gedir sonra ise getmek lazimdir').text,
    'Hamı işə gedir. Sonra işə getmək lazımdır.');
});

test('ancaq keeps adverb meaning and conjunction punctuation', () => {
  assert.equal(correctText('radioda ancaq eyni mahnilar oxuyurdu').text,
    'Radioda ancaq eyni mahnılar oxuyurdu.');
  assert.equal(correctText('mən gəldim ancaq sən getdin').text,
    'Mən gəldim, ancaq sən getdin.');
});

test('business process phrases, source code and URLs survive lexical correction', () => {
  const input = 'as is ve to be proseslerini muqayise etmek lazimdir';
  assert.equal(correctText(input).text, 'as is və to be proseslərini müqayisə etmək lazımdır.');
  for (const code of ['`ne ise bir nece er diagram`', '```txt\nas is ve to be\n```']) {
    assert.equal(correctText(code).text, code);
  }
  const url = 'https://example.com/er/diagram?q=ise';
  assert.ok(correctText(url).text.includes(url));
});
