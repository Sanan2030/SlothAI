import type { MorphologicalFeatures } from '../lib/editor/contracts/morphology';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import seedArtifact from '../data/neural/seed-v1.json';
import corpus from '../data/neural/corpus.json';
import posArtifact from '../lib/editor/local-ai/pos-model.json';
import { alignTokens, trainPaired, type CorrectionPair } from '../lib/editor/local-ai/paired';
import { tokenize, fold } from '../lib/editor/local-ai/core';
import type { POSModel } from '../lib/editor/local-ai/pos';
import { trainNetwork, predictNetwork, parameterCount, type Example } from '../lib/editor/neural/network';
import { FEATURE_VERSION, neuralIndex, neuralCandidates, lexicalFeatures, agreementFeatures, type Subject } from '../lib/editor/neural/features';
import type { NeuralArtifact } from '../lib/editor/neural/types';
import { uniqueExamples } from './neural-data-quality';
import { atomicWriteSync } from './atomic-files.mjs';
const start = performance.now();
const pairs: CorrectionPair[] = corpus.lexical;
const reserved = new Set(pairs.filter(row => row.split !== 'train').map(row => row.target));
for (const row of pairs.filter(row => row.split === 'train')) if (reserved.has(row.target)) throw new Error('Neural target split leakage.');
const hash = createHash('sha256').update(JSON.stringify(corpus)).digest('hex');
const learned = trainPaired(pairs.filter(row => row.split === 'train'), posArtifact as POSModel);
// Published checkpoint is immutable. Only current training rows update counts.
const lexicon = structuredClone(seedArtifact.lexicon) as NeuralArtifact['lexicon'];
for (const [word, value] of Object.entries(learned.words)) {
  const old = lexicon.words[word];
  if (!old) { lexicon.words[word] = value; continue; }
  old.count += value.count;
  for (const [key, count] of Object.entries(value.context)) old.context[key] = (old.context[key] ?? 0) + count;
  old.pos = [...new Set([...old.pos, ...value.pos])];
}
for (const [raw, targets] of Object.entries(learned.edits)) {
  lexicon.edits[raw] ??= {};
  for (const [target, count] of Object.entries(targets)) lexicon.edits[raw][target] = (lexicon.edits[raw][target] ?? 0) + count;
}
for (const [key, count] of Object.entries(learned.channels)) lexicon.channels[key] = (lexicon.channels[key] ?? 0) + count;
// Learn multi-vowel error evidence from training pairs too; the old trainer
// intentionally bounded its alignment to two edits.
for (const pair of pairs.filter(row => row.split === 'train')) for (const row of alignTokens(pair, 4)) {
  if (row.raw === row.target || !lexicon.words[row.target] || alignTokens(pair).some(old => old.raw === row.raw && old.target === row.target && old.at === row.at)) continue;
  lexicon.edits[row.raw] ??= {};
  lexicon.edits[row.raw][row.target] = (lexicon.edits[row.raw][row.target] ?? 0) + 1;
}
const index = neuralIndex(lexicon);
const lexicalRows = (split: string) => pairs.filter(row => row.split === split).flatMap(pair => {
  const tokens = tokenize(pair.input);
  return alignTokens(pair, 4).filter(row => row.raw !== row.target).flatMap(row => neuralCandidates(lexicon, index, row.raw)
    .map(candidate => ({ x: lexicalFeatures(lexicon, row.raw, candidate, tokens, row.at), y: Number(candidate === row.target), anchored: Object.values(lexicon.edits[row.raw.toLocaleLowerCase('az-AZ')] ?? {}).some(count => count >= 3), group: `${pair.groupId}:${row.at}` })));
});
const trainLexical = uniqueExamples(lexicalRows('train')), validationLexical = lexicalRows('validation');
const grammarRows = (split: string): Example[] => corpus.agreement.filter(row => row.split === split).map(row => ({
  x: agreementFeatures(row.subject as Subject, row.verb as MorphologicalFeatures), y: Number(row.compatible) }));
const epochs = Number(process.argv.find(arg => arg.startsWith('--epochs='))?.slice(9) ?? 12);
let model: NeuralArtifact;
if (process.argv.includes('--resume')) {
  model = JSON.parse(readFileSync('lib/editor/neural/model.json', 'utf8')) as NeuralArtifact;
  if (model.corpusSha256 !== hash || model.featureVersion !== FEATURE_VERSION) throw new Error('Corpus/features changed; rebuild rather than resume incompatible weights.');
} else model = { version: 1, featureVersion: FEATURE_VERSION, corpusSha256: hash,
  lexical: structuredClone(seedArtifact.lexical), lexicalAnchor: structuredClone(seedArtifact.lexical), agreement: structuredClone(seedArtifact.agreement), lexicon,
  lexicalThreshold: 1, lexicalMargin: 0.2, agreementThreshold: 1 };
