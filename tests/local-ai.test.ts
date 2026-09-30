import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import corpus from '../data/local-ai/pairs.json';
import model from '../lib/editor/local-ai/model.json';
import { createLocalPredictor, insertLearnedBoundaries } from '../lib/editor/local-ai/predict';
import { trainBoundaryModel } from '../lib/editor/local-ai/boundary-model';
import { trainSequenceRanker } from '../lib/editor/local-ai/sequence';
import { trainContextModel } from '../lib/editor/local-ai/core';
import { expandContextModel } from '../lib/editor/local-ai/expand';
import expansion from '../data/local-ai/expansion.json';
import { correctText, formatEmail } from '../lib/editor/correct';
import { contextTrainingTexts } from '../scripts/context-training';

const cases = [
  ['seher belediyyesi parki ve binalari yoxlayir', 'şəhər'],
  ['seher zengli saatin sesine oyandim', 'səhər'],
  ['suret avtomobilin panelinde gosterilir', 'sürət'],
  ['suret arxivde senedin esli ile yoxlanilir', 'surət'],
] as const;

test('1000 pairs have disjoint train, validation and test gold groups and a reproducible training artifact', () => {
  assert.equal(corpus.pairs.length, 1000);
  assert.equal(new Set(corpus.pairs.map(pair => pair.input)).size, 1000);
  const train = corpus.pairs.filter(pair => pair.split === 'train');
  const heldOut = corpus.pairs.filter(pair => pair.split === 'test');
  assert.equal(train.length, 700);
  assert.equal(heldOut.length, 200);
  const validation = corpus.pairs.filter(pair => pair.split === 'validation');
  assert.equal(validation.length, 100);
  const validationGroups = new Set(validation.map(pair => pair.groupId));
  assert.ok(heldOut.every(pair => !validationGroups.has(pair.groupId)));
  const trainGroups = new Set(train.map(pair => pair.groupId));
  assert.ok(heldOut.every(pair => !trainGroups.has(pair.groupId)));
  assert.ok(validation.every(pair => !trainGroups.has(pair.groupId)));
  const targets = [...new Set(train.map(pair => pair.target))];
  assert.equal(targets.length, 140);
  const supplemental = readFileSync('data/local-ai/supplemental-training.txt', 'utf8').trim().split('\n');
  assert.ok(supplemental.every(text => !corpus.pairs.some(pair => pair.target === text)));
  const trainingTexts = [...targets, ...supplemental, ...contextTrainingTexts()];
  const rebuilt = expandContextModel(trainContextModel(trainingTexts), expansion);
  rebuilt.sequence = trainSequenceRanker(trainingTexts);
  rebuilt.boundaryClassifier = trainBoundaryModel([...trainingTexts, ...expansion.boundaries.flatMap(item => item.texts)]);
  assert.deepEqual(rebuilt, model);
});

test('learned context generalizes to fresh sentences without an exact text lookup', () => {
  for (const [input, expected] of cases) {
    assert.ok(!corpus.pairs.some(pair => pair.input === input));
    assert.equal(createLocalPredictor(input)(input.split(' ')[0], 0), expected);
  }
  assert.equal(createLocalPredictor('seher')('seher', 0), undefined);
  assert.equal(createLocalPredictor('səhər bələdiyyəsi parkı yoxlayır')('səhər', 0), undefined);
  assert.equal(createLocalPredictor('seher gecə nəqliyyat küçə')('seher', 0), undefined);
});

test('both editor modes use the model, while literal code and URLs remain protected', () => {
  const input = 'suret avtomobilin panelinde gosterilir';
  assert.ok(correctText(input).text.startsWith('Sürət '));
  assert.ok(formatEmail(input, { emailGreeting: 'Salam,', omitSubject: true }).text.includes('Sürət '));
  const protectedInput = '`suret avtomobilin panelinde` https://example.com/seher';
  const result = correctText(protectedInput).text;
  assert.ok(result.includes('`suret avtomobilin panelinde`'));
  assert.ok(result.includes('https://example.com/seher'));
});

test('new lexical groups use learned context and preserve valid alternative meanings', () => {
  for (const [input, raw, expected] of [
    ['el barmaqlari bilek derisi', 'el', 'əl'],
    ['et yemeyi metbexde qazanda bisir', 'et', 'ət'],
    ['uc kitab masaya qoyuldu', 'uc', 'üç'],
    ['usaqin adi qeydiyyat senedinde yazilib', 'adi', 'adı'],
    ['el birliyi xalqin gucunu artirir', 'el', 'el'],
  ]) assert.equal(createLocalPredictor(input)(raw, input.indexOf(raw)), expected);
  assert.equal(createLocalPredictor('seher. belediyye parki ve binalari yoxlayir')('seher', 0), undefined);
  assert.equal(createLocalPredictor('adi hadisə gündəlik iş zamanı')('adi', 0), 'adi');
  assert.equal(correctText('Adi hadisə gündəlik iş zamanı baş verdi.').text,
    'Adi hadisə gündəlik iş zamanı baş verdi.');
});

test('corpus-learned word forms require supporting context instead of a global replacement', () => {
  const input = 'Yeni olcen cihaz saniye erzinde netice verdi';
  assert.equal(createLocalPredictor(input)('saniye', input.indexOf('saniye')), 'saniyə');
  assert.equal(createLocalPredictor('saniye')('saniye', 0), undefined);
  assert.ok(correctText(input).text.includes('saniyə'));
  assert.ok(formatEmail(input, { emailGreeting: 'Salam,', omitSubject: true }).text.includes('saniyə'));
});

test('learned sentence boundaries preserve punctuation and dependent-clause guards', () => {
  const input = 'Bina yenidən rənglənir meydanın görünüşü dəyişir';
  assert.equal(insertLearnedBoundaries(input), 'Bina yenidən rənglənir. meydanın görünüşü dəyişir');
  const punctuated = 'Bina yenidən rənglənir. Meydanın görünüşü dəyişir.';
  assert.equal(insertLearnedBoundaries(punctuated), punctuated);
  const dependent = 'Dedi ki bina rənglənir meydanın görünüşü dəyişir';
  assert.equal(insertLearnedBoundaries(dependent), dependent);
});
