/** Small supervised ordered-context ranker. No external API or neural-model claim. */
import { fold, tokenize, tokenContext, type Token } from './core';
import { productiveMorphology } from '../productive-morphology';

export interface SequenceClass {
  examples: number;
  weights: Record<string, number>;
  evidence: Record<string, number>;
}
export interface SequenceModel {
  algorithm: 'averaged-context-perceptron';
  groups: Record<string, Record<string, SequenceClass>>;
  trainingTexts: number;
}

/** Position matters: subject/object and distant lexical cues are distinct features. */
export function sequenceFeatures(tokens: readonly Token[], at: number): string[] {
  const result = new Set<string>(['bias']);
  const sentence = tokens[at].sentence;
  for (let offset = -32; offset <= 32; offset++) {
    const item = tokens[at + offset];
    if (!offset || !item || item.sentence !== sentence) continue;
    const word = tokenContext(item).folded;
    const side = offset < 0 ? 'before' : 'after';
    if (word.length >= 3) result.add(`context:${side}:${word}`);
    if (Math.abs(offset) <= 3) {
      result.add(`word:${offset}:${word}`);
      const surface = productiveMorphology.findByFoldedForm(item.word) ?? item.word;
      const analyses = productiveMorphology.analyzeWord(surface);
      const values = new Set(analyses.map(value => value.lemma + ':' + value.pos + ':' + (value.features.case ?? value.features.tense ?? '')));
      if (values.size === 1) result.add(`grammar:${offset}:${[...values][0]}`);
    }
  }
  return [...result];
}

const score = (cls: SequenceClass, observed: readonly string[]) =>
  observed.reduce((sum, feature) => sum + (cls.weights[feature] ?? 0), 0);

export function trainSequenceRanker(texts: readonly string[]): SequenceModel {
  const variants = new Map<string, Set<string>>();
  const documents = texts.map(tokenize);
  for (const tokens of documents) for (const token of tokens) {
    const key = fold(token.word), word = token.word.toLocaleLowerCase('az-AZ');
    const choices = variants.get(key) ?? new Set<string>();
    choices.add(word); variants.set(key, choices);
  }
  const groups: SequenceModel['groups'] = {};
  for (const [key, words] of variants) if (words.size > 1) {
    groups[key] = Object.fromEntries([...words].sort().map(word => [word, { examples: 0, weights: {}, evidence: {} }]));
  }
  const examples: { key: string; target: string; observed: string[] }[] = [];
  for (const tokens of documents) tokens.forEach((token, at) => {
    const key = fold(token.word), target = token.word.toLocaleLowerCase('az-AZ');
    const cls = groups[key]?.[target];
    if (!cls) return;
    const observed = sequenceFeatures(tokens, at);
    examples.push({ key, target, observed }); cls.examples++;
    for (const feature of observed) cls.evidence[feature] = (cls.evidence[feature] ?? 0) + 1;
  });
  const totals: Record<string, Record<string, Record<string, number>>> = {};
  let steps = 0;
  for (let epoch = 0; epoch < 16; epoch++) for (const example of examples) {
    const entries = Object.entries(groups[example.key]);
    const winner = entries.map(([word, cls]) => ({ word, score: score(cls, example.observed) }))
      .sort((a, b) => b.score - a.score || (a.word < b.word ? -1 : a.word > b.word ? 1 : 0))[0];
    if (winner.word !== example.target) for (const [word, change] of [[example.target, 1], [winner.word, -1]] as const) {
      for (const feature of example.observed) {
        const cls = groups[example.key][word];
        cls.weights[feature] = (cls.weights[feature] ?? 0) + change;
      }
    }
    // Average at epoch boundaries; deterministic and compact, no browser training.
    steps++;
    if (steps % Math.max(1, examples.length) === 0) for (const [key, group] of Object.entries(groups)) {
      for (const [word, cls] of Object.entries(group)) {
        totals[key] ??= {}; totals[key][word] ??= {};
        for (const [feature, weight] of Object.entries(cls.weights)) {
          totals[key][word][feature] = (totals[key][word][feature] ?? 0) + weight;
        }
      }
    }
  }
  for (const [key, group] of Object.entries(groups)) for (const [word, cls] of Object.entries(group)) {
    cls.weights = Object.fromEntries(Object.entries(totals[key]?.[word] ?? {}).map(([feature, total]) => [feature, total / 16]));
  }
  return { algorithm: 'averaged-context-perceptron', groups, trainingTexts: texts.length };
}

export function predictSequence(model: SequenceModel, tokens: readonly Token[], at: number): string | undefined {
  const raw = tokens[at].word;
  if (/[əıçğöşü]/iu.test(raw) || /^[A-Z]{2,}$/u.test(raw)) return undefined;
  const group = model.groups[fold(raw)];
  if (!group) return undefined;
  const observed = sequenceFeatures(tokens, at);
  const ranked = Object.entries(group).map(([word, cls]) => ({ word, cls, score: score(cls, observed) }))
    .sort((a, b) => b.score - a.score);
  const [winner, runner] = ranked;
  const support = observed.filter(feature => feature.startsWith('context:')
    && (winner.cls.evidence[feature] ?? 0) >= 2
    && (winner.cls.evidence[feature] ?? 0) > (runner.cls.evidence[feature] ?? 0)).length;
  // This is an evidence margin, not a calibrated probability.
  return support >= 2 && winner.score - runner.score >= 3 ? winner.word : undefined;
}
