import artifact from './model.json';
import { dictionaryCandidates } from '../dictionary';
import { BrowserWordLM } from './core';

let model: BrowserWordLM | undefined;
/** Caller preserves established words, entities, literal spans and prior rule decisions. */
export function chooseWordLMSpelling(word: string, left: readonly string[], right: readonly string[]): string | undefined {
  // Case, explicit accents and non-ASCII words are evidence of the author's intent.
  if (!/^[a-z]{3,24}$/.test(word)) return undefined;
  const candidates = [...(dictionaryCandidates(word) ?? [])];
  if (candidates.includes(word) || candidates.length < 2 || candidates.length > 8) return undefined;
  model ??= new BrowserWordLM(artifact);
  const ranked = model.rank(left, candidates, right);
  const [first, second] = ranked;
  // Fixed conservative engineering guard, not a fitted noisy-channel lambda.
  if (!first.evidence || !Number.isFinite(first.score) || !Number.isFinite(second.score)
    || first.score - second.score < Math.log(20)) return undefined;
  return first.word;
}
