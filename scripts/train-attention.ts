import { createHash } from 'node:crypto';
import { collectPairedEvidence, type PairedModel, type PairedWord } from '../lib/editor/local-ai/paired';
import type { POSModel } from '../lib/editor/local-ai/pos';
import posModel from '../lib/editor/local-ai/pos-model.json';
import base from '../lib/editor/neural/model.json';
import pairs from '../data/neural/attention-pairs.json';
import independent from '../data/neural/attention-independent.json';
import original from '../data/neural/diverse-pairs.json';
import expansion from '../data/neural/expansion-pairs.json';
import { createAttentionNetwork, trainAttention, attentionLexicon, attentionProbability, attentionParameterCount,
  transpositionIndex, transpositionCandidates, tokenPosition, ambiguitySupported, ATTENTION_VERSION, type AttentionArtifact, type AttentionExample } from '../lib/editor/neural/attention';
import { auditPairs } from './neural-data-quality';
import { atomicWriteSync } from './atomic-files.mjs';
const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const audit = auditPairs([...original.rows, ...expansion.rows, ...pairs.rows, ...independent.rows]);
if (audit.duplicates.length || audit.nearDuplicates.length || audit.splitLeaks.length) throw new Error('Duplicate attention contexts: ' + JSON.stringify(audit));
const trainPairs = pairs.rows.filter(row => row.split === 'train');
const learned = collectPairedEvidence(trainPairs, posModel as POSModel);
const vocabulary: Record<string, PairedWord> = {};
for (const word of new Set(trainPairs.map(row => row.expectedWord))) {
  const source = learned.words[word];
  if (!source) throw new Error('Attention target has no training evidence: ' + word);
  const old = (base.lexicon as PairedModel).words[word];
  const context = { ...(old?.context ?? {}) };
  for (const [key, value] of Object.entries(source.context)) context[key] = (context[key] ?? 0) + value;
  vocabulary[word] = { count: (old?.count ?? 0) + source.count, context, pos: [...new Set([...(old?.pos ?? []), ...source.pos])] };
}
const lexicon = attentionLexicon(base.lexicon as PairedModel, vocabulary), index = transpositionIndex(lexicon);
const examples = (split: string): AttentionExample[] => pairs.rows.filter(row => row.split === split).flatMap(row => {
  const { tokens, at } = tokenPosition(row.input, row.raw);
  return [...new Set([row.raw.toLocaleLowerCase('az-AZ'), ...transpositionCandidates(index, row.raw)])].map(candidate => ({
    raw: row.raw, candidate, tokens, at, y: Number(candidate === row.expectedWord), group: row.id }));
});
const train = examples('train'), validation = examples('validation');
const network = createAttentionNetwork(), initial = structuredClone(network);
const loss = () => validation.reduce((sum, row) => {
  const p = Math.min(1 - 1e-7, Math.max(1e-7, attentionProbability(network, lexicon, row)));
  return sum - row.y * Math.log(p) - (1 - row.y) * Math.log(1 - p);
}, 0) / validation.length;
let best = structuredClone(network), bestLoss = loss();
const history: { epoch: number; validationLoss: number }[] = [];
for (let stage = 0; stage < 32; stage++) {
  trainAttention(network, lexicon, train, 16);
  const value = loss(); history.push({ epoch: network.epochs, validationLoss: value });
  if (value < bestLoss) { best = structuredClone(network); bestLoss = value; }
}
const artifact: AttentionArtifact = { version: 1, featureVersion: ATTENTION_VERSION,
  lexiconSha256: sha(base.lexicon), corpusSha256: sha(pairs), vocabulary, network: best, threshold: 1, margin: 1 };
const groups = pairs.rows.filter(row => row.split === 'validation').map(row => {
  const { tokens, at } = tokenPosition(row.input, row.raw);
  const choices = [...new Set([row.raw.toLocaleLowerCase('az-AZ'), ...transpositionCandidates(index, row.raw)])].map(candidate => ({ candidate,
    score: attentionProbability(best, lexicon, { raw: row.raw, candidate, tokens, at }) })).sort((a, b) => b.score - a.score || a.candidate.localeCompare(b.candidate, 'az'));
  return { id: row.id, raw: row.raw.toLocaleLowerCase('az-AZ'), expected: row.expectedWord, winner: choices[0].candidate,
    supported: ambiguitySupported(lexicon, transpositionCandidates(index, row.raw), choices[0].candidate, tokens, at),
    score: choices[0].score, margin: choices[0].score - (choices[1]?.score ?? 0) };
});
let accepted = 0;
for (const margin of [0.3, 0.2, 0.15, 0.1]) for (const threshold of [0.99, 0.98, 0.95, 0.9, 0.8, 0.7, 0.6]) {
  const proposals = groups.filter(row => row.supported && row.winner !== row.raw && row.score >= threshold && row.margin >= margin);
  if (proposals.length >= 4 && proposals.every(row => row.winner === row.expected) && proposals.length > accepted) {
    artifact.threshold = threshold; artifact.margin = margin; accepted = proposals.length;
  }
}
const serialized = JSON.stringify(artifact) + '\n';
atomicWriteSync('lib/editor/neural/attention-model.json', serialized);
atomicWriteSync('data/neural/attention-training-report.json', JSON.stringify({ source: pairs.source, architecture: 'Character n-grams + learned candidate-query scaled dot-product context attention + 12-unit nonlinear ranker',
  parameters: attentionParameterCount(best), artifactBytes: Buffer.byteLength(serialized), artifactSha256: createHash('sha256').update(serialized).digest('hex'),
  corpusSha256: artifact.corpusSha256, lexiconSha256: artifact.lexiconSha256, epochs: best.epochs, trainRows: trainPairs.length,
  trainExamples: train.length, validationRows: groups.length, validationExamples: validation.length, vocabulary: Object.keys(vocabulary).length,
  bestValidationLoss: bestLoss, threshold: artifact.threshold, margin: artifact.margin, acceptedValidationCorrections: accepted,
  queryWeightChangeL1: best.query.reduce((sum, value, at) => sum + Math.abs(value - initial.query[at]), 0),
  history, audit, calibration: groups, caveat: 'Authored noisy spelling and ambiguity tasks, shared lexical families; not a pretrained LLM or a general-language accuracy guarantee.' }, null, 2) + '\n');
console.log({ parameters: attentionParameterCount(best), bytes: Buffer.byteLength(serialized), epoch: best.epochs, loss: bestLoss, accepted, threshold: artifact.threshold, margin: artifact.margin });
