import { safePredicate } from './joint-boundary';
import { createBoundaryContext } from './clause-context';
import { boundaryProbability } from './boundary-model';
import { predictSequence } from './sequence';
import artifact from './model.json';
import { predictContext, tokenize, features, fold, boundaryKey, type LocalContextModel, type Token } from './core';
import { isFinitePredicate } from '../segmentation';

const model = artifact as LocalContextModel;

/** Index once per document; prediction reads only six neighbours on either side. */
export function createLocalPredictor(text: string, contextTokens?: Token[]): (word: string, offset: number) => string | undefined {
  const tokens = contextTokens ?? tokenize(text);
  const positions = new Map(tokens.map((token, index) => [token.start, index]));
  return (word, offset) => {
    const index = positions.get(offset);
    if (index === undefined) return undefined;
    const result = predictContext(model, word, tokens, index);
    let selected = (model.sequence ? predictSequence(model.sequence, tokens, index) : undefined)
      ?? (result?.accepted ? result.word : undefined);
    if (!selected && !model.groups[fold(word)] && !/[əıçğöşü]/iu.test(word) && !/^[A-Z]{2,}$/u.test(word)) {
      const form = model.forms[fold(word)];
      const support = form && features(tokens, index).filter(feature => !/^(?:lemma|pos|case|left|right):/u.test(feature)
        && (form.features[feature] ?? 0) >= 2).length;
      if (form && support && support >= 2) selected = form.word;
    }
    if (!selected) return undefined;
    return /^\p{Lu}/u.test(word)
      ? selected[0].toLocaleUpperCase('az-AZ') + selected.slice(1) : selected;
  };
}

/** Insert only repeatedly observed boundaries; existing punctuation wins. */
export function insertLearnedBoundaries(text: string): string {
  const tokens = tokenize(text);
  const positions: number[] = [];
  const independent = createBoundaryContext(tokens);
  for (let index = 0; index < tokens.length - 1; index++) {
    const left = tokens[index], right = tokens[index + 1];
    if (!/^ +$/u.test(text.slice(left.end, right.start)) || !isFinitePredicate(left.word)) continue;
    if (!independent(index) || !safePredicate(left.word) && !/(?:ıb|ib|ub|üb)$/iu.test(left.word)) continue;
    const evidence = model.boundaries[boundaryKey(left.word, right.word)];
    const learned = model.boundaryClassifier && boundaryProbability(model.boundaryClassifier, tokens, index) >= 0.98;
    if ((evidence && evidence.positive >= 2 && evidence.negative === 0) || learned) positions.push(left.end);
  }
  let output = '', cursor = 0;
  for (const position of positions) { output += text.slice(cursor, position) + '.'; cursor = position; }
  return output + text.slice(cursor);
}
