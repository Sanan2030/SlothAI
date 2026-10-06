import test from 'node:test';
import assert from 'node:assert/strict';
import { foldLetters } from '../lib/editor/dictionary';
import { features, predictContext, tokenize, type LocalContextModel } from '../lib/editor/local-ai/core';

test('bounded folding retains Azerbaijani I/İ, Unicode and eviction semantics', () => {
  const reference = (text: string) => text.toLocaleLowerCase('az-AZ').replace(/[əçıöüşğ]/g,
    letter => ({ ə: 'e', ç: 'c', ı: 'i', ö: 'o', ü: 'u', ş: 's', ğ: 'g' })[letter]!);
  const samples = ['I', 'İ', 'I\u0307', 'Icra', 'İcra', 'Insan', 'ŞƏRGİ', 'əçıöüşğ', 'İŞIQ', '🇦🇿', '', 'A'.repeat(256)];
  for (let pass = 0; pass < 2; pass++) {
    for (const value of samples) assert.equal(foldLetters(value), reference(value), JSON.stringify(value));
    for (let n = 0; n < 9000; n++) assert.equal(foldLetters(`İŞ${n}`), reference(`İŞ${n}`));
  }
});

test('context vocabularies stay isolated between independent model objects', () => {
  const tokens = tokenize('sənəd suret imza');
  const cues = features(tokens, 1);
  const model = (winner: string): LocalContextModel => ({ version: 3, algorithm: 'context-naive-bayes', forms: {}, boundaries: {}, trainingGroups: 10,
    groups: { suret: Object.fromEntries(['surət', 'sürət'].map(word => [word, { examples: 10, total: 100,
      features: Object.fromEntries(cues.map(cue => [cue, word === winner ? 10 : 0])) }])) } });
  const copy = model('surət'), speed = model('sürət');
  for (let pass = 0; pass < 3; pass++) {
    assert.equal(predictContext(copy, 'suret', tokens, 1)?.word, 'surət');
    assert.equal(predictContext(speed, 'suret', tokens, 1)?.word, 'sürət');
  }
});
