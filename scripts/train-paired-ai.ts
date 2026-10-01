import { reviewedTrainingPairs } from './reviewed-training-pairs';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import oldPairs from '../data/local-ai/pairs.json';
import additions from '../data/local-ai/paired-additions.json';
import posArtifact from '../lib/editor/local-ai/pos-model.json';
import { trainPaired, candidateIndex, rankPaired, alignTokens, normalizeDigraphs, wordLower, type CorrectionPair } from '../lib/editor/local-ai/paired';
import { fold, tokenize } from '../lib/editor/local-ai/core';
import { tagPOS, type POSModel } from '../lib/editor/local-ai/pos';
import { trainJointBoundary } from '../lib/editor/local-ai/joint-boundary';
import { atomicWriteSync } from './atomic-files.mjs';

const reviewed = reviewedTrainingPairs(process.argv.find(value => value.startsWith('--reviewed='))?.slice('--reviewed='.length));
const pairs: CorrectionPair[] = [...reviewed, ...oldPairs.pairs, ...additions.rows.map(row => ({ ...row, groupId: row.group }))];
const normalize = (text: string) => tokenize(fold(text)).map(token => token.word).join(' ');
const groups = new Map<string, string>();
for (const pair of pairs) {
  const previous = groups.get(pair.groupId);
  if (previous && previous !== pair.split) throw new Error(`Group split leakage: ${pair.groupId}`);
  groups.set(pair.groupId, pair.split);
}
const train = pairs.filter(pair => pair.split === 'train');
const reserved = new Set(pairs.filter(pair => pair.split !== 'train').map(pair => normalize(pair.target)));
for (const path of ['tests/fixtures/independent-gold-v2.json', 'tests/fixtures/additional-gold-200.json']) {
  const fixture = JSON.parse(readFileSync(path, 'utf8')) as { cases: { expected: string }[] };
  fixture.cases.forEach(row => reserved.add(normalize(row.expected)));
}
for (const path of ['data/local-ai/fresh-holdout.json', 'data/local-ai/challenge-v2.json']) {
  const fixture = JSON.parse(readFileSync(path, 'utf8')) as { pairs?: { target: string }[]; rows?: { target: string }[] };
  (fixture.pairs ?? fixture.rows ?? []).forEach(row => reserved.add(normalize(row.target)));
}
for (const pair of train) if (reserved.has(normalize(pair.target))) throw new Error(`Reserved target leakage: ${pair.id}`);
const model = trainPaired(train, posArtifact as POSModel);
const boundary = trainJointBoundary(train, pairs.filter(pair => pair.split === 'validation'));
atomicWriteSync('lib/editor/local-ai/joint-boundary-model.json', JSON.stringify(boundary, null, 2) + '\n');
const index = candidateIndex(model);
const observations: { probability: number; correct: boolean; id: string }[] = [];
// Threshold selection uses only validation, never the test split.
model.threshold = 0;
for (const pair of pairs.filter(pair => pair.split === 'validation')) {
  const tokens = tokenize(pair.input), tags = tagPOS(posArtifact as POSModel, tokens.map(token => normalizeDigraphs(wordLower(token.word))));
  for (const row of alignTokens(pair)) {
    const decision = rankPaired(model, index, row.raw, tokens, row.at, tags[row.at]?.tag);
    if (decision?.accepted && decision.word !== row.raw) observations.push({ probability: decision.probability, correct: decision.word === row.target, id: pair.id });
  }
}
const thresholds = [...new Set([1, ...observations.map(row => row.probability)])].sort((a, b) => b - a);
let threshold = 1, accepted = 0, correct = 0;
for (const value of thresholds) {
  const selected = observations.filter(row => row.probability >= value);
  const successes = selected.filter(row => row.correct).length;
  // Tiny validation sets cannot justify a precision promise. This is a release
  // criterion on observations, not calibrated out-of-domain correctness.
  if (selected.length >= 10 && successes === selected.length && selected.length > accepted) {
    threshold = value; accepted = selected.length; correct = successes;
  }
}
model.threshold = threshold;
model.calibration = { samples: observations.length, accepted, correct, precision: accepted ? correct / accepted : null };
const artifact = JSON.stringify(model, null, 2) + '\n';
atomicWriteSync('lib/editor/local-ai/paired-model.json', artifact);
atomicWriteSync('data/local-ai/paired-training-report.json', JSON.stringify({ algorithm: model.algorithm,
  pairs: pairs.length, train: train.length, validationPairs: pairs.filter(pair => pair.split === 'validation').length,
  test: pairs.filter(pair => pair.split === 'test').length, distinctTrainingTargets: new Set(train.map(pair => pair.target)).size,
  vocabulary: Object.keys(model.words).length, learnedCorruptedTokens: Object.keys(model.edits).length,
  learnedEditChannels: Object.keys(model.channels).length, spacingPatterns: Object.keys(model.splits).length,
  modelBytes: Buffer.byteLength(artifact), artifactSha256: createHash('sha256').update(artifact).digest('hex'),
  source: additions.source, realReviewedPairs: reviewed.length, threshold, validation: model.calibration, boundary: { examples: boundary.examples, positives: boundary.positives, threshold: boundary.threshold, validation: boundary.validation },
  limitations: 'Synthetic corruptions and authored examples; empirical validation threshold, not universal probability calibration. No complete sentence lookup.' }, null, 2) + '\n');
console.log(JSON.stringify({ words: Object.keys(model.words).length, threshold, calibration: model.calibration }));
