/** A small supervised multinomial Naive Bayes model, not a generative LLM. */
export interface Token { word: string; start: number; end: number }
export interface ClassCounts { examples: number; total: number; features: Record<string, number> }
export interface LocalContextModel {
  version: 1;
  algorithm: 'context-naive-bayes';
  groups: Record<string, Record<string, ClassCounts>>;
  trainingGroups: number;
}
export const fold = (value: string) => value.toLocaleLowerCase('az-AZ').replace(/[əıçğöşü]/gu,
  letter => ({ ə: 'e', ı: 'i', ç: 'c', ğ: 'g', ö: 'o', ş: 's', ü: 'u' })[letter]!);
export function tokenize(text: string): Token[] {
  return [...text.matchAll(/\p{L}+(?:[-’']\p{L}+)*/gu)].map(item => ({ word: item[0], start: item.index!, end: item.index! + item[0].length }));
}
export function features(tokens: readonly Token[], index: number): string[] {
  const result = new Set<string>();
  for (let offset = -6; offset <= 6; offset++) {
    const token = tokens[index + offset];
    if (!offset || !token) continue;
    const value = fold(token.word);
    // Bounded subword features share evidence across common inflections without
    // claiming a linguistic lemma; exact word boundaries stay unchanged.
    if (value.length >= 3) result.add(value.length >= 5 ? `prefix:${value.slice(0, 5)}` : value);
  }
  return [...result];
}
export function trainContextModel(texts: readonly string[]): LocalContextModel {
  const variants = new Map<string, Set<string>>();
  for (const text of texts) for (const token of tokenize(text)) {
    const key = fold(token.word), canonical = token.word.toLocaleLowerCase('az-AZ');
    if (key.length < 3) continue;
    const choices = variants.get(key) ?? new Set<string>();
    choices.add(canonical); variants.set(key, choices);
  }
  const groups: LocalContextModel['groups'] = {};
  for (const [key, choices] of variants) if (choices.size > 1) {
    groups[key] = Object.fromEntries([...choices].sort().map(choice => [choice, { examples: 0, total: 0, features: {} }]));
  }
  for (const text of texts) {
    const tokens = tokenize(text);
    tokens.forEach((token, index) => {
      const counts = groups[fold(token.word)]?.[token.word.toLocaleLowerCase('az-AZ')];
      if (!counts) return;
      counts.examples++;
      for (const feature of features(tokens, index)) {
        counts.features[feature] = (counts.features[feature] ?? 0) + 1;
        counts.total++;
      }
    });
  }
  return { version: 1, algorithm: 'context-naive-bayes', groups, trainingGroups: texts.length };
}
export interface Prediction { word: string; margin: number; supportingFeatures: number; accepted: boolean }
export function predictContext(model: LocalContextModel, raw: string, tokens: readonly Token[], index: number): Prediction | undefined {
  if (/[əıçğöşü]/iu.test(raw) || /^[A-Z]{2,}$/u.test(raw)) return undefined;
  const group = model.groups[fold(raw)];
  if (!group) return undefined;
  const entries = Object.entries(group);
  const vocabulary = new Set(entries.flatMap(([, cls]) => Object.keys(cls.features)));
  const observed = features(tokens, index).filter(feature => vocabulary.has(feature));
  const totalExamples = entries.reduce((sum, [, cls]) => sum + cls.examples, 0);
  const ranked = entries.map(([word, cls]) => ({ word, cls,
    score: Math.log((cls.examples + 1) / (totalExamples + entries.length))
      + observed.reduce((sum, feature) => sum + Math.log(((cls.features[feature] ?? 0) + 1) / (cls.total + vocabulary.size)), 0),
  })).sort((a, b) => b.score - a.score);
  const winner = ranked[0], runner = ranked[1];
  const margin = winner.score - runner.score;
  const support = observed.filter(feature => (winner.cls.features[feature] ?? 0) >= 2
    && (winner.cls.features[feature] ?? 0) > (runner.cls.features[feature] ?? 0)).length;
  return { word: winner.word, margin, supportingFeatures: support,
    // This score is evidence, not calibrated correctness probability.
    accepted: observed.length >= 2 && support >= 2 && margin >= 2 };
}
