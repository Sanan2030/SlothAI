/** Paired boundary learning and conservative lexical/segmentation feedback. */
import { fold, tokenize, type Token } from './core';
import { alignTokens, type CorrectionPair } from './paired';
import { productiveMorphology } from '../productive-morphology';
import { createBoundaryContext } from './clause-context';
export interface JointBoundaryModel { version: 1; weights: Record<string, number>; threshold: number;
  examples: number; positives: number; validation: { accepted: number; correct: number; total: number } }
function values(tokens: readonly Token[], at: number): string[] {
  const output = ['bias'];
  for (let offset = -1; offset <= 2; offset++) {
    const token = tokens[at + offset]; if (!token) continue;
    const word = fold(token.word);
    output.push(`word:${offset}:${word}`, `ending:${offset}:${word.slice(-3)}`);
    const records = productiveMorphology.analyzeWord(token.word);
    for (const pos of new Set(records.map(row => row.pos).filter(Boolean))) output.push(`pos:${offset}:${pos}`);
    for (const grammaticalCase of new Set(records.map(row => row.features.case).filter(Boolean))) output.push(`case:${offset}:${grammaticalCase}`);
    if (records.some(row => row.pos === 'verb' && row.features.tense)) output.push(`finite:${offset}`);
  }
  return output;
}
export function jointProbability(model: JointBoundaryModel, tokens: readonly Token[], at: number): number {
  const score = values(tokens, at).reduce((sum, value) => sum + (model.weights[value] ?? 0), 0);
  return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, score))));
}
export function alignedGaps(pair: CorrectionPair): { tokens: Token[]; at: number; target: number }[] {
  const tokens = tokenize(pair.input), target = tokenize(pair.target);
  const aligned = alignTokens(pair);
  const mapped = new Map(aligned.map(row => [row.at, row.targetAt]));
  const rows: { tokens: Token[]; at: number; target: number }[] = [];
  for (let at = 0; at < tokens.length - 1; at++) {
    const left = mapped.get(at), right = mapped.get(at + 1);
    if (left === undefined || right !== left + 1) continue;
    rows.push({ tokens, at, target: Number(/[.!?]/u.test(pair.target.slice(target[left].end, target[right].start))) });
  }
  return rows;
}
export function trainJointBoundary(pairs: readonly CorrectionPair[], validation: readonly CorrectionPair[]): JointBoundaryModel {
  if (pairs.some(pair => pair.split !== 'train') || validation.some(pair => pair.split !== 'validation')) throw new Error('Invalid boundary training split.');
  const rows = pairs.flatMap(alignedGaps);
  const examples = rows.map(row => ({ features: values(row.tokens, row.at), target: row.target }));
  const model: JointBoundaryModel = { version: 1, weights: {}, threshold: 1, examples: examples.length,
    positives: examples.filter(row => row.target).length, validation: { accepted: 0, correct: 0, total: 0 } };
  for (let epoch = 0; epoch < 24; epoch++) for (let index = 0; index < examples.length; index++) {
    const row = examples[(index + epoch * 17) % examples.length];
    const score = row.features.reduce((sum, feature) => sum + (model.weights[feature] ?? 0), 0);
    const error = row.target - 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, score))));
    for (const feature of row.features) model.weights[feature] = (model.weights[feature] ?? 0)
      + 0.04 / (1 + epoch * 0.1) * (error / Math.sqrt(row.features.length) - 0.001 * (model.weights[feature] ?? 0));
  }
  const observed = validation.flatMap(alignedGaps).map(row => ({ ...row, probability: jointProbability(model, row.tokens, row.at) }));
  for (const threshold of [0.9999, 0.999, 0.995, 0.99, 0.98, 0.95]) {
    const accepted = observed.filter(row => row.probability >= threshold);
    const correct = accepted.filter(row => row.target === 1).length;
    if (accepted.length >= 5 && correct === accepted.length && accepted.length > model.validation.accepted) {
      model.threshold = threshold; model.validation = { accepted: accepted.length, correct, total: observed.length };
    }
  }
  return model;
}
/** Infer virtual contexts without altering the original positions or markup. */
export function jointContextTokens(text: string, normalize: (word: string) => string, model: JointBoundaryModel): Token[] {
  const original = tokenize(text), canonical = original.map(token => ({ ...token, word: normalize(token.word) }));
  const independent = createBoundaryContext(canonical);
  let sentence = 0;
  return original.map((token, at) => {
    if (at && original[at - 1].sentence !== token.sentence) sentence++;
    const output = { ...token, sentence };
    if (at < original.length - 1 && /^ +$/u.test(text.slice(token.end, original[at + 1].start))
      && independent(at) && safePredicate(canonical[at].word) && jointProbability(model, canonical, at) >= model.threshold) sentence++;
    return output;
  });
}
export function safePredicate(word: string): boolean {
  const rows = productiveMorphology.analyzeWord(word);
  return rows.some(row => row.pos === 'verb' && row.features.tense && row.features.mood !== 'participle')
    && !rows.some(row => row.pos === 'noun') && !/(?:ıb|ib|ub|üb)$/iu.test(word);
}
export function insertJointBoundaries(text: string, model: JointBoundaryModel): string {
  const tokens = tokenize(text), independent = createBoundaryContext(tokens); let output = '', cursor = 0;
  for (let at = 0; at < tokens.length - 1; at++) {
    const left = tokens[at], right = tokens[at + 1];
    if (!/^ +$/u.test(text.slice(left.end, right.start)) || !independent(at) || !safePredicate(left.word)
      || jointProbability(model, tokens, at) < model.threshold) continue;
    output += text.slice(cursor, left.end) + '.'; cursor = left.end;
  }
  return output + text.slice(cursor);
}
