/** Supervised binary token-gap classifier; morphology and ordered context are shared. */
import { tokenContext, tokenize, type Token } from './core';
import { legacyModelMorphology as productiveMorphology } from '../productive-morphology';
import { isFinitePredicate } from '../segmentation';

export interface BoundaryModel {
  algorithm: 'logistic-token-gap';
  weights: Record<string, number>;
  examples: number;
  positive: number;
}
export function boundaryFeatures(tokens: readonly Token[], at: number): string[] {
  const result = ['bias'];
  for (let offset = -2; offset <= 3; offset++) {
    const token = tokens[at + offset];
    if (!token) continue;
    const word = tokenContext(token).folded;
    result.push(`word:${offset}:${word}`);
    result.push(`suffix:${offset}:${word.slice(-3)}`);
    if (isFinitePredicate(token.word)) result.push(`finite:${offset}`);
    const canonical = productiveMorphology.findByFoldedForm(token.word) ?? token.word;
    const analyses = productiveMorphology.analyzeWord(canonical);
    const positions = new Set(analyses.map(item => item.pos));
    const cases = new Set(analyses.map(item => item.features.case).filter(Boolean));
    if (positions.size === 1) result.push(`pos:${offset}:${[...positions][0]}`);
    if (cases.size === 1) result.push(`case:${offset}:${[...cases][0]}`);
  }
  // A future participle followed by its noun is a single phrase, not a clause boundary.
  return result;
}
const probability = (weights: Record<string, number>, values: readonly string[]) =>
  1 / (1 + Math.exp(-Math.max(-30, Math.min(30, values.reduce((sum, feature) => sum + (weights[feature] ?? 0), 0)))));

export function trainBoundaryModel(texts: readonly string[]): BoundaryModel {
  const examples = texts.flatMap(text => {
    const tokens = tokenize(text);
    return tokens.slice(0, -1).map((left, at) => ({
      values: boundaryFeatures(tokens, at),
      target: /[.!?]/u.test(text.slice(left.end, tokens[at + 1].start)) ? 1 : 0,
    }));
  });
  const weights: Record<string, number> = {};
  for (let epoch = 0; epoch < 24; epoch++) for (const example of examples) {
    const error = example.target - probability(weights, example.values);
    const rate = 0.08 / (1 + epoch * 0.1);
    for (const feature of example.values) weights[feature] = (weights[feature] ?? 0)
      + rate * (error / Math.sqrt(example.values.length) - 0.002 * (weights[feature] ?? 0));
  }
  return { algorithm: 'logistic-token-gap', weights, examples: examples.length,
    positive: examples.filter(item => item.target === 1).length };
}
export function boundaryProbability(model: BoundaryModel, tokens: readonly Token[], at: number): number {
  return probability(model.weights, boundaryFeatures(tokens, at));
}
