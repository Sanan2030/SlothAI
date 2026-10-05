import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import corpus from '../data/nlp/logs/log-2026-10-05-training.json';
import posModel from '../lib/editor/local-ai/pos-model.json';
import type { POSModel } from '../lib/editor/local-ai/pos';
import { collectPairedEvidence, type CorrectionPair } from '../lib/editor/local-ai/paired';
import { fold, tokenize } from '../lib/editor/local-ai/core';
import { canonicalProtectedTerm } from '../lib/editor/protected-terminology';
import { isForeignTechnicalStem } from '../lib/editor/technical';
import { neuralCandidates, neuralIndex } from '../lib/editor/neural/features';
import { documentFeatures, type DocumentSpellingModel } from '../lib/editor/neural/document-features';
import { createNetwork, trainNetwork, predictNetwork, parameterCount, type Example } from '../lib/editor/neural/network';
import { uniqueExamples, normalizedText, similarity } from './neural-data-quality';
import { atomicWriteSync } from './atomic-files.mjs';

const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const sourcePath = 'data/nlp/logs/log-2026-10-05-training.json';
const sourceRaw = readFileSync(sourcePath, 'utf8');
const seen = new Set<string>();
for (const row of corpus.sentences) {
  if (row.split !== 'train' || row.documentId !== 'log-story-2026-10-05'
    || row.annotationStatus !== 'assistant-reviewed' || row.errorOrigin !== 'observed-user-input-name-redacted')
    throw new Error('Document fragments must remain training-only and accurately attributed.');
  if (!/^[^\n]{20,340}\.$/u.test(row.target)) throw new Error('Only individual complete sentence fragments may train this model.');
  const key = normalizedText(row.target);
  if (seen.has(key)) throw new Error('Duplicate source sentence.');
  seen.add(key);
}
for (let i = 0; i < corpus.sentences.length; i++) for (let j = i + 1; j < corpus.sentences.length; j++)
  if (similarity(corpus.sentences[i].target, corpus.sentences[j].target) >= 0.72)
    throw new Error('Near-duplicate source sentence: ' + corpus.sentences[j].id);

// The uploaded log is never read here. Only redacted sentence fragments train.
// Observed and additional synthetic variants have distinct pair IDs.
const pairs: CorrectionPair[] = [];
const pairKeys = new Set<string>();
for (const row of corpus.sentences) for (const mode of ['observed', 'identity', 'ascii', 'digraph']) {
  const input = mode === 'observed' ? row.input : mode === 'identity' ? row.target : row.target.replace(/\p{L}+/gu, word => {
    if (canonicalProtectedTerm(word) || isForeignTechnicalStem(word)) return word;
    const ascii = fold(word);
    const variant = mode === 'digraph' ? fold(word.toLocaleLowerCase('az-AZ').replace(/ş/gu, 'sh').replace(/ç/gu, 'ch').replace(/ğ/gu, 'gh')) : ascii;
    return /^\p{Lu}/u.test(word) ? variant[0].toLocaleUpperCase('az-AZ') + variant.slice(1) : variant;
  });
  const key = input + '\n' + row.target;
  if (pairKeys.has(key)) continue;
  pairKeys.add(key);
  pairs.push({ id: row.id + ':' + mode, groupId: row.documentId, split: 'train', input: input.replace(/-/gu, ' '), target: row.target.replace(/-/gu, ' ') });
}
const lexicon = collectPairedEvidence(pairs, posModel as POSModel);
for (const word of Object.keys(lexicon.words))
  if (!/^[a-zəçğıöşü]{4,24}(?:-[a-zəçğıöşü]{2,12})?$/u.test(word) || canonicalProtectedTerm(word) || isForeignTechnicalStem(word)) delete lexicon.words[word];
for (const [raw, values] of Object.entries(lexicon.edits)) {
  for (const word of Object.keys(values)) if (!lexicon.words[word]) delete values[word];
  if (!Object.keys(values).length) delete lexicon.edits[raw];
}
// No sentence/paragraph replay table or spacing rules are deployed.
lexicon.splits = {};
const index = neuralIndex(lexicon), rows: Example[] = [];
for (const pair of pairs) {
  const input = tokenize(pair.input), target = tokenize(pair.target);
  if (input.length !== target.length) throw new Error('Synthetic spelling must preserve token alignment.');
  input.forEach((token, at) => {
    const raw = token.word.toLocaleLowerCase('az-AZ'), expected = target[at].word.toLocaleLowerCase('az-AZ');
    if (!lexicon.words[expected]) return;
    for (const candidate of new Set([raw, ...neuralCandidates(lexicon, index, raw)]))
      rows.push({ x: documentFeatures(lexicon, raw, candidate, input, at), y: Number(candidate === expected) });
  });
}
const examples = uniqueExamples(rows);
if (!examples.some(row => row.y === 0) || !examples.some(row => row.y === 1)) throw new Error('Training needs both correction and preservation labels.');
const network = createNetwork(examples[0].x.length, 12, 4601);
const loss = () => examples.reduce((sum, row) => {
  const value = Math.min(1 - 1e-7, Math.max(1e-7, predictNetwork(network, row.x)));
  return sum - row.y * Math.log(value) - (1 - row.y) * Math.log(1 - value);
}, 0) / examples.length;
const initialLoss = loss();
for (let phase = 0; phase < 1; phase++) trainNetwork(network, examples, 200);
const artifact: DocumentSpellingModel = { version: 1, featureVersion: 1, corpusSHA256: sha(sourceRaw), lexicon, network,
  threshold: 0.999, margin: 0.2, minimumContext: 2 };
const compounds = [...new Set(corpus.sentences.flatMap(row => row.target.match(/[a-zəçğıöşü]+-[a-zəçğıöşü]+/gu) ?? []))];
const serialized = JSON.stringify({ ...artifact, compounds }) + '\n';
const output = process.argv.find(value => value.startsWith('--output='))?.slice(9) ?? 'lib/editor/neural/log-model.json';
atomicWriteSync(output, serialized);
const report = { sourceSHA256: sha(sourceRaw), artifactSHA256: sha(serialized), sourceSentences: corpus.sentences.length,
  sourceDocuments: 1, pairs: pairs.length, examples: examples.length, positive: examples.filter(row => row.y).length,
  vocabulary: Object.keys(lexicon.words).length, parameters: parameterCount(network), epochs: network.epochs,
  initialTrainingBCE: initialLoss, finalTrainingBCE: loss(), artifactBytes: Buffer.byteLength(serialized),
  threshold: artifact.threshold, margin: artifact.margin, minimumContext: artifact.minimumContext,
  policy: 'Fixed conservative thresholds, no test/validation threshold selection. All source fragments train-only. Assistant-reviewed observed log fragments (personal name redacted), with additional explicitly synthetic ASCII/digraph and identity examples; not human-reviewed pairs. Small candidate ranker, not a general semantic language model.' };
atomicWriteSync('data/nlp/logs/log-training-report.json', JSON.stringify(report, null, 2) + '\n');
console.log(report);
