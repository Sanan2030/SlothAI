import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { correctText } from '../lib/editor/correct';

const { input } = JSON.parse(readFileSync(new URL('./fixtures/workday.json', import.meta.url), 'utf8'));

test('reported workday repairs misspellings without losing technical details or numbers', () => {
  const result = correctText(input).text;
  for (const expected of ['Şükür ki, saatı eşitdim', 'gec yatmışdım.',
    'GNU Linux terminalını', 'Swagger-də olan OpenAPI spesifikasiyası',
    'integer yerinə string yazmışdılar.', 'Postman vasitəsilə test',
    'Slack kanalında', 'sprint planning iclasındayıq.', 'öz SRS sənədimi',
    'as is prosesini BPMN-də', 'İndi to be prosesini', 'bir-birinə bağlayırdım',
    'mikroservislər gRPC ilə', 'protobuf faylları', 'toyuq şnitsel',
    'story pointləri müəyyənləşdirirdik.', 'bu task neçə pointdir?',
    'Biri deyirdi: 3 point.', 'Biri deyirdi: 8 point.', 'taskını 5 point',
    'Hamı təlaşlı idi.', 'Çantanı küncə', 'bir assistentsən.',
    'Chess.com-da', 'YouTube-da emulyatorlar haqqında video izlədim.',
    'DOSBox və Lutris', 'Need for Speed', 'X11 ilə Wayland',
    'Sabahısı gün sprint planlaması başlayacaqdı.', 'Müxtəlif tapşırıqlar paylanacaqdı.',
    'Hamısını strukturlaşdırıb yerinə yetirmək', '“Gecəniz xeyrə” fısıldayıb']) {
    assert.ok(result.includes(expected), expected);
  }
  assert.doesNotMatch(result, /teşt|shukur|sinitzel|chantai|tapiriqlar|bashlayacaqdi|İnteger/u);
  assert.ok(result.endsWith('dərin yuxuya getdim.'));
  assert.equal(correctText(result).text, result);
});

test('workday has topic paragraphs and keeps optional original line structure', () => {
  const result = correctText(input).text;
  for (const topic of ['Günorta yeməyi', 'Günortadan sonra', 'Axşam saat',
    'Evə çatanda', 'Gecə saat', 'Sabaha olan planları']) {
    assert.ok(result.includes('\n\n' + topic), topic);
  }
  assert.equal(correctText(input, true).text.includes('\n'), false);
});

test('new vocabulary applies to independent sentences without corrupting valid words', () => {
  assert.equal(correctText('postman vasitesile test gonderdim').text,
    'Postman vasitəsilə test göndərdim.');
  assert.equal(correctText('Teşt su ilə doludur.').text, 'Teşt su ilə doludur.');
  assert.equal(correctText('sabahsisi gun muxtəlif tapiriqlar paylanacaqdi').text,
    'Sabahısı gün müxtəlif tapşırıqlar paylanacaqdı.');
  assert.equal(correctText('gnu linux terminalini acdim swaggerde endpointleri yoxladim').text,
    'GNU Linux terminalını açdım. Swagger-də endpointləri yoxladım.');
});

test('new punctuation preserves dependent clauses, literal types and protected code', () => {
  for (const sentence of ['Kofe hazırlamaq üçün mətbəxə getdim.',
    'Sən de görüm, nə oldu?', 'Mən gələndə müdir danışırdı.']) {
    assert.equal(correctText(sentence).text, sentence);
  }
  assert.equal(correctText('tipler qarisdirilmisdi integer yerine string yazmisdilar').text,
    'Tiplər qarışdırılmışdı. integer yerinə string yazmışdılar.');
  const code = '```ts\nconst test = "sabahsisi tapiriqlar integer";\n```';
  assert.equal(correctText(code).text, code);
  const link = 'https://example.com/sinitzel?q=tapiriqlar';
  assert.ok(correctText(link).text.includes(link));
  const collision = '\uE0000\uE001';
  assert.ok(correctText(collision + ' integer string').text.includes(collision));
});
