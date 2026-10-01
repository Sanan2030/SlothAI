import artifact from './paired-model.json';
import posArtifact from './pos-model.json';
import { candidateIndex, rankPaired, normalizeDigraphs, wordLower, type PairedModel } from './paired';
import { tagPOS, type POSModel } from './pos';
import { tokenize } from './core';
import { canonicalProtectedTerm } from '../protected-terminology';
import { dictionaryCandidates } from '../dictionary';
const model = artifact as PairedModel;
const index = candidateIndex(model);

/** One context/POS pass per protected document, bounded to sentence/chunk scope. */
export function createPairedPredictor(text: string): (raw: string, offset: number) => string | undefined {
  const tokens = tokenize(text);
  const byOffset = new Map(tokens.map((token, at) => [token.start, at]));
  const tags: string[] = [];
  let start = 0;
  while (start < tokens.length) {
    let end = start + 1;
    while (end < tokens.length && end - start < 64 && tokens[end].sentence === tokens[start].sentence) end++;
    const output = tagPOS(posArtifact as POSModel, tokens.slice(start, end).map(token => normalizeDigraphs(wordLower(token.word))));
    output.forEach((value, at) => { tags[start + at] = value.tag; }); start = end;
  }
  return (raw, offset) => {
    const at = byOffset.get(offset); if (at === undefined || canonicalProtectedTerm(raw)) return;
    const lower = wordLower(raw), split = model.splits[lower];
    if (split && split.count >= 3 && !dictionaryCandidates(lower)?.has(lower)) return split.target;
    const result = rankPaired(model, index, raw, tokens, at, tags[at]);
    if (!result?.accepted) return;
    return /^\p{Lu}/u.test(raw) ? result.word[0].toLocaleUpperCase('az-AZ') + result.word.slice(1) : result.word;
  };
}
