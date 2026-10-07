import { readFileSync } from 'node:fs';
import posArtifact from '../lib/editor/local-ai/pos-model.json';
import type { POSModel } from '../lib/editor/local-ai/pos';
import { collectPairedEvidence, type CorrectionPair } from '../lib/editor/local-ai/paired';
import { tokenize } from '../lib/editor/local-ai/core';
import { canonicalProtectedTerm } from '../lib/editor/protected-terminology';
import { isForeignTechnicalStem } from '../lib/editor/technical';
import { neuralIndex, neuralCandidates } from '../lib/editor/neural/features';
import { createNetwork, trainNetwork, predictNetwork, parameterCount, type Example } from '../lib/editor/neural/network';
import { uniqueExamples } from './neural-data-quality';
import { atomicWriteSync } from './atomic-files.mjs';
import { createInstitutionalHead, institutionalFeatures, type InstitutionalModel } from '../lib/editor/neural/institutional-head';
import { quality } from './nlp/metrics';
import { readInstitutionSentences, institutionPairs, digest, INSTITUTION_CORPUS } from './institutional-data';

const option = (name: string, fallback: string) => process.argv.find(arg => arg.startsWith('--' + name + '='))?.slice(name.length + 3) ?? fallback;
const sentences = readInstitutionSentences(), pairs = institutionPairs(sentences);
const training = pairs.filter(row => row.split === 'train');
const lexicon = collectPairedEvidence(training, posArtifact as POSModel);
for (const word of Object.keys(lexicon.words))
  if (!/^[a-zəçğıöşü]{4,24}$/u.test(word) || canonicalProtectedTerm(word) || isForeignTechnicalStem(word)) delete lexicon.words[word];
for (const [raw, values] of Object.entries(lexicon.edits)) {
  for (const word of Object.keys(values)) if (!lexicon.words[word]) delete values[word];
  if (!Object.keys(values).length) delete lexicon.edits[raw];
}
lexicon.splits = {};
const index = neuralIndex(lexicon);
const examplesFor = (rows: CorrectionPair[]) => {
  const examples: Example[] = [];
  for (const pair of rows) {
    const input = tokenize(pair.input), target = tokenize(pair.target);
    if (input.length !== target.length) throw new Error('Institutional spelling variants must preserve token alignment.');
    input.forEach((token, at) => {
      const raw = token.word.toLocaleLowerCase('az-AZ'), expected = target[at].word.toLocaleLowerCase('az-AZ');
      if (!lexicon.words[expected]) return;
      for (const candidate of new Set([raw, ...neuralCandidates(lexicon, index, raw)]))
        examples.push({ x: institutionalFeatures(lexicon, raw, candidate, input, at), y: Number(candidate === expected) });
    });
  }
  return uniqueExamples(examples);
};
const train = examplesFor(training), validation = examplesFor(pairs.filter(row => row.split === 'validation'));
if (!train.some(row => row.y === 0) || !train.some(row => row.y === 1) || !validation.length) throw new Error('Missing training/validation labels.');
const network = createNetwork(24, 12, 7107);
const loss = (rows: Example[]) => rows.reduce((sum, row) => {
  const p = Math.min(1 - 1e-7, Math.max(1e-7, predictNetwork(network, row.x)));
  return sum - row.y * Math.log(p) - (1 - row.y) * Math.log(1 - p);
}, 0) / rows.length;
const initialTrainingBCE = loss(train), history: { epochs: number; trainingBCE: number; validationBCE: number; correctEdits: number; wrongEdits: number }[] = [];
let best = structuredClone(network), bestLoss = Infinity, bestEdits = -1;
for (let epoch = 0; epoch < 15; epoch++) {
  trainNetwork(network, train, 8);
  const validationBCE = loss(validation);
  const head = createInstitutionalHead({ version: 1, featureVersion: 2, corpusSHA256: '', lexicon, network, threshold: 0.9999, margin: 0.2, minimumContext: 2 });
  const metrics = quality(pairs.filter(row => row.split === 'validation').map(row => ({ ...row, actual: head(row.input), category: 'spelling' })));
  history.push({ epochs: network.epochs, trainingBCE: loss(train), validationBCE, correctEdits: metrics.truePositiveEdits, wrongEdits: metrics.falsePositiveEdits });
  if (metrics.falsePositiveEdits === 0 && (metrics.truePositiveEdits > bestEdits || metrics.truePositiveEdits === bestEdits && validationBCE < bestLoss)) {
    best = structuredClone(network); bestLoss = validationBCE; bestEdits = metrics.truePositiveEdits;
  }
}
const model: InstitutionalModel = { version: 1, featureVersion: 2, corpusSHA256: digest(readFileSync(INSTITUTION_CORPUS, 'utf8')),
  lexicon, network: best, threshold: 0.9999, margin: 0.2, minimumContext: 2 };
const serialized = JSON.stringify(model) + '\n';
atomicWriteSync(option('output', 'data/experiments/institutional/model.json'), serialized);
const partitions = Object.fromEntries(['train', 'validation', 'test'].map(split => {
  const rows = pairs.filter(row => row.split === split), contents = rows.map(row => JSON.stringify(row)).join('\n') + '\n';
  return [split, { scenarios: sentences.filter(row => row.split === split).length, pairs: rows.length, sha256: digest(contents) }];
}));
const report = { sourceSHA256: model.corpusSHA256, artifactSHA256: digest(serialized), sourceSentences: sentences.length,
  partitions, trainingExamples: train.length, validationExamples: validation.length, vocabulary: Object.keys(lexicon.words).length,
  parameters: parameterCount(best), selectedEpochs: best.epochs, attemptedEpochs: network.epochs,
  initialTrainingBCE, history, artifactBytes: Buffer.byteLength(serialized),
  policy: 'Assistant-authored synthetic scenarios, not human-reviewed. Scenario ownership fixed before augmentation. Train-only lexicon/statistics; validation-only checkpoint selection; test unused for training or thresholds. No names, sentence replay, runtime training, Python, LLM or network inference.' };
atomicWriteSync(option('report', 'data/nlp/institutions/training-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, history: undefined }, null, 2));
