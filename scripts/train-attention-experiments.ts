import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import independent from '../data/neural/attention-independent.json';
import corpus from '../data/neural/attention-pairs.json';
import base from '../lib/editor/neural/model.json';
import pos from '../lib/editor/local-ai/pos-model.json';
import { alignTokens, collectPairedEvidence, type PairedModel, type PairedWord, type CorrectionPair } from '../lib/editor/local-ai/paired';
import type { POSModel } from '../lib/editor/local-ai/pos';
import { createAttentionNetwork, trainAttention, attentionProbability, rankAttention, attentionLexicon,
  clearAttentionCaches, attentionCandidates, ambiguitySupported, tokenPosition, transpositionIndex, ATTENTION_VERSION, type AttentionArtifact, type AttentionExample } from '../lib/editor/neural/attention';
import { tokenize } from '../lib/editor/local-ai/core';
import { auditPairs } from './neural-data-quality';
import { verifyManifest } from './nlp/manifest';
import { checksum, protectedMask } from './nlp/data';
import { atomicWriteSync } from './atomic-files.mjs';
const argument = (name: string) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const folder = argument('data'), destination = resolve(argument('output') ?? 'data/experiments/attention');
const epochs = Number(argument('epochs') ?? 128), seeds = (argument('seeds') ?? '719,919,1119').split(',').map(Number);
if (!Number.isInteger(epochs) || epochs < 16 || epochs > 512 || !seeds.length || seeds.length > 5 || seeds.some(seed => !Number.isInteger(seed))) throw new Error('Use 16..512 epochs and 1..5 integer seeds.');
interface Pair extends CorrectionPair { id: string; split: string; documentId?: string; category?: string; protectedTerms?: string[] }
interface WordRow { id: string; split: string; input: string; raw: string; expectedWord: string; tokenAt?: number; protected?: boolean }
const pairs: Pair[] = folder ? ['train', 'validation', 'test'].flatMap(split =>
  readFileSync(resolve(folder, split + '.jsonl'), 'utf8').split(/\r?\n/u).filter(line => line.trim()).map(line => {
    const row = JSON.parse(line) as Pair;
    row.groupId ??= row.documentId!;
    if (row.split !== split || typeof row.input !== 'string' || typeof row.target !== 'string' || !row.documentId) throw new Error('Invalid document-split row.');
    return row;
  })) : corpus.rows.map(row => ({ ...row }));
