import { boundedCandidates } from './bounded-candidates';
import { artifactMorphology as productiveMorphology } from '../productive-morphology';
import { fold, tokenize, type Token } from '../local-ai/core';
import type { PairedModel, PairedWord } from '../local-ai/paired';
import { lexicalFeatures } from './features';
import { createNetwork, predictNetwork, trainNetworkStep, parameterCount, type Network } from './network';
export const ATTENTION_VERSION = 1;
export const CHARACTER_DIMENSIONS = 16;
const D = CHARACTER_DIMENSIONS;
export interface AttentionNetwork { version: 1; query: number[]; bias: number[]; ranker: Network; epochs: number; experiment?: { context?: 'none'; position?: 'none'; attention?: 'uniform' } }
export interface AttentionExample { raw: string; candidate: string; tokens: Token[]; at: number; y: number; group: string }
export interface AttentionArtifact { version: 1; featureVersion: number; lexiconSha256: string; corpusSha256: string;
  network: AttentionNetwork; vocabulary: Record<string, PairedWord>; threshold: number; margin: number; candidateMode?: 'folded-and-swaps' | 'bounded-edits' }
const hash = (text: string) => { let value = 2166136261; for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0; return value; };
/** Fixed character n-grams, with no subword tokenizer or downloaded embeddings. */
export function characterVector(text: string): number[] {
  const letters = [...('^' + text.normalize('NFC').toLocaleLowerCase('az-AZ') + '$')];
  const values = Array(D).fill(0);
  for (let at = 0; at < letters.length; at++) for (const size of [1, 2, 3]) {
    if (at + size > letters.length) continue;
    const key = hash(letters.slice(at, at + size).join(''));
    values[key % D] += (key & 16 ? -1 : 1) / size;
  }
  const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0)) || 1;
  return values.map(value => value / norm);
}
export function createAttentionNetwork(randomSeed = 719): AttentionNetwork {
  const seed = createNetwork(D, D, randomSeed);
  return { version: 1, query: seed.w1, bias: Array(D).fill(0), ranker: createNetwork(23 + 3 * D, 12, randomSeed + 92), epochs: 0 };
}
export function contextKeys(tokens: readonly Token[], at: number, positions = true): number[][] {
  const keys: number[][] = [];
  for (let i = Math.max(0, at - 5); i <= Math.min(tokens.length - 1, at + 5); i++) {
    if (i === at || tokens[i].sentence !== tokens[at].sentence) continue;
    const analyses = productiveMorphology.analyzeWord(tokens[i].word);
    const lemmas = new Set(analyses.filter(row => row.source === 'rule').map(row => row.lemma));
    const text = lemmas.size === 1 ? [...lemmas][0] : tokens[i].word;
    const key = characterVector(text), offset = i - at;
    // Relative position preserves left/right order that a bag of words loses.
    if (positions) {
      key[12] += Math.sign(offset) * 0.3; key[13] += offset / 10;
      key[14] += Math.sin(offset) * 0.2; key[15] += Math.cos(offset) * 0.2;
    }
    keys.push(key);
  }
  return keys.length ? keys : [Array(D).fill(0)];
}
export function attend(network: AttentionNetwork, candidate: string, keys: readonly number[][], preparedChars?: number[]) {
  const chars = preparedChars ?? characterVector(candidate);
  const query = network.experiment?.attention === 'uniform' ? Array(D).fill(0) : network.bias.map((bias, j) => chars.reduce((sum, value, i) => sum + network.query[j * D + i] * value, bias));
  const scores = keys.map(key => key.reduce((sum, value, j) => sum + value * query[j], 0) / Math.sqrt(D));
  const max = Math.max(...scores), exponentials = scores.map(score => Math.exp(score - max));
  const total = exponentials.reduce((sum, value) => sum + value, 0), weights = exponentials.map(value => value / total);
  const pooled = Array.from({ length: D }, (_, j) => keys.reduce((sum, key, at) => sum + weights[at] * key[j], 0));
  return { chars, weights, pooled };
}
type ForwardRow = Omit<AttentionExample, 'y' | 'group'>;
interface StaticFeatures { keys: number[][]; base: number[]; rawChars: number[]; candidateChars: number[] }
// Cache only weight-independent features. Query pooling and gradients remain live.
let staticCaches = new WeakMap<PairedModel, WeakMap<ForwardRow, Map<string, StaticFeatures>>>();
let keyCaches = new WeakMap<Token[], Map<string, number[][]>>();
export function clearAttentionCaches(): void { staticCaches = new WeakMap(); keyCaches = new WeakMap(); }
function forward(network: AttentionNetwork, lexicon: PairedModel, row: ForwardRow) {
  const noContext = network.experiment?.context === 'none', positions = network.experiment?.position !== 'none';
  const configuration = `${noContext}:${positions}`;
  let rows = staticCaches.get(lexicon); if (!rows) { rows = new WeakMap(); staticCaches.set(lexicon, rows); }
  let configurations = rows.get(row); if (!configurations) { configurations = new Map(); rows.set(row, configurations); }
  let prepared = configurations.get(configuration);
  if (!prepared) {
    let byPosition = keyCaches.get(row.tokens); if (!byPosition) { byPosition = new Map(); keyCaches.set(row.tokens, byPosition); }
    const keyId = `${row.at}:${positions}`;
    let keys = byPosition.get(keyId);
    if (!keys) { keys = contextKeys(row.tokens, row.at, positions); byPosition.set(keyId, keys); }
    const base = lexicalFeatures(lexicon, row.raw, row.candidate, row.tokens, row.at);
    if (noContext) { base[3] = 0; base.fill(0, 11); }
    base[2] = 0;
    prepared = { keys: noContext ? [Array(D).fill(0)] : keys, base,
      rawChars: characterVector(row.raw), candidateChars: characterVector(row.candidate) };
    configurations.set(configuration, prepared);
  }
  const attention = attend(network, row.candidate, prepared.keys, prepared.candidateChars);
  return { keys: prepared.keys, attention, x: [...prepared.base, ...prepared.rawChars, ...attention.chars, ...attention.pooled] };
}
export function attentionProbability(network: AttentionNetwork, lexicon: PairedModel, row: Omit<AttentionExample, 'y' | 'group'>): number {
  return predictNetwork(network.ranker, forward(network, lexicon, row).x);
}
export function trainAttentionStep(network: AttentionNetwork, lexicon: PairedModel, row: AttentionExample, rate: number): void {
  const { keys, attention, x } = forward(network, lexicon, row);
  const gradient = trainNetworkStep(network.ranker, x, row.y, rate, true).slice(-D);
  if (network.experiment?.attention === 'uniform') return;
  const scoreGradients = keys.map((key, at) => attention.weights[at]
    * key.reduce((sum, value, j) => sum + gradient[j] * (value - attention.pooled[j]), 0));
  const queryGradient = Array.from({ length: D }, (_, j) => keys.reduce((sum, key, at) => sum + scoreGradients[at] * key[j], 0) / Math.sqrt(D));
  for (let j = 0; j < D; j++) {
    network.bias[j] -= rate * queryGradient[j];
    for (let i = 0; i < D; i++) network.query[j * D + i] -= rate * (queryGradient[j] * attention.chars[i] + 0.0001 * network.query[j * D + i]);
  }
}
export function trainAttention(network: AttentionNetwork, lexicon: PairedModel, rows: readonly AttentionExample[], epochs: number): void {
  if (!rows.length || !Number.isInteger(epochs) || epochs < 1 || epochs > 200) throw new Error('Invalid bounded attention training.');
  for (let step = 0; step < epochs; step++) {
    const epoch = network.epochs, rate = 0.025 / (1 + epoch / 60);
    for (let at = 0; at < rows.length; at++) trainAttentionStep(network, lexicon, rows[(at + epoch * 137) % rows.length], rate);
    network.epochs++; network.ranker.epochs++;
  }
}
export const attentionParameterCount = (network: AttentionNetwork) => network.query.length + network.bias.length + parameterCount(network.ranker);
/** Local adjacency swaps only, with vocabulary learned by the existing model. */
export function transpositionIndex(lexicon: PairedModel): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const word of Object.keys(lexicon.words).sort()) {
    const values = index.get(fold(word)) ?? [];
    if (values.length < 8) values.push(word); index.set(fold(word), values);
  }
  return index;
}
export function transpositionCandidates(index: Map<string, string[]>, raw: string): string[] {
  const input = fold(raw), words = new Set<string>();
  if (!/^[a-z]{5,24}$/u.test(input)) return [];
  for (let at = 0; at < input.length - 1; at++) {
    if (input[at] === input[at + 1]) continue;
    const swapped = input.slice(0, at) + input[at + 1] + input[at] + input.slice(at + 2);
    for (const word of index.get(swapped) ?? []) words.add(word);
  }
  return [...words].slice(0, 12);
}
/** Extra direct diacritic candidates are experimental and off in production. */
export function attentionCandidates(index: Map<string, string[]>, raw: string, mode?: 'folded-and-swaps' | 'bounded-edits', lexicon?: PairedModel): string[] {
  if (mode === 'bounded-edits') {
    if (!lexicon) throw new Error('Bounded candidates require a trained lexical model.');
    return boundedCandidates(lexicon, index, raw);
  }
  const swaps = transpositionCandidates(index, raw);
  if (!mode) return swaps;
  const direct = (index.get(fold(raw)) ?? []).filter(word => word !== raw.toLocaleLowerCase('az-AZ'));
  return [...new Set([...direct, ...swaps])].slice(0, 12);
}
/** Fold-identical words need independent lexical context evidence: neural scores
 * alone can be confident because of collisions in the tiny character embedding. */
