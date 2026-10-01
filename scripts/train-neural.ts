import type { MorphologicalFeatures } from '../lib/editor/contracts/morphology';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import corpus from '../data/neural/corpus.json';
import posArtifact from '../lib/editor/local-ai/pos-model.json';
import { alignTokens, trainPaired, type CorrectionPair } from '../lib/editor/local-ai/paired';
import { tokenize, fold } from '../lib/editor/local-ai/core';
import type { POSModel } from '../lib/editor/local-ai/pos';
import { createNetwork, trainNetwork, predictNetwork, parameterCount, type Example } from '../lib/editor/neural/network';
import { FEATURE_VERSION, neuralIndex, neuralCandidates, lexicalFeatures, agreementFeatures, type Subject } from '../lib/editor/neural/features';
import type { NeuralArtifact } from '../lib/editor/neural/types';
import { atomicWriteSync } from './atomic-files.mjs';
const start = performance.now();
const pairs: CorrectionPair[] = corpus.lexical;
const reserved = new Set(pairs.filter(row => row.split !== 'train').map(row => row.target));
for (const row of pairs.filter(row => row.split === 'train')) if (reserved.has(row.target)) throw new Error('Neural target split leakage.');
const hash = createHash('sha256').update(JSON.stringify(corpus)).digest('hex');
const lexicon = trainPaired(pairs.filter(row => row.split === 'train'), posArtifact as POSModel);
// Learn multi-vowel error evidence from training pairs too; the old trainer
// intentionally bounded its alignment to two edits.
for (const pair of pairs.filter(row => row.split === 'train')) for (const row of alignTokens(pair, 4)) {
  if (row.raw === row.target || !lexicon.words[row.target]) continue;
  lexicon.edits[row.raw] ??= {};
  lexicon.edits[row.raw][row.target] = (lexicon.edits[row.raw][row.target] ?? 0) + 1;
}
const index = neuralIndex(lexicon);
const lexicalRows = (split: string) => pairs.filter(row => row.split === split).flatMap(pair => {
  const tokens = tokenize(pair.input);
  return alignTokens(pair, 4).filter(row => row.raw !== row.target).flatMap(row => neuralCandidates(lexicon, index, row.raw)
    .map(candidate => ({ x: lexicalFeatures(lexicon, row.raw, candidate, tokens, row.at), y: Number(candidate === row.target), group: pair.groupId })));
});
const trainLexical = lexicalRows('train'), validationLexical = lexicalRows('validation');
const grammarRows = (split: string): Example[] => corpus.agreement.filter(row => row.split === split).map(row => ({
  x: agreementFeatures(row.subject as Subject, row.verb as MorphologicalFeatures), y: Number(row.compatible) }));
const epochs = Number(process.argv.find(arg => arg.startsWith('--epochs='))?.slice(9) ?? 12);
let model: NeuralArtifact;
if (process.argv.includes('--resume')) {
  model = JSON.parse(readFileSync('lib/editor/neural/model.json', 'utf8')) as NeuralArtifact;
  if (model.corpusSha256 !== hash || model.featureVersion !== FEATURE_VERSION) throw new Error('Corpus/features changed; rebuild rather than resume incompatible weights.');
} else model = { version: 1, featureVersion: FEATURE_VERSION, corpusSha256: hash,
  lexical: createNetwork(trainLexical[0].x.length, 12), agreement: createNetwork(14, 12, 202), lexicon,
  lexicalThreshold: 1, lexicalMargin: 0.2, agreementThreshold: 1 };
const previousLexical = structuredClone(model.lexical), previousAgreement = structuredClone(model.agreement);
trainNetwork(model.lexical, trainLexical, epochs);
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
model.lexicalThreshold = threshold(model.lexical, validationLexical, 10);
model.agreementThreshold = threshold(model.agreement, grammarRows('validation'), 10);
const loss = (network: NeuralArtifact['lexical'], rows: Example[]) => rows.reduce((sum, row) => {
  const p = Math.max(1e-7, Math.min(1 - 1e-7, predictNetwork(network, row.x)));
  return sum - row.y * Math.log(p) - (1 - row.y) * Math.log(1 - p);
}, 0) / rows.length;
// Keep the best validation checkpoint per head; extra training must earn its cost.
if (process.argv.includes('--resume')) {
  if (loss(previousLexical, validationLexical) < loss(model.lexical, validationLexical)) model.lexical = previousLexical;
  if (loss(previousAgreement, grammarRows('validation')) < loss(model.agreement, grammarRows('validation'))) model.agreement = previousAgreement;
  model.lexicalThreshold = threshold(model.lexical, validationLexical, 10);
  model.agreementThreshold = threshold(model.agreement, grammarRows('validation'), 10);
}
const artifact = JSON.stringify(model) + '\n';
atomicWriteSync('lib/editor/neural/model.json', artifact);
const report = { architecture: 'Two one-hidden-layer tanh MLPs; binary candidate/compatibility heads; CPU-only deterministic SGD',
  epochs: { lexical: model.lexical.epochs, agreement: model.agreement.epochs }, parameters: parameterCount(model.lexical) + parameterCount(model.agreement),
  corpusSha256: hash, artifactSha256: createHash('sha256').update(artifact).digest('hex'), artifactBytes: Buffer.byteLength(artifact),
  lexical: { trainExamples: trainLexical.length, validationExamples: validationLexical.length, testExamples: lexicalRows('test').length,
    validationLoss: loss(model.lexical, validationLexical), threshold: model.lexicalThreshold },
  agreement: { trainExamples: grammarRows('train').length, validationExamples: grammarRows('validation').length, testExamples: grammarRows('test').length,
    validationLoss: loss(model.agreement, grammarRows('validation')), threshold: model.agreementThreshold },
  source: corpus.source, limitations: 'Synthetic, morphology-assisted specialized correction networks; no general semantic understanding or calibrated probability guarantee.' };
atomicWriteSync('data/neural/training-report.json', JSON.stringify(report, null, 2) + '\n');
const history = process.argv.includes('--resume') ? JSON.parse(readFileSync('data/neural/training-history.json', 'utf8')) as unknown[] : [];
history.push({ epochs: report.epochs, lexicalValidationLoss: report.lexical.validationLoss, agreementValidationLoss: report.agreement.validationLoss, artifactSha256: report.artifactSha256 });
atomicWriteSync('data/neural/training-history.json', JSON.stringify(history, null, 2) + '\n');
console.log({ ...report, elapsedMs: Math.round(performance.now() - start) });
console.log('Word-family example:', fold('məktəblər'));
