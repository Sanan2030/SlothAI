import assert from 'node:assert/strict';
import test from 'node:test';
import { correctText, formatEmail } from '../lib/editor/correct';
import { productiveMorphology, artifactMorphology } from '../lib/editor/productive-morphology';
import { guardInsertedBoundaries } from '../lib/editor/syntax-boundary-guard';
import { observedSpelling, repairObservedSpacing } from '../lib/editor/observed-channel';
import { isMissingRepeatedConsonant } from '../lib/editor/neural/bounded-head';
import { reviewedDataset } from '../scripts/nlp/reviewed-data';
import { emptyReviewCorpus } from '../lib/editor/review-corpus';

for (const text of [
  'Şirkətimizin IT şöbəsi Scrum və Product Owner rollarını müzakirə edir.',
  'Məktəblərimizdəki müəllimlə görüşdüm.',
  'Sənədin adı dəyişdirildi. Adi mətn saxlanıldı.',
  'Mən ac idim, amma sən qapını aç.',
  'API response dəyişmədi. Backend hazırdır.',
  'Müştərinin ünvanladığı şikayət araşdırılmışdır.',
]) test('identity protection: ' + text, () => assert.equal(correctText(text).text, text));
for (const [input, expected] of [
  ['Məmnuniyətiniz bizim üçün vacibdir.', 'Məmnuniyyətiniz bizim üçün vacibdir.'],
  ['Əməliyatlarımız tamamlandı.', 'Əməliyyatlarımız tamamlandı.'],
  ['Bildrişlər göndərildi.', 'Bildirişlər göndərildi.'],
  ['Arxivdə sənədin vəziyəti yoxlanılır.', 'Arxivdə sənədin vəziyyəti yoxlanılır.'],
  ['sənədinstatusu yeniləndi', 'Sənədin statusu yeniləndi.'],
  ['layihəniyoxladıq', 'Layihəni yoxladıq.'],
  ['bir sıra jiddi dəyişikliklərin edilməsi nəzərdə tutulur', 'Bir sıra ciddi dəyişikliklərin edilməsi nəzərdə tutulur.'],
  ['necesen nece gedir', 'Necəsən? Necə gedir?'],
]) test('novel full-pipeline correction: ' + input, () => assert.equal(correctText(input).text, expected));
test('spacing candidates preserve legitimate words, particles and line breaks', () => {
  for (const text of ['məktəb kitab', 'sən də', 'getmirəm ki', 'kod\nblokları', 'API response', 'git commit', 'sənədin statusu', 'field ile']) assert.equal(repairObservedSpacing(text), text);
});
test('unknown space fragments join only into a verified inflection', () => {
  assert.equal(repairObservedSpacing('mək təblərimizdəki'), 'məktəblərimizdəki');
  assert.equal(repairObservedSpacing('müəll imlə'), 'müəllimlə');
});
test('inflection extension parses relative and comitative chains without changing frozen features', () => {
  assert.equal(productiveMorphology.findByFoldedForm('movzunun'), 'mövzunun');
  assert.equal(productiveMorphology.findByFoldedForm('mekteblerimizdeki'), 'məktəblərimizdəki');
  assert.equal(productiveMorphology.isValidWordForm('müəllimlə'), true);
  const rows = productiveMorphology.analyzeWord('məktəblərimizdəki');
  assert.ok(rows.some(row => row.lemma === 'məktəb' && row.features.possessivePerson === 1 && row.features.number === 'plural' && row.features.derivation?.includes('relative')));
  assert.equal(artifactMorphology.analyzeWord('məktəblərimizdəki').some(row => row.features.derivation?.includes('relative')), false);
  assert.equal(productiveMorphology.isValidWordForm('məktəblərimizdakı'), false);
});
test('one boundary veto governs proposals but keeps original punctuation and Unicode spans', () => {
  assert.equal(guardInsertedBoundaries('Bir sıra ciddi dəyişikliklərin edilməsi nəzərdə tutulur', 'Bir sıra ciddi. dəyişikliklərin edilməsi nəzərdə tutulur'), 'Bir sıra ciddi dəyişikliklərin edilməsi nəzərdə tutulur');
  assert.equal(guardInsertedBoundaries('Ciddi. Dəyişikliklər var.', 'Ciddi. Dəyişikliklər var.'), 'Ciddi. Dəyişikliklər var.');
  assert.equal(guardInsertedBoundaries('😀 ciddi dəyişikliklər var', '😀 ciddi. dəyişikliklər var'), '😀 ciddi dəyişikliklər var');
});
test('consonant head cannot insert passive voice or a possession suffix', () => {
  assert.equal(isMissingRepeatedConsonant('vəziyəti', 'vəziyyəti'), true);
  assert.equal(isMissingRepeatedConsonant('ünvanladığı', 'ünvanlandığı'), false);
  assert.equal(isMissingRepeatedConsonant('sənədin', 'sənədinin'), false);
});
test('real channel abstains on known and foreign surfaces', () => {
  for (const word of ['sənəd', 'sənət', 'məktəblərimizdəki', 'backend', 'commit', 'Əli', 'API', 'scrum', 'render']) assert.equal(observedSpelling(word), undefined);
});
test('both modes share lexical correction without overwriting the greeting', () => {
  const input = 'Arxivdə sənədin vəziyəti yoxlanılır.';
  assert.ok(formatEmail(input, { emailGreeting: 'Salam, hər vaxtınız xeyir.', omitSubject: true }).text.includes(correctText(input).text));
});
test('unformatted targets with accidental indentation are quarantined, not learned as gold', () => {
  const data = reviewedDataset(JSON.stringify({ ...emptyReviewCorpus(), cases: [{ id: 'bad-whitespace', module: 'text', input: 'sorgu gelib', actual: 'Sorğu gəlib.', expected: 'Sorğu      gəlib.\n     ', reviewedAt: '2026-10-05T00:00:00Z', reviewStatus: 'user-approved', preserveFormatting: false }] }), 'own review', 'user', 'private');
  assert.equal(data.manifest.review.accepted, 0);
  assert.match(data.manifest.review.rejected[0].reason, /whitespace/u);
});