function contextLemma(word: string): string {
  const canonical = productiveMorphology.findByFoldedForm(word) ?? word;
  const lemmas = new Set(productiveMorphology.analyzeWord(canonical).filter(row => row.source === 'rule').map(row => row.lemma));
  return fold(lemmas.size === 1 ? [...lemmas][0] : word);
}
export function ambiguitySupported(lexicon: PairedModel, candidates: string[], winner: string, tokens: Token[], at: number): boolean {
  const rivals = candidates.filter(candidate => candidate !== winner && fold(candidate) === fold(winner));
  if (!rivals.length) return true;
  const context = tokens.slice(Math.max(0, at - 5), at + 6)
    .filter(token => token !== tokens[at] && token.sentence === tokens[at].sentence).map(token => contextLemma(token.word));
  const evidence = (candidate: string) => {
    const counts = new Map<string, number>();
    for (const [word, count] of Object.entries(lexicon.words[candidate]?.context ?? {})) {
      const lemma = contextLemma(word); counts.set(lemma, (counts.get(lemma) ?? 0) + count);
    }
    return counts;
  };
  const support = evidence(winner);
  // Only discriminative observations count; shared function words cannot resolve meaning.
  return rivals.every(rival => {
    const other = evidence(rival);
    const own = context.reduce((sum, word) => sum + (other.has(word) ? 0 : Math.log1p(support.get(word) ?? 0)), 0);
    const opposing = context.reduce((sum, word) => sum + (support.has(word) ? 0 : Math.log1p(other.get(word) ?? 0)), 0);
    return own > opposing;
  });
}
export function rankAttention(artifact: AttentionArtifact, lexicon: PairedModel, index: Map<string, string[]>, raw: string, tokens: Token[], at: number) {
  const candidates = attentionCandidates(index, raw, artifact.candidateMode, lexicon);
  if (!candidates.length) return undefined;
  const choices = [raw.toLocaleLowerCase('az-AZ'), ...candidates].map(candidate => ({ candidate,
    score: attentionProbability(artifact.network, lexicon, { raw, candidate, tokens, at }) })).sort((a, b) => b.score - a.score || a.candidate.localeCompare(b.candidate, 'az'));
  const winner = choices[0], margin = winner.score - (choices[1]?.score ?? 0);
  return { ...winner, margin, accepted: winner.candidate !== raw.toLocaleLowerCase('az-AZ') && winner.score >= artifact.threshold && margin >= artifact.margin && ambiguitySupported(lexicon, candidates, winner.candidate, tokens, at) };
}
export function tokenPosition(text: string, word: string): { tokens: Token[]; at: number } {
  const tokens = tokenize(text), at = tokens.findIndex(token => token.word.toLocaleLowerCase('az-AZ') === word.toLocaleLowerCase('az-AZ'));
  if (at < 0) throw new Error('Attention corpus word is absent from input.');
  return { tokens, at };
}

export function attentionLexicon(base: PairedModel, vocabulary: Record<string, PairedWord>): PairedModel {
  return { ...base, words: { ...base.words, ...vocabulary } };
}