// Withhold the memorized typo→target-count feature during gradient updates.
// This encourages generalization rather than merely recalling known inputs.
const spellingUpdates = uniqueExamples(trainLexical.map(row => {
  const x = [...row.x]; x[2] = 0; return { ...row, x };
}));
const previousLexical = structuredClone(model.lexical), previousAgreement = structuredClone(model.agreement);
trainNetwork(model.lexical, spellingUpdates, epochs);
trainNetwork(model.agreement, grammarRows('train'), epochs);
// Calibrate acceptance using validation only, never held-out tests.
function threshold(network: NeuralArtifact['lexical'], rows: Example[], minimum: number): number {
  const scored = rows.map(row => ({ score: predictNetwork(network, row.x), y: row.y }));
  let selectedThreshold = 1;
  for (const value of [0.99, 0.98, 0.95, 0.9, 0.8, 0.7, 0.6]) {
    const selected = scored.filter(row => row.score >= value);
    if (selected.length >= minimum && selected.every(row => row.y === 1)) selectedThreshold = value;
  }
  return selectedThreshold;
}
function calibrateLexical(network: NeuralArtifact['lexical']) {
  const groups = new Map<string, { score: number; y: number }[]>();
  for (const row of validationLexical) {
    const values = groups.get(row.group) ?? [];
    values.push({ score: predictNetwork(row.anchored ? model.lexicalAnchor ?? network : network, row.x), y: row.y }); groups.set(row.group, values);
  }
  const winners = [...groups.values()].map(values => {
    values.sort((a, b) => b.score - a.score);
    return { ...values[0], margin: values[0].score - (values[1]?.score ?? 0) };
  });
  let selected = { threshold: 1, margin: 0.2, accepted: 0 };
  for (const margin of [0.2, 0.25, 0.3, 0.15]) for (const threshold of [0.99, 0.98, 0.95, 0.9, 0.8, 0.7, 0.6]) {
    const proposals = winners.filter(row => row.score >= threshold && row.margin >= margin);
    if (proposals.length >= 3 && proposals.every(row => row.y === 1) && proposals.length > selected.accepted)
      selected = { threshold, margin, accepted: proposals.length };
  }
  return { ...selected, groups: winners.length };
}
let calibration = calibrateLexical(model.lexical);
model.lexicalThreshold = calibration.threshold;
model.lexicalMargin = calibration.margin;
model.agreementThreshold = threshold(model.agreement, grammarRows('validation'), 3);
const loss = (network: NeuralArtifact['lexical'], rows: Example[]) => rows.reduce((sum, row) => {
  const p = Math.max(1e-7, Math.min(1 - 1e-7, predictNetwork(network, row.x)));
  return sum - row.y * Math.log(p) - (1 - row.y) * Math.log(1 - p);
}, 0) / rows.length;
// Keep the best validation checkpoint per head; extra training must earn its cost.
{
  if (loss(previousLexical, validationLexical) < loss(model.lexical, validationLexical)) model.lexical = previousLexical;
  if (loss(previousAgreement, grammarRows('validation')) < loss(model.agreement, grammarRows('validation'))) model.agreement = previousAgreement;
  calibration = calibrateLexical(model.lexical);
  model.lexicalThreshold = calibration.threshold;
  model.lexicalMargin = calibration.margin;
  model.agreementThreshold = threshold(model.agreement, grammarRows('validation'), 3);
}
const artifact = JSON.stringify(model) + '\n';
atomicWriteSync('lib/editor/neural/model.json', artifact);
const report = { architecture: 'Candidate and agreement tanh MLPs plus frozen lexical anchor for previously learned errors; CPU-only deterministic SGD',
  epochs: { lexical: model.lexical.epochs, agreement: model.agreement.epochs }, parameters: parameterCount(model.lexical) + parameterCount(model.agreement) + (model.lexicalAnchor ? parameterCount(model.lexicalAnchor) : 0),
  corpusSha256: hash, seedSha256: createHash('sha256').update(JSON.stringify(seedArtifact)).digest('hex'), artifactSha256: createHash('sha256').update(artifact).digest('hex'), artifactBytes: Buffer.byteLength(artifact),
  lexical: { trainExamples: trainLexical.length, updateExamples: spellingUpdates.length, hiddenMemorizationFeature: 2, validationExamples: validationLexical.length, testExamples: lexicalRows('test').length,
    validationLoss: loss(model.lexical, validationLexical), threshold: model.lexicalThreshold, calibration },
  agreement: { trainExamples: grammarRows('train').length, validationExamples: grammarRows('validation').length, testExamples: grammarRows('test').length,
    validationLoss: loss(model.agreement, grammarRows('validation')), threshold: model.agreementThreshold },
  source: corpus.source, seedCommit: 'a5d7c00f9a45de8cb06f5b8271f303ea9a2cbd36', evaluationCaveat: 'Current holdout excludes new updates; v1 may have learned the word forms, error channels and grammar features. Not a cold-start unseen-lemma test.', limitations: 'Synthetic, morphology-assisted specialized correction networks; no general semantic understanding or calibrated probability guarantee.' };
atomicWriteSync('data/neural/training-report.json', JSON.stringify(report, null, 2) + '\n');
const history = process.argv.includes('--resume') ? JSON.parse(readFileSync('data/neural/training-history.json', 'utf8')) as unknown[] : [];
history.push({ requestedEpochs: epochs, retainedPreviousLexical: model.lexical.epochs === previousLexical.epochs, retainedPreviousAgreement: model.agreement.epochs === previousAgreement.epochs, epochs: report.epochs, lexicalValidationLoss: report.lexical.validationLoss, agreementValidationLoss: report.agreement.validationLoss, artifactSha256: report.artifactSha256 });
atomicWriteSync('data/neural/training-history.json', JSON.stringify(history, null, 2) + '\n');
console.log({ ...report, elapsedMs: Math.round(performance.now() - start) });
console.log('Word-family example:', fold('məktəblər'));
