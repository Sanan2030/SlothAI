import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { correctText } from '../lib/editor/correct';
import { chooseSpelling, dictionaryCandidates } from '../lib/editor/dictionary';
import words from '../lib/editor/generated/az-words.json';

test('full imported dictionary is reproducible from pinned source', () => {
  const root = new URL('../public/dictionaries/az/', import.meta.url);
  const metadata = JSON.parse(readFileSync(new URL('metadata.json', root), 'utf8'));
  for (const [file, hash] of Object.entries(metadata.checksums)) {
    assert.equal(createHash('sha256').update(readFileSync(new URL(file.split('/').at(-1)!, root))).digest('hex'), hash);
  }
  const entries = readFileSync(new URL('az.dic', root), 'utf8').trim().split(/\r?\n/).slice(1);
  const unique = [...new Set(entries.map(line => line.split('/')[0].trim().normalize('NFC')))];
  assert.deepEqual(words, unique);
  assert.equal(entries.length, 42936);
  assert.equal(words.length, 38174);
});

test('new dictionary vocabulary is used by the real text transformation', () => {
  const examples = [
    ['huquqsunas', 'Hüquqşünas.'], ['mesuliyyet', 'Məsuliyyət.'],
    ['teserrufat', 'Təsərrüfat.'], ['xestexana', 'Xəstəxana.'],
    ['murekkeb', 'Mürəkkəb.'],
  ];
  for (const [input, expected] of examples) {
    assert.equal(correctText(input).text, expected);
    assert.equal(correctText(expected).text, expected);
  }
});

test('ambiguous imported spellings are not guessed and explicit letters are evidence', () => {
  const dictionaryReplacement = (word: string) => chooseSpelling(word, dictionaryCandidates(word));
  assert.equal(dictionaryReplacement('seher'), undefined);
  assert.equal(dictionaryReplacement('suret'), undefined);
  assert.equal(dictionaryReplacement('sürət'), 'sürət');
  assert.equal(dictionaryReplacement('surət'), 'surət');
  assert.equal(dictionaryReplacement('goruş'), 'görüş');
  assert.equal(correctText('suret').text, 'Suret.');
  assert.equal(correctText('ey').text, 'Ey.');
  assert.equal(correctText('Zyphoria').text, 'Zyphoria.');
});

test('dictionary lookup does not modify protected code or URLs', () => {
  const value = 'https://example.com/huquqsunas `const mesuliyyet = 1;`';
  const result = correctText(value).text;
  assert.ok(result.includes(value));
});
