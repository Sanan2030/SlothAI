import assert from 'node:assert/strict';
import test from 'node:test';

import type { LemmaDictionary, LemmaRecord } from '../lib/editor/contracts/lemma';
import type {
  MorphologicalAnalysis,
  MorphologyEngine,
} from '../lib/editor/contracts/morphology';
import { lemmaDictionary, morphologyEngine } from '../lib/editor/language-services';
import { correctText } from '../lib/editor/correct';

function acceptsLemmaDictionary(service: LemmaDictionary): LemmaDictionary {
  return service;
}

function acceptsMorphologyEngine(service: MorphologyEngine): MorphologyEngine {
  return service;
}

test('language service facade satisfies stable lemma and morphology contracts', () => {
  assert.equal(acceptsLemmaDictionary(lemmaDictionary), lemmaDictionary);
  assert.equal(acceptsMorphologyEngine(morphologyEngine), morphologyEngine);

  assert.equal(typeof lemmaDictionary.getByLemma, 'function');
  assert.equal(typeof lemmaDictionary.findByFoldedForm, 'function');
  assert.equal(typeof lemmaDictionary.hasSurfaceForm, 'function');

  assert.equal(typeof morphologyEngine.analyzeWord, 'function');
  assert.equal(typeof morphologyEngine.generateForms, 'function');
  assert.equal(typeof morphologyEngine.isValidWordForm, 'function');
  assert.equal(typeof morphologyEngine.stripSuffixes, 'function');
});

test('legacy lemma adapter exposes exact and folded dictionary lookups', () => {
  const exact = lemmaDictionary.getByLemma('məsuliyyət');
  assert.ok(exact);
  assert.equal(exact.lemma, 'məsuliyyət');
  assert.equal(exact.source, 'dictionary');

  const folded = lemmaDictionary.findByFoldedForm('mesuliyyet');
  assert.equal(folded.normalized, 'mesuliyyet');
  assert.ok(folded.entries.some((entry: LemmaRecord) => entry.lemma === 'məsuliyyət'));

  assert.equal(lemmaDictionary.hasSurfaceForm('məsuliyyət'), true);
  assert.equal(lemmaDictionary.hasSurfaceForm('mesuliyyet'), false);
});

test('productive morphology recovers lemmas and bounded inflections', () => {
  assert.equal(morphologyEngine.isValidWordForm('məktəblər'), true);
  assert.equal(morphologyEngine.isValidWordForm('tamamiləuydurmasöz'), false);

  const analyses = morphologyEngine.analyzeWord('məktəblər');
  assert.equal(analyses.length, 1);
  assert.deepEqual(analyses[0], {
    surface: 'məktəblər',
    lemma: 'məktəb',
    pos: 'noun',
    features: { number: 'plural', case: 'nominative' },
    source: 'rule',
  } satisfies MorphologicalAnalysis);

  assert.deepEqual(
    morphologyEngine.stripSuffixes('məktəblər'),
    [{ stem: 'məktəb', removedSuffixes: ['lər'] }],
  );
  assert.ok(morphologyEngine.analyzeWord('layihələrimizdən').some(record =>
    record.lemma === 'layihə' && record.features.possessivePerson === 1 && record.features.case === 'ablative'));
  assert.ok(morphologyEngine.analyzeWord('otağa').some(record => record.lemma === 'otaq' && record.features.case === 'dative'));
  assert.ok(morphologyEngine.generateForms({ lemma: 'layihə', pos: 'noun',
    features: { case: 'ablative' } }).includes('layihələrimizdən'));
  assert.ok(morphologyEngine.analyzeWord('gəlirəm').some(record => record.lemma === 'gəl' && record.features.tense === 'present'));
  assert.ok(morphologyEngine.analyzeWord('gələcəyəm').some(record => record.lemma === 'gəl' && record.features.tense === 'future'));
  assert.ok(morphologyEngine.analyzeWord('gəlmir').some(record => record.lemma === 'gəl' && record.features.polarity === 'negative'));
  assert.ok(morphologyEngine.analyzeWord('yazılır').some(record => record.lemma === 'yaz' && record.features.derivation?.includes('passive')));
  assert.ok(morphologyEngine.generateForms({ lemma: 'gəl', pos: 'verb', limit: 4 }).length <= 4);
});

test('new language-service contracts do not change the current correction result', () => {
  assert.equal(
    correctText('mesuliyyet cox vacibdir').text,
    'Məsuliyyət çox vacibdir.',
  );
});
