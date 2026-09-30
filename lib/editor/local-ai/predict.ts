import artifact from './model.json';
import { predictContext, tokenize, type LocalContextModel } from './core';

const model = artifact as LocalContextModel;

/** Index once per document; prediction reads only six neighbours on either side. */
export function createLocalPredictor(text: string): (word: string, offset: number) => string | undefined {
  const tokens = tokenize(text);
  const positions = new Map(tokens.map((token, index) => [token.start, index]));
  return (word, offset) => {
    const index = positions.get(offset);
    if (index === undefined) return undefined;
    const result = predictContext(model, word, tokens, index);
    if (!result?.accepted) return undefined;
    return /^\p{Lu}/u.test(word)
      ? result.word[0].toLocaleUpperCase('az-AZ') + result.word.slice(1) : result.word;
  };
}
