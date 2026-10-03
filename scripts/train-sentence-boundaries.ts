import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { atomicWriteSync } from './atomic-files.mjs';
import { checksum } from './nlp/data';
import { loadBoundaryDocuments, boundaryRows } from './nlp/sentence-boundary-data';
import { BOUNDARY_INPUTS, BOUNDARY_FEATURE_VERSION, type NeuralBoundaryArtifact } from '../lib/editor/neural/boundary-features';
import { createNetwork, trainNetwork, predictNetwork, parameterCount } from '../lib/editor/neural/network';
const option = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const source = option('source'), destination = option('output');
const reviews = option('reviews') ?? 'data/nlp/reviews/az-batch-001-splits';
const epochs = Number(option('epochs') ?? 64), seeds = (option('seeds') ?? '1201,2201').split(',').map(Number);
if (!source || !destination) throw new Error('Use --source=frozen-source-splits --output=experiment-directory');
if (!Number.isInteger(epochs) || epochs < 8 || epochs > 200 || seeds.length > 4 || seeds.some(seed => !Number.isInteger(seed))) throw new Error('Use 8..200 epochs and up to four integer seeds.');
const documents = loadBoundaryDocuments(source, reviews), corpus = boundaryRows(documents);
const partitions = Object.fromEntries(['train', 'validation', 'test'].map(split => {
  const rows = corpus.rows.filter(row => row.split === split);
  return [split, { rows: rows.length, positive: rows.filter(row => row.y).length,
    documents: new Set(rows.map(row => row.documentId)).size, sha256: checksum(JSON.stringify(rows)) }];
}));
const train = corpus.rows.filter(row => row.split === 'train'), validation = corpus.rows.filter(row => row.split === 'validation');
if (!train.length || !validation.length || !train.some(row => row.y) || !validation.some(row => row.y)) throw new Error('Independent boundary training and validation positives required.');
const loss = (model: ReturnType<typeof createNetwork>) => validation.reduce((sum, row) => {
  const p = Math.max(1e-7, Math.min(1 - 1e-7, predictNetwork(model, row.x)));
  return sum - row.y * Math.log(p) - (1 - row.y) * Math.log(1 - p);
}, 0) / validation.length;
const output = resolve(destination); mkdirSync(output, { recursive: true });
console.log({ phase: 'prepared', partitions, inputs: BOUNDARY_INPUTS });
const reports: object[] = [];
let selected: { artifact: NeuralBoundaryArtifact; seed: number; correct: number } | undefined;
for (const seed of seeds) {
  const network = createNetwork(BOUNDARY_INPUTS, 12, seed);
  let best = structuredClone(network), bestLoss = loss(network);
  while (network.epochs < epochs) {
    trainNetwork(network, train, Math.min(8, epochs - network.epochs));
    const value = loss(network);
    if (value < bestLoss) { bestLoss = value; best = structuredClone(network); }
    console.log({ phase: 'epoch', seed, epoch: network.epochs, validationBCE: value });
  }
  const scored = validation.map(row => ({ ...row, score: predictNetwork(best, row.x) }));
  let threshold = 1, correct = 0;
  for (const value of [0.99999, 0.9999, 0.9995, 0.999, 0.995, 0.99, 0.98, 0.97]) {
    const accepted = scored.filter(row => row.score >= value);
    if (accepted.length >= 5 && new Set(accepted.map(row => row.documentId)).size >= 5
      && accepted.every(row => row.y === 1) && accepted.length > correct) {
      correct = accepted.length; threshold = value;
    }
  }
  const artifact: NeuralBoundaryArtifact = { version: 1, featureVersion: BOUNDARY_FEATURE_VERSION, network: best, threshold,
    trainingSHA256: checksum(JSON.stringify(train)), validationSHA256: checksum(JSON.stringify(validation)),
    provenance: 'Wikipedia CC BY-SA 3.0 / GFDL attributed in data/nlp/SOURCES.md; 48 owner-approved synthetic training targets. Existing frozen document splits preserved. Validation-only checkpoint/threshold/seed selection; no general semantic or calibrated probability claim.' };
  atomicWriteSync(resolve(output, `boundary-${seed}.json`), JSON.stringify(artifact, null, 2) + '\n');
  reports.push({ seed, attemptedEpochs: epochs, retainedEpochs: best.epochs, validationBCE: bestLoss, threshold,
    validationAccepted: correct, parameters: parameterCount(best), eligible: correct >= 5 });
  if (correct >= 5 && (!selected || correct > selected.correct)) selected = { artifact, seed, correct };
}
if (selected) atomicWriteSync(resolve(output, 'selected.json'), JSON.stringify(selected.artifact, null, 2) + '\n');
const test = selected ? corpus.rows.filter(row => row.split === 'test').map(row => ({ ...row,
  accepted: predictNetwork(selected!.artifact.network, row.x) >= selected!.artifact.threshold })) : [];
const report = { partitions, skippedStructuredDocuments: corpus.skippedStructuredDocuments, reports, selectedSeed: selected?.seed ?? null,
  heldOut: selected ? { rows: test.length, accepted: test.filter(row => row.accepted).length,
    correct: test.filter(row => row.accepted && row.y).length, incorrect: test.filter(row => row.accepted && !row.y).length } : null,
  nextGate: 'Complete editor identity, boundary/edit regressions, formatting/protected spans and latency must pass before production integration.' };
atomicWriteSync(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(report);
