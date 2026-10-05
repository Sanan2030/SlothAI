import assert from 'node:assert/strict';
import test from 'node:test';
import { correctText, formatEmail } from '../lib/editor/correct';
import { segmentCorrespondence } from '../lib/editor/correspondence-boundaries';
test('spelling restoration preserves a future participial noun phrase', () => {
  assert.equal(correctText('Məhkəməyə təqdim ediləcək sənədin surəti əvvəlcədən təsdiqlənməlidr.').text,
    'Məhkəməyə təqdim ediləcək sənədin surəti əvvəlcədən təsdiqlənməlidir.');
  for (const text of ['Sabah hazırlanacaq müqavilənin şərtləri müzakirə olunmalıdır.', 'İclasda veriləcək qərarın nəticəsi bildirilməlidir.']) assert.equal(segmentCorrespondence(text), text);
});
test('separate finite clauses still split and explicit punctuation survives', () => {
  assert.equal(segmentCorrespondence('Sorğu tamamlandı sənədin surəti göndərilməlidir'), 'Sorğu tamamlandı. sənədin surəti göndərilməlidir');
  assert.equal(segmentCorrespondence('İki şöbənin rəyi eyni vaxtda toplanacaq qərarı sonra verəcəyik.'), 'İki şöbənin rəyi eyni vaxtda toplanacaq. qərarı sonra verəcəyik.');
  assert.equal(segmentCorrespondence('Komanda gələcək. Sənədi hazırlayın.'), 'Komanda gələcək. Sənədi hazırlayın.');
});
test('domain spelling preserves email meaning across repeated formatting', () => {
  const text = 'Hörmətli tərəfdaş,\n\nŞirkətinizin ünvanladığı şikayət araşdırılmışdır.\n\nHörmətlə,\nKomanda';
  assert.doesNotMatch(formatEmail(formatEmail(text).text).text, /ünvanlandığı/u);
});
