import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import artifact from '../data/experiments/institutional/model.json';
import { createInstitutionalHead, type InstitutionalModel } from '../lib/editor/neural/institutional-head';
import { readInstitutionSentences, institutionPairs, digest, INSTITUTION_CORPUS } from '../scripts/institutional-data';

const sentences = readInstitutionSentences();
test('institutional ownership is frozen before corruption with no duplicate scenarios', () => {
  assert.equal(digest(readFileSync(INSTITUTION_CORPUS, 'utf8')), readFileSync(INSTITUTION_CORPUS + '.sha256', 'utf8').trim());
  assert.equal(artifact.corpusSHA256, digest(readFileSync(INSTITUTION_CORPUS, 'utf8')));
  assert.deepEqual(['train', 'validation', 'test'].map(split => sentences.filter(row => row.split === split).length), [80, 20, 20]);
  assert.equal(new Set(sentences.map(row => row.documentId)).size, 120);
  const pairs = institutionPairs(sentences), owners = new Map(sentences.map(row => [row.documentId, row.split]));
  assert.equal(new Set(pairs.map(row => digest(row.input + '\n' + row.target))).size, pairs.length);
  for (const pair of pairs) assert.equal(pair.split, owners.get(pair.groupId));
});

test('institutional corruption preserves technical names and identifiers', () => {
  const technical = sentences.filter(row => /API|Backend|database|CI\/CD|commit|Deploy|GitHub|Frontend/u.test(row.target));
  for (const pair of institutionPairs(technical)) {
    const terms = pair.target.match(/API|Backend|database|CI\/CD|pipeline|commit|Deploy|GitHub|Frontend/gu) ?? [];
    for (const term of terms) assert.ok(pair.input.includes(term), pair.id + ': ' + term);
  }
});

test('experimental institutional head rejects malformed artifact shapes and preserves identity', () => {
  const model = artifact as InstitutionalModel, head = createInstitutionalHead(model);
  for (const row of sentences) assert.equal(head(row.target), row.target, row.id);
  const broken = structuredClone(model); broken.network.w1.pop();
  assert.throws(() => createInstitutionalHead(broken), /Invalid institutional/);
  const nan = structuredClone(model); nan.network.w2[0] = NaN;
  assert.throws(() => createInstitutionalHead(nan), /Invalid institutional/);
});
