import assert from 'node:assert/strict';
import test from 'node:test';
import expansion from '../data/local-ai/expansion.json';
import model from '../lib/editor/local-ai/model.json';
import { fold, tokenize, type LocalContextModel } from '../lib/editor/local-ai/core';
import { createLocalPredictor, insertLearnedBoundaries } from '../lib/editor/local-ai/predict';

const training = new Set([...expansion.forms, ...expansion.boundaries].flatMap(item => item.texts));
const probes = {
  nominative: 'Görüş zamanı {w} hamımızın diqqətimizi cəlb etdi',
  genitive: 'Araşdırma zamanı {w} yeni təsviri diqqətlə təhlil edildi',
  dative: 'Ekspertlər dünən {w} xüsusi diqqət yetirdilər',
  accusative: 'Mütəxəssislər indicə {w} diqqətlə nəzərdən keçirdilər',
  locative: 'Yoxlama zamanı {w} müəyyən dəyişiklik müşahidə olundu',
  ablative: 'Məruzəçilər axşam {w} ətraflı bəhs etdilər',
};

test('all 900 new learned forms work in new surrounding sentences and abstain without context', () => {
  assert.equal(expansion.forms.length, 900);
  assert.equal(new Set(expansion.forms.map(item => fold(item.word))).size, 900);
  for (const item of expansion.forms) {
    assert.equal((model as LocalContextModel).forms[fold(item.word)].word, item.word);
    const text = probes[item.grammaticalCase as keyof typeof probes].replace('{w}', fold(item.word));
    assert.ok(!training.has(text));
    const token = tokenize(text).find(token => token.word === fold(item.word))!;
    assert.equal(createLocalPredictor(text)(token.word, token.start), item.word, text);
    assert.equal(createLocalPredictor(fold(item.word))(fold(item.word), 0), undefined);
  }
});

test('100 learned boundaries generalize to unseen full clauses, preserve punctuation and reject incomplete clauses', () => {
  assert.equal(expansion.boundaries.length, 100);
  for (const item of expansion.boundaries) {
    const right = item.right[0].toLocaleLowerCase('az-AZ') + item.right.slice(1);
    const input = `Sınaq bitəndən sonra ${item.left} ${right} hər gün`;
    assert.ok(!training.has(input));
    assert.equal(insertLearnedBoundaries(input), `Sınaq bitəndən sonra ${item.left}. ${right} hər gün`, item.key);
    const existing = `${item.left}. ${item.right}.`;
    assert.equal(insertLearnedBoundaries(existing), existing);
    const incomplete = `${item.left} ${right.split(' ')[0]} barədə məlumat`;
    assert.equal(insertLearnedBoundaries(incomplete), incomplete);
    const dependent = `Dedi ki ${item.left} ${right}`;
    assert.equal(insertLearnedBoundaries(dependent), dependent);
  }
});
