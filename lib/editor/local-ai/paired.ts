/** Supervised token-edit ranking. Complete input/target pairs are never replayed. */
import { fold, tokenize, type Token } from './core';
import { boundedEditDistance } from '../spelling-candidates';
import { canonicalProtectedTerm } from '../protected-terminology';
import { dictionaryCandidates } from '../dictionary';
import { productiveMorphology } from '../productive-morphology';
import { tagPOS, type POSModel } from './pos';

export interface CorrectionPair { id: string; groupId: string; input: string; target: string; split: string }
export interface PairedWord { count: number; context: Record<string, number>; pos: string[] }
export interface PairedModel {
  version: 1; algorithm: 'supervised-token-edit-logistic';
  words: Record<string, PairedWord>; edits: Record<string, Record<string, number>>;
  channels: Record<string, number>; splits: Record<string, { target: string; count: number }>;
  weights: number[]; threshold: number; margin: number;
  calibration: { samples: number; accepted: number; correct: number; precision: number | null };
}
export const wordLower = (word: string) => word.normalize('NFC').toLocaleLowerCase('az-AZ');
export const normalizeDigraphs = (word: string) => word.replace(/sh/gu, 'ş').replace(/ch/gu, 'ç').replace(/gh/gu, 'ğ');
export function editChannels(raw: string, target: string): string[] {
  const left = fold(raw), right = fold(target);
  const d = Array.from({ length: left.length + 1 }, (_, i) => Array.from({ length: right.length + 1 }, (_, j) => i ? j ? 0 : i : j));
  for (let i = 1; i <= left.length; i++) for (let j = 1; j <= right.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + Number(left[i - 1] !== right[j - 1]));
  }
  let i = left.length, j = right.length; const result: string[] = [];
  while (i || j) {
    if (i && j && d[i][j] === d[i - 1][j - 1] + Number(left[i - 1] !== right[j - 1])) {
      if (left[i - 1] !== right[j - 1]) result.push(`sub:${left[i - 1]}>${right[j - 1]}`);
      i--; j--;
    } else if (i && d[i][j] === d[i - 1][j] + 1) { result.push(`remove:${left[i - 1]}`); i--; }
    else { result.push(`insert:${right[j - 1]}`); j--; }
  }
  return result;
}
export function alignTokens(pair: CorrectionPair, maximumDistance = 2): { raw: string; target: string; at: number; targetAt: number }[] {
  const source = tokenize(pair.input), target = tokenize(pair.target);
  const d = Array.from({ length: source.length + 1 }, (_, i) => Array.from({ length: target.length + 1 }, (_, j) => i ? j ? 0 : i : j));
  for (let i = 1; i <= source.length; i++) for (let j = 1; j <= target.length; j++) {
    const equal = fold(normalizeDigraphs(wordLower(source[i - 1].word))) === fold(target[j - 1].word);
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + Number(!equal));
  }
  let i = source.length, j = target.length; const rows: { raw: string; target: string; at: number; targetAt: number }[] = [];
  while (i || j) {
    if (i && j) {
      const equal = fold(normalizeDigraphs(wordLower(source[i - 1].word))) === fold(target[j - 1].word);
      if (d[i][j] === d[i - 1][j - 1] + Number(!equal)) {
        const raw = wordLower(source[i - 1].word), canonical = wordLower(target[j - 1].word);
        if (boundedEditDistance(fold(normalizeDigraphs(raw)), fold(canonical), maximumDistance) <= maximumDistance) rows.push({ raw, target: canonical, at: i - 1, targetAt: j - 1 });
        i--; j--; continue;
      }
    }
    if (i && d[i][j] === d[i - 1][j] + 1) i--; else j--;
  }
  return rows.reverse();
}
const signatures = (word: string) => [...new Set([word, ...[...word].map((_, at) => word.slice(0, at) + word.slice(at + 1))])];
export function candidateIndex(model: PairedModel): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const word of Object.keys(model.words).sort((a, b) => model.words[b].count - model.words[a].count || a.localeCompare(b, 'az'))) {
    if (!/^[\p{L}]{3,25}$/u.test(word) || canonicalProtectedTerm(word)) continue;
    for (const signature of signatures(fold(word))) {
      const bucket = index.get(signature) ?? [];
      if (bucket.length < 32 && !bucket.includes(word)) bucket.push(word);
      index.set(signature, bucket);
    }
  }
  return index;
}
export function pairedCandidates(model: PairedModel, index: Map<string, string[]>, raw: string): string[] {
  const input = wordLower(raw), normalized = fold(normalizeDigraphs(input));
  const found = new Set(Object.keys(model.edits[input] ?? {}));
  const transpositions = [...normalized].slice(0, -1).map((_, at) => normalized.slice(0, at) + normalized[at + 1] + normalized[at] + normalized.slice(at + 2));
  for (const key of [...signatures(normalized), ...transpositions]) for (const word of index.get(key) ?? []) {
    if (boundedEditDistance(normalized, fold(word), 2) <= 1 || transpositions.includes(fold(word))) found.add(word);
  }
  return [...found].filter(word => word !== input && !canonicalProtectedTerm(word)).slice(0, 32);
}
function contextWords(tokens: readonly Token[], at: number): string[] {
  return tokens.slice(Math.max(0, at - 5), at + 6).filter(token => token !== tokens[at] && token.sentence === tokens[at].sentence)
    .map(token => fold(normalizeDigraphs(wordLower(token.word))));
}
export function pairedFeatures(model: PairedModel, raw: string, candidate: string, tokens: readonly Token[], at: number, pos?: string): number[] {
  const input = wordLower(raw), word = model.words[candidate];
  const context = contextWords(tokens, at);
  const evidence = context.filter(value => (word?.context[value] ?? 0) >= 2);
  const observed = model.edits[input]?.[candidate] ?? 0;
  const normalized = fold(normalizeDigraphs(input)), target = fold(candidate);
  const distance = boundedEditDistance(normalized, target, 2);
  const channels = editChannels(normalizeDigraphs(input), candidate);
  return [1, -distance, Math.min(4, Math.log1p(observed)), Math.min(4, evidence.length),
    Math.min(4, Math.log1p(word?.count ?? 0)),
    channels.length ? channels.filter(channel => (model.channels[channel] ?? 0) >= 2).length / channels.length : 1,
    Number(pos !== undefined && word?.pos.includes(pos)),
    Number(productiveMorphology.isValidWordForm(candidate)), Number(normalized === target)];
}
const sigmoid = (score: number) => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, score))));
export const pairedProbability = (model: PairedModel, values: number[]) => sigmoid(values.reduce((sum, value, at) => sum + value * (model.weights[at] ?? 0), 0));
export interface PairedDecision { word: string; probability: number; margin: number; supportingContext: number; accepted: boolean }
export function rankPaired(model: PairedModel, index: Map<string, string[]>, raw: string, tokens: readonly Token[], at: number, pos?: string): PairedDecision | undefined {
  const input = wordLower(raw);
  if (!/^[\p{L}]{3,25}$/u.test(input) || canonicalProtectedTerm(raw) || /^[\p{Lu}\d_]+$/u.test(raw)
    || /\p{Ll}\p{Lu}/u.test(raw)) return;
  // A valid surface is preserved; this ranker repairs misspellings, not meaning.
  if (dictionaryCandidates(input)?.has(input) || productiveMorphology.isValidWordForm(input)) return;
  const context = contextWords(tokens, at);
  const ranked = pairedCandidates(model, index, input).map(word => {
    const values = pairedFeatures(model, input, word, tokens, at, pos);
    return { word, probability: pairedProbability(model, values),
      support: context.filter(value => (model.words[word]?.context[value] ?? 0) >= 2).length };
  }).sort((a, b) => b.probability - a.probability || a.word.localeCompare(b.word, 'az'));
  const winner = ranked[0]; if (!winner) return;
  const margin = winner.probability - (ranked[1]?.probability ?? 0);
  const learned = model.edits[input]?.[winner.word] ?? 0;
  // Explicit accents remain evidence; known corrupted inputs can be corrected.
  const accentedConflict = input.length === winner.word.length && [...input].some((letter, i) => /[əıçğöşü]/u.test(letter) && winner.word[i] !== letter);
  const plausible = (fold(input) !== fold(winner.word) || /(?:sh|ch|gh)/u.test(input)) && (!accentedConflict || learned >= 3) && (learned >= 2 || winner.support >= 2);
  return { word: winner.word, probability: winner.probability, margin, supportingContext: winner.support,
    accepted: plausible && winner.probability >= model.threshold && margin >= model.margin };
}
export function trainPaired(pairs: readonly CorrectionPair[], posModel: POSModel): PairedModel {
  if (pairs.some(pair => pair.split !== 'train')) throw new Error('Only training pairs may reach the paired trainer.');
  const model: PairedModel = { version: 1, algorithm: 'supervised-token-edit-logistic', words: {}, edits: {}, channels: {}, splits: {}, weights: Array(9).fill(0), threshold: 1, margin: 0.15,
    calibration: { samples: 0, accepted: 0, correct: 0, precision: null } };
  const knownTexts = new Set<string>();
  const ambiguousSplits = new Set<string>();
  for (const pair of pairs) {
    const tokens = tokenize(pair.target), positions = tagPOS(posModel, tokens.map(token => token.word));
    if (!knownTexts.has(pair.target)) {
      knownTexts.add(pair.target);
      tokens.forEach((token, at) => {
        const word = wordLower(token.word); if (canonicalProtectedTerm(word) || (posModel.words[word]?.PROPN && Object.keys(posModel.words[word]).length === 1)) return;
        const entry = model.words[word] ?? { count: 0, context: {}, pos: [] };
        entry.count++; entry.pos = [...new Set([...entry.pos, positions[at].tag])];
        for (const value of contextWords(tokens, at)) entry.context[value] = (entry.context[value] ?? 0) + 1;
        model.words[word] = entry;
      });
    }
    for (const row of alignTokens(pair)) if (row.raw !== row.target && model.words[row.target]) {
      model.edits[row.raw] ??= {}; model.edits[row.raw][row.target] = (model.edits[row.raw][row.target] ?? 0) + 1;
      for (const channel of editChannels(normalizeDigraphs(row.raw), row.target)) model.channels[channel] = (model.channels[channel] ?? 0) + 1;
    }
    // Spacing is learned only from aligned lexical concatenations, never full replies.
    for (let at = 0; at < tokens.length - 1; at++) {
      const joined = fold(tokens[at].word + tokens[at + 1].word);
      if (tokenize(pair.input).some(token => fold(token.word) === joined)) {
        const target = wordLower(tokens[at].word + ' ' + tokens[at + 1].word);
        const entry = model.splits[joined];
        if (entry && entry.target !== target) { ambiguousSplits.add(joined); delete model.splits[joined]; }
        else if (!ambiguousSplits.has(joined)) model.splits[joined] = { target, count: (entry?.count ?? 0) + 1 };
      }
    }
  }
  const index = candidateIndex(model);
  const examples: { values: number[]; target: number }[] = [];
  for (const pair of pairs) {
    const tokens = tokenize(pair.input), positions = tagPOS(posModel, tokens.map(token => normalizeDigraphs(wordLower(token.word))));
    for (const row of alignTokens(pair)) {
      if (row.raw === row.target || !model.words[row.target]) continue;
      const candidates = pairedCandidates(model, index, row.raw);
      if (!candidates.includes(row.target)) continue;
      for (const candidate of candidates.slice(0, 12)) examples.push({ values: pairedFeatures(model, row.raw, candidate, tokens, row.at, positions[row.at]?.tag), target: Number(candidate === row.target) });
    }
  }
  for (let epoch = 0; epoch < 30; epoch++) {
    // Deterministic cyclic ordering avoids relying on dataset class blocks.
    for (let k = 0; k < examples.length; k++) {
      const example = examples[(k + epoch * 17) % examples.length];
      const error = example.target - pairedProbability(model, example.values);
      for (let at = 0; at < model.weights.length; at++) model.weights[at] += 0.015 / (1 + epoch * 0.1)
        * (error * example.values[at] - 0.002 * model.weights[at]);
      // Linguistically monotonic evidence prevents small/template datasets from
      // learning to prefer larger edit distance or penalize valid morphology.
      model.weights[1] = Math.max(0, model.weights[1]);
      for (let at = 2; at < model.weights.length; at++) model.weights[at] = Math.max(0, model.weights[at]);
    }
  }
  return model;
}
