import assert from 'node:assert/strict';
import test from 'node:test';
import { punctuateCommas } from '../lib/editor/punctuation';
import { correctText, formatEmail } from '../lib/editor/correct';

const cases = [
  ['O çox çalışqandır.', 'O, çox çalışqandır.'],
  ['O yaxşı müəllimdir.', 'O, yaxşı müəllimdir.'],
  ['Bu vacibdir.', 'Bu, vacibdir.'],
  ['O müəllimdir.', 'O, müəllimdir.'],
  ['O ac idi.', 'O, ac idi.'],
  ['Mən bilirəm ki sən gələcəksən.', 'Mən bilirəm ki, sən gələcəksən.'],
  ['O bildirdi ki sənədlər hazırdır.', 'O bildirdi ki, sənədlər hazırdır.'],
  ['Rəhbər düşünürdü ki nəticə dəyişəcək.', 'Rəhbər düşünürdü ki, nəticə dəyişəcək.'],
  ['Bu əlbəttə vacibdir.', 'Bu, əlbəttə, vacibdir.'],
  ['Mən, şübhəsiz gələcəyəm.', 'Mən, şübhəsiz, gələcəyəm.'],
  ['Bizcə bu doğrudur.', 'Bizcə, bu, doğrudur.'],
  ['Bizcə bu vacibdir.', 'Bizcə, bu, vacibdir.'],
  ['O çox çalışqandır, amma bu vacibdir.', 'O, çox çalışqandır, amma bu, vacibdir.'],
  ['Nə olursa olsun, dayanma.', 'Nə olursa olsun, dayanma.'],
  ['O kitab oxuyur.', 'O kitab oxuyur.'],
  ['Bu kitab maraqlıdır.', 'Bu kitab maraqlıdır.'],
  ['O evə getdi.', 'O evə getdi.'],
  ['O da gələcək.', 'O da gələcək.'],
  ['O özü yazdı.', 'O özü yazdı.'],
  ['Bu gün hava yaxşıdır.', 'Bu gün hava yaxşıdır.'],
  ['O zaman gəldim.', 'O zaman gəldim.'],
  ['Elə ki hava açıldı, yola düşdük.', 'Elə ki hava açıldı, yola düşdük.'],
  ['Sən ki bunu bilirsən.', 'Sən ki bunu bilirsən.'],
  ['Gəl, ona görə ki işimiz var.', 'Gəl, ona görə ki işimiz var.'],
  ['Onun üçün ki, bunu bilirəm.', 'Onun üçün ki, bunu bilirəm.'],
  ['Bu, əlbəttə, vacibdir.', 'Bu, əlbəttə, vacibdir.'],
] as const;

for (const [input, expected] of cases) test(`grammatical comma: ${input}`, () => {
  assert.equal(punctuateCommas(input), expected);
  assert.equal(punctuateCommas(expected), expected, 'idempotent punctuation');
});

test('both strategies use the shared grammar stage with opaque spans intact', () => {
  const input = 'O bildirdi ki sənədlər hazırdır. Bu əlbəttə vacibdir.';
  const expected = 'O bildirdi ki, sənədlər hazırdır. Bu, əlbəttə, vacibdir.';
  assert.equal(correctText(input, true).text, expected);
  assert.ok(formatEmail(input, { omitSubject: true }).text.includes(expected));
  assert.equal(correctText('`O bildirdi ki sənədlər hazırdır`', true).text, '`O bildirdi ki sənədlər hazırdır`');
  assert.equal(correctText('<p>Bu əlbəttə vacibdir.</p>', true).text, '<p>Bu, əlbəttə, vacibdir.</p>');
});
