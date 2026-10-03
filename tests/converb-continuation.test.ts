import assert from 'node:assert/strict';
import test from 'node:test';
import { correctText, formatEmail } from '../lib/editor/correct';
import { segmentIndependentClauses } from '../lib/editor/segmentation';
import { segmentCorrespondence } from '../lib/editor/correspondence-boundaries';
import { insertLearnedBoundaries } from '../lib/editor/local-ai/predict';

test('degree phrases after converbs retain the following predicate in the same clause', () => {
  const examples = [
    'Dostuma zəng edib bir az gözləməsini xahiş etdim.',
    'Kitabı oxuyub bir qədər dincəldim.',
    'Sənədi yoxlayıb daha çox məlumat topladıq.',
  ];
  for (const input of examples) {
    assert.equal(segmentIndependentClauses(input), input);
    assert.equal(segmentCorrespondence(input), input);
    assert.equal(insertLearnedBoundaries(input), input);
    assert.equal(correctText(input).text, input);
    assert.ok(formatEmail(input, { omitSubject: true }).text.includes(input));
  }
});

test('an evidential completed report still separates an independent following subject', () => {
  assert.equal(correctText('Sənəd yoxlanılıb yeni versiya hazırdır.').text,
    'Sənəd yoxlanılıb. Yeni versiya hazırdır.');
  const punctuated = 'Kitabı oxuyub. Bir az dincəldim.';
  assert.equal(correctText(punctuated).text, punctuated);
});