if (!pairs.length || ['train', 'validation', 'test'].some(split => !pairs.some(row => row.split === split))) throw new Error('Each split needs independent examples.');
if (folder) {
  verifyManifest(folder);
  const owners = new Map<string, string>(), targets = new Map<string, string>();
  for (const row of pairs) {
    const old = owners.get(row.documentId!); if (old && old !== row.split) throw new Error('Document appears in multiple splits.'); owners.set(row.documentId!, row.split);
    const hash = checksum(row.target.normalize('NFC')), previous = targets.get(hash);
    if (previous && previous !== row.split) throw new Error('Clean target leaks across splits.'); targets.set(hash, row.split);
  }
} else {
  const audit = auditPairs(pairs);
  if (audit.duplicates.length || audit.nearDuplicates.length || audit.splitLeaks.length) throw new Error('Existing experiment corpus failed its sentence-level audit.');
}
const trainingPairs = pairs.filter(row => row.split === 'train'), learned = collectPairedEvidence(trainingPairs, pos as POSModel);
const vocabulary: Record<string, PairedWord> = {};
if (!folder) for (const word of new Set(corpus.rows.filter(row => row.split === 'train').map(row => row.expectedWord))) {
  const source = learned.words[word], old = (base.lexicon as PairedModel).words[word];
  if (!source) throw new Error('Missing training evidence: ' + word);
  const context = { ...(old?.context ?? {}) };
  for (const [key, count] of Object.entries(source.context)) context[key] = (context[key] ?? 0) + count;
  vocabulary[word] = { count: (old?.count ?? 0) + source.count, context, pos: [...new Set([...(old?.pos ?? []), ...source.pos])] };
}
const lexicon = folder ? learned : attentionLexicon(base.lexicon as PairedModel, vocabulary), index = transpositionIndex(lexicon);
const wordRows: WordRow[] = folder ? pairs.flatMap(pair => {
  const tokens = tokenize(pair.input), mask = protectedMask(pair.input, pair.protectedTerms);
  return alignTokens(pair, 4).map(row => ({ id: `${pair.id}:${row.at}`, split: pair.split, input: pair.input,
    raw: row.raw, expectedWord: row.target, tokenAt: row.at,
    protected: mask.slice(tokens[row.at].start, tokens[row.at].end).some(Boolean) }));
}) : corpus.rows.map(row => ({ ...row }));
for (const row of wordRows) row.expectedWord = row.expectedWord.toLocaleLowerCase('az-AZ');
const tokenCache = new Map<string, ReturnType<typeof tokenize>>();
const locate = (row: WordRow) => {
  if (row.tokenAt === undefined) return tokenPosition(row.input, row.raw);
  let tokens = tokenCache.get(row.input); if (!tokens) { tokens = tokenize(row.input); tokenCache.set(row.input, tokens); }
  return { tokens, at: row.tokenAt };
};
// These experiments score aligned words, not complete text. Space/insert/delete
// errors omitted by alignTokens remain a known coverage limitation.
const knownVariants = ['full', 'uniform-attention', 'no-position', 'no-context', 'direct-diacritics', 'bounded-edits', 'bounded-uniform', 'bounded-no-context'];
const variants = argument('variants')?.split(',') ?? knownVariants;
if (variants.some(variant => !knownVariants.includes(variant))) throw new Error('Unknown ablation variant.');
const reports: unknown[] = []; mkdirSync(destination, { recursive: true });
for (const seed of seeds) for (const variant of variants) {
  clearAttentionCaches();
  const mode = variant.startsWith('bounded-') ? 'bounded-edits' : variant === 'direct-diacritics' ? 'folded-and-swaps' : undefined;
  const examples = (split: string): AttentionExample[] => wordRows.filter(row => row.split === split).flatMap(row => {
    const candidates = row.protected ? [] : attentionCandidates(index, row.raw, mode, lexicon);
    if (mode === 'bounded-edits' && !candidates.length) return [];
    const { tokens, at } = locate(row);
    return [...new Set([row.raw.toLocaleLowerCase('az-AZ'), ...candidates])]
      .map(candidate => ({ raw: row.raw, candidate, tokens, at, y: Number(candidate === row.expectedWord), group: row.id }));
  });
  const network = createAttentionNetwork(seed);
  if ((variant === 'uniform-attention' || variant === 'bounded-uniform')) network.experiment = { attention: 'uniform' };
  if (variant === 'no-position') network.experiment = { position: 'none' };
  if ((variant === 'no-context' || variant === 'bounded-no-context')) network.experiment = { context: 'none' };
  const allTraining = examples('train'), validation = examples('validation');
  const maximumGroups = Number(argument('sample-groups') ?? 20000);
  if (!Number.isInteger(maximumGroups) || maximumGroups < 100 || maximumGroups > 100000) throw new Error('sample-groups must be 100..100000.');
  const groupIds = [...new Set(allTraining.map(row => row.group))].sort((a, b) => checksum(a).localeCompare(checksum(b))).slice(0, maximumGroups);
  const selectedGroups = new Set(groupIds), training = allTraining.filter(row => selectedGroups.has(row.group));
  console.log({ phase: 'prepared', variant, seed, examples: training.length, allTrainingExamples: allTraining.length, trainingGroups: selectedGroups.size, validationExamples: validation.length });
  if (!training.length || !validation.length) throw new Error('No usable aligned word examples.');
  const loss = (model: typeof network, rows: AttentionExample[]) => rows.reduce((sum, row) => {
    const p = Math.max(1e-7, Math.min(1 - 1e-7, attentionProbability(model, lexicon, row)));
    return sum - row.y * Math.log(p) - (1 - row.y) * Math.log(1 - p);
  }, 0) / Math.max(1, rows.length);
  let best = structuredClone(network), bestLoss = loss(network, validation);
  for (let remaining = epochs; remaining > 0;) {
    const count = Math.min(16, remaining); trainAttention(network, lexicon, training, count); remaining -= count;
    const value = loss(network, validation); console.log({ phase: 'epoch', variant, seed, epoch: network.epochs, validationLoss: value }); if (value < bestLoss) { bestLoss = value; best = structuredClone(network); }
  }
  const artifact: AttentionArtifact = { version: 1, featureVersion: ATTENTION_VERSION, network: best,
    lexiconSha256: checksum(JSON.stringify(lexicon)), corpusSha256: checksum(JSON.stringify(pairs)),
    vocabulary: folder ? {} : vocabulary, threshold: 1, margin: 1, ...(mode ? { candidateMode: mode } : {}) };
  const calibration = wordRows.filter(row => row.split === 'validation').map(row => {
    const { tokens, at } = locate(row), candidates = row.protected ? [] : attentionCandidates(index, row.raw, mode, lexicon);
    const choices = [...new Set([row.raw.toLocaleLowerCase('az-AZ'), ...candidates])].map(candidate => ({ candidate,
      score: attentionProbability(best, lexicon, { raw: row.raw, candidate, tokens, at }) })).sort((a, b) => b.score - a.score || a.candidate.localeCompare(b.candidate, 'az'));
    return { ...row, winner: choices[0].candidate, score: choices[0].score, margin: choices[0].score - (choices[1]?.score ?? 0),
      supported: ambiguitySupported(lexicon, candidates, choices[0].candidate, tokens, at) };
  });
  let accepted = 0;
  for (const margin of [0.5, 0.4, 0.3, 0.2, 0.15, 0.1]) for (const threshold of [0.9999, 0.999, 0.995, 0.99, 0.98, 0.95, 0.9, 0.8, 0.7, 0.6]) {
    const selected = calibration.filter(row => row.winner !== row.raw.toLocaleLowerCase('az-AZ') && row.score >= threshold && row.margin >= margin && row.supported);
    if (selected.length >= (folder ? 30 : 4) && selected.length > accepted && selected.every(row => row.winner === row.expectedWord)) { accepted = selected.length; artifact.threshold = threshold; artifact.margin = margin; }
  }
  const partitions = Object.fromEntries((folder ? ['train', 'validation', 'test'] : ['train', 'validation', 'test', 'additional']).map(split => {
    const rows: WordRow[] = split === 'additional' ? independent.rows.map(row => ({ ...row, expectedWord: row.expectedWord.toLocaleLowerCase('az-AZ') })) : wordRows.filter(row => row.split === split); let covered = 0, coveredErrors = 0, exact = 0, proposed = 0, correct = 0, incorrect = 0, needs = 0, falseChanges = 0, identity = 0;
    for (const row of rows) {
      const raw = row.raw.toLocaleLowerCase('az-AZ'), candidates = row.protected ? [] : attentionCandidates(index, row.raw, mode, lexicon);
      needs += Number(raw !== row.expectedWord); identity += Number(raw === row.expectedWord);
      covered += Number(raw === row.expectedWord || candidates.includes(row.expectedWord));
      coveredErrors += Number(raw !== row.expectedWord && candidates.includes(row.expectedWord));
      const { tokens, at } = locate(row), decision = row.protected ? undefined : rankAttention(artifact, lexicon, index, row.raw, tokens, at);
      const output = decision?.accepted ? decision.candidate : raw;
      exact += Number(output === row.expectedWord);
      if (decision?.accepted) { proposed++; correct += Number(output === row.expectedWord); incorrect += Number(output !== row.expectedWord); falseChanges += Number(raw === row.expectedWord); }
    }
    return [split, { rows: rows.length, exact, covered, candidateCoverage: covered / Math.max(1, rows.length), needsCorrection: needs, candidateRecallOnErrors: needs ? coveredErrors / needs : null, proposed, correct, incorrect,
      precision: proposed ? correct / proposed : null, recall: needs ? correct / needs : null, identity, falseChanges,
      candidateBCE: split === 'additional' ? null : loss(best, examples(split)) }];
  }));
  const report = { variant, seed, trainingExamples: training.length, allTrainingExamples: allTraining.length, trainingGroups: selectedGroups.size, attemptedEpochs: epochs, retainedEpochs: best.epochs, threshold: artifact.threshold, margin: artifact.margin,
    calibratedValidationCorrections: accepted, validationRanking: { groups: calibration.length, changedWinners: calibration.filter(row => row.winner !== row.raw.toLocaleLowerCase('az-AZ')).length, correctWinners: calibration.filter(row => row.winner === row.expectedWord).length, incorrectConfident: calibration.filter(row => row.winner !== row.expectedWord && row.winner !== row.raw.toLocaleLowerCase('az-AZ') && row.score >= 0.99).length }, partitions,
    caveat: 'Word-head ablation with fresh identical-seed initialization and equal epoch budgets. No test-based threshold selection; sentence-level full-editor quality is a separate report. Score is not a calibrated probability.' };
  reports.push(report);
  atomicWriteSync(resolve(destination, `${variant}-${seed}.json`), JSON.stringify({ artifact, lexicon }, null, 2) + '\n');
  console.log(report);
}
atomicWriteSync(resolve(destination, 'report.json'), JSON.stringify({ data: folder ?? 'existing-authored-attention-corpus', corpusSHA256: checksum(JSON.stringify(pairs)),
  splitUnit: folder ? 'documentId (upstream clustering manifest required for near-duplicate audit)' : 'authored sentence; original source document unknown',
  alignedWordRows: wordRows.length, sourceRows: pairs.length, reports }, null, 2) + '\n');
