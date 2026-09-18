import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { correctText } from '../lib/editor/correct';

const { input } = JSON.parse(readFileSync(new URL('./fixtures/essay.json', import.meta.url), 'utf8'));

test('science and culture essay repairs reported spelling and inflection errors', () => {
  const output = correctText(input).text;
  for (const expected of ['texnologiyanın sürətli inkişafı', 'hər bir guşəsinə dərindən',
    'alqoritmləri, böyük məlumat bazaları', 'gündəlik qərarlarımıza istiqamət',
    'dənizçilərdən', 'dəyişikliyinin monitorinqi', 'iş prinsipini', 'saniyələr içində ötürülür.',
    'özünəməxsus', 'qışın səssizliyi', 'vaxtın mahiyyəti, varlığın mənası',
    'xoşbəxtliyin', 'şüurlu yaşamağın əsas şərtidir.', 'Psixoloji araşdırmalar',
    'dinclik', 'bəxş edir.', 'səmərəli istifadəsi', 'Klassik musiqinin incə notları,',
    'rəng ahəngi', 'güclü emosional reaksiya', 'ən dərin qatlarına',
    'şəhərləşmə', 'gurultu, nəqliyyat sıxlığı', 'vətəndaşların',
    'infrastrukturunun modernləşdirilməsi', 'səmərəliliyi artırılmalı,',
    'formalaşdıran iki əsas sütundur.', 'necə işlədiyini, öyrənmə mexanizmlərini',
    'Şagirdlərin', 'uyğunlaşmalıdırlar.', 'laboratoriyalarda', 'Genetik mühəndislik',
    'xəstəliklərin', 'inqilabi addımlar', 'Müntəzəm məşqlər, düzgün qidalanma',
    'məğlubiyyətlərdən', 'müvəffəqiyyətin', 'uzunömürlülüyün',
    'həqiqi bilikləri ötəri informasiyadan', 'enişli-yoxuşlu', 'insani dəyərlər, empatiya',
    'qaydalarına əməl edilməsi', 'Kibertəhlükəsizlik', 'şəxsi verilənlərin',
    'bir-birilə dərin bağlılığa', 'əldə edilən nailiyyətlər bəşəriyyəti',
    'yatan qorxular, arzular', 'Hər bir addım']) {
    assert.ok(output.includes(expected), expected);
  }
  assert.ok(output.endsWith('bir addım da yaxınlaşdırır.'));
});

test('essay retains all nine paragraphs and stays stable through repeated correction', () => {
  const output = correctText(input).text;
  assert.equal(output.split('\n\n').length, 9);
  assert.equal(correctText(output).text, output);
  assert.equal(correctText(output, true).text, output);
});

test('paired contrast keeps its sentence and does not accumulate commas', () => {
  const expected = 'İnsanlar bir tərəfdən işləyir, digər tərəfdən öyrənir.';
  assert.equal(correctText('insanlar bir tərəfdən işləyir digər tərəfdən öyrənir').text, expected);
  assert.equal(correctText(expected).text, expected);
  assert.equal(correctText('digər tərəfdən elm inkişaf edir').text, 'Digər tərəfdən, elm inkişaf edir.');
});

test('context repairs preserve valid alternate meanings and proper diacritics', () => {
  assert.equal(correctText('qaydalarina emal edilmesi vacibdir').text,
    'Qaydalarına əməl edilməsi vacibdir.');
  for (const sentence of ['Məlumat emal edilməsi üçün göndərildi.',
    'Burada oturulur.', 'Mən insanı gördüm. İnsani dəyərlər vacibdir.',
    'Təhlükəsizlik insanı qoruyur.', 'O, sərt insandır.']) {
    assert.equal(correctText(sentence).text, sentence);
  }
});

test('reviewed vocabulary and coordination work outside the supplied essay', () => {
  assert.equal(correctText('muntəzam məsqler duzgun qidalanma ve yuxu rejimi vacibdir').text,
    'Müntəzəm məşqlər, düzgün qidalanma və yuxu rejimi vacibdir.');
  assert.equal(correctText('insan filosoflari xosbaxtliyin sirləri haqqinda dusunmusler').text,
    'İnsan filosofları xoşbəxtliyin sirləri haqqında düşünmüşlər.');
  assert.equal(correctText('fiziki saqlamliq ehemiyyetlidir').text,
    'Fiziki sağlamlıq əhəmiyyətlidir.');
});

test('essay spelling and punctuation rules never rewrite protected source or links', () => {
  const code = '```txt\ntexnalogiyanin qaydalarina emal edilmesi\n```';
  assert.equal(correctText(code).text, code);
  const url = 'https://example.com/qusəsinə?x=texnalogiyanin';
  assert.ok(correctText(url).text.includes(url));
  assert.ok(correctText('2026-09-18 12:30 ' + url).text.includes('2026-09-18 12:30'));
});
