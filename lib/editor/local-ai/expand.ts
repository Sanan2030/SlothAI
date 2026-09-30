import { productiveMorphology } from '../productive-morphology';
import { fold, trainContextModel, type LocalContextModel } from './core';

export interface TrainingExpansion {
  forms: { lemma: string; word: string; grammaticalCase: string; texts: string[] }[];
  boundaries: { key: string; left: string; right: string; texts: string[] }[];
}

/** Preserve established ambiguity decisions while adding bounded new evidence. */
export function expandContextModel(base: LocalContextModel, expansion: TrainingExpansion): LocalContextModel {
  const texts = [...expansion.forms, ...expansion.boundaries].flatMap(item => item.texts);
  if (new Set(texts).size !== texts.length) throw new Error('Expansion training texts must be distinct.');
  const learned = trainContextModel(texts);
  const forms = { ...base.forms }, boundaries = { ...base.boundaries };
  for (const item of expansion.forms) {
    if (!productiveMorphology.analyzeWord(item.word).some(record => record.lemma === item.lemma
      && record.features.case === item.grammaticalCase)) {
      throw new Error(`Invalid morphology training label: ${item.word}`);
    }
    const key = fold(item.word), evidence = learned.forms[key];
    if (base.groups[key] || forms[key] && forms[key].word !== item.word || !evidence || evidence.word !== item.word || evidence.examples < 3) {
      throw new Error(`Unsafe or duplicate learned form: ${item.word}`);
    }
    const previous = forms[key];
    forms[key] = previous ? { word: evidence.word, examples: previous.examples + evidence.examples,
      features: Object.fromEntries([...new Set([...Object.keys(previous.features), ...Object.keys(evidence.features)])]
        .map(feature => [feature, (previous.features[feature] ?? 0) + (evidence.features[feature] ?? 0)])) } : evidence;
  }
  for (const item of expansion.boundaries) {
    const evidence = learned.boundaries[item.key];
    if (boundaries[item.key] || !evidence || evidence.positive < 3 || evidence.negative) {
      throw new Error(`Unsafe or duplicate boundary: ${item.key}`);
    }
    boundaries[item.key] = evidence;
  }
  return { ...base, forms, boundaries, trainingGroups: base.trainingGroups + texts.length };
}
