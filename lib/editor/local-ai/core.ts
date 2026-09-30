/** A small supervised multinomial Naive Bayes model, not a generative LLM. */
import { productiveMorphology } from '../productive-morphology';
export interface Token { word: string; start: number; end: number; sentence: number }
export interface ClassCounts { examples: number; total: number; features: Record<string, number> }
export interface LocalContextModel {
  version: 3;
  algorithm: 'context-naive-bayes';
  groups: Record<string, Record<string, ClassCounts>>;
  trainingGroups: number;
  forms: Record<string, { word: string; examples: number; features: Record<string, number> }>;
  boundaries: Record<string, { positive: number; negative: number }>;
}
export const fold = (value: string) => value.toLocaleLowerCase('az-AZ').replace(/[əıçğöşü]/gu,
  letter => ({ ə: 'e', ı: 'i', ç: 'c', ğ: 'g', ö: 'o', ş: 's', ü: 'u' })[letter]!);
export function tokenize(text: string): Token[] {
  let end = 0, sentence = 0;
  return [...text.matchAll(/\p{L}+(?:[-’']\p{L}+)*/gu)].map(item => {
    if (/[.!?\n]/u.test(text.slice(end, item.index))) sentence++;
    end = item.index! + item[0].length;
    return { word: item[0], start: item.index!, end, sentence };
  });
}
export function features(tokens: readonly Token[], index: number): string[] {
  const result = new Set<string>();
  for (let offset = -6; offset <= 6; offset++) {
    const token = tokens[index + offset];
    if (!offset || !token || token.sentence !== tokens[index].sentence) continue;
    const value = fold(token.word);
    // Bounded subword features share evidence across common inflections without
    // claiming a linguistic lemma; exact word boundaries stay unchanged.
    if (value.length >= 3) {
      const lexical = value.length >= 5 ? `prefix:${value.slice(0, 5)}` : value;
      result.add(lexical);
      if (Math.abs(offset) === 1) result.add(`${offset < 0 ? 'left' : 'right'}:${lexical}`);
    }
    if (Math.abs(offset) <= 2) {
      const surface = productiveMorphology.findByFoldedForm(token.word) ?? token.word;
      const analyses = productiveMorphology.analyzeWord(surface);
      const lemmas = new Set(analyses.map(item => item.lemma));
      const positions = new Set(analyses.map(item => item.pos));
      const cases = new Set(analyses.map(item => item.features.case));
      const side = offset < 0 ? 'left' : 'right';
      if (lemmas.size === 1) result.add(`lemma:${side}:${fold([...lemmas][0])}`);
      if (positions.size === 1 && [...positions][0]) result.add(`pos:${side}:${[...positions][0]}`);
      if (cases.size === 1 && [...cases][0]) result.add(`case:${side}:${[...cases][0]}`);
    }
  }
  return [...result];
}
export function trainContextModel(texts: readonly string[]): LocalContextModel {
  const variants = new Map<string, Set<string>>();
  for (const text of texts) for (const token of tokenize(text)) {
    const key = fold(token.word), canonical = token.word.toLocaleLowerCase('az-AZ');
    if (key.length < 2) continue;
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
  const forms: LocalContextModel['forms'] = {};
  const boundaries: LocalContextModel['boundaries'] = {};
  for (const text of texts) {
    const tokens = tokenize(text), seen = new Set<string>();
    tokens.forEach((token, index) => {
      const key = fold(token.word), word = token.word.toLocaleLowerCase('az-AZ');
      if (key.length >= 3 && variants.get(key)?.size === 1 && word !== key) {
        const entry = forms[key] ?? { word, examples: 0, features: {} };
        if (!seen.has(key)) {
          entry.examples++; seen.add(key);
          for (const feature of features(tokens, index).filter(feature => !/^(?:lemma|pos|case|left|right):/u.test(feature))) {
            entry.features[feature] = (entry.features[feature] ?? 0) + 1;
          }
        }
        forms[key] = entry;
      }
      const next = tokens[index + 1];
      if (!next) return;
      const keyBoundary = boundaryKey(token.word, next.word);
      const entry = boundaries[keyBoundary] ?? { positive: 0, negative: 0 };
      if (/[.!?]/u.test(text.slice(token.end, next.start))) entry.positive++; else entry.negative++;
      boundaries[keyBoundary] = entry;
    });
  }
  for (const key of Object.keys(forms)) {
    if (forms[key].examples < 3) { delete forms[key]; continue; }
    for (const feature of Object.keys(forms[key].features)) if (forms[key].features[feature] < 2) delete forms[key].features[feature];
  }
  for (const key of Object.keys(boundaries)) if (boundaries[key].positive < 2) delete boundaries[key];
  return { version: 3, algorithm: 'context-naive-bayes', groups, forms, boundaries, trainingGroups: texts.length };
}

/** A learned suffix/start pair generalizes beyond a stored complete sentence. */
export function boundaryKey(left: string, right: string): string {
  return `${fold(left).slice(-4)}|${fold(right).slice(0, 5)}`;
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
  const support = observed.filter(feature => !/^(?:lemma|pos|case|left|right):/u.test(feature)
    && (winner.cls.features[feature] ?? 0) >= 2
    && (winner.cls.features[feature] ?? 0) > (runner.cls.features[feature] ?? 0)).length;
  return { word: winner.word, margin, supportingFeatures: support,
    // This score is evidence, not calibrated correctness probability.
    accepted: observed.length >= 2 && support >= 2 && margin >= 2 };
}
