import artifact from './model.json';
import { dictionaryCandidates } from '../dictionary';
import { BrowserWordLM } from './core';

let model: BrowserWordLM | undefined;
export function rankWordLM(left: readonly string[], candidates: readonly string[], right: readonly string[]) {
  model ??= new BrowserWordLM(artifact);
  return model.rank(left, candidates, right);
}
/** An OOV class represents many surfaces. A single unseen spelling must not
 * receive the entire class mass when competing with a known surface. */
export function wordLMSurfacePenalty(word: string): number {
  model ??= new BrowserWordLM(artifact);
  return model.hasWord(word) ? 0 : Math.log(model.vocabularySize);
}
/** Caller preserves established words, entities, literal spans and prior rule decisions. */
export function chooseWordLMSpelling(word: string, left: readonly string[], right: readonly string[]): string | undefined {
  // Case, explicit accents and non-ASCII words are evidence of the author's intent.
  if (!/^[a-z]{3,24}$/.test(word)) return undefined;
  const candidates = [...(dictionaryCandidates(word) ?? [])];
  if (candidates.includes(word) || candidates.length < 2 || candidates.length > 8) return undefined;
  const ranked = rankWordLM(left, candidates, right);
  const [first, second] = ranked;
  // Fixed conservative engineering guard, not a fitted noisy-channel lambda.
  if (!first.evidence || !Number.isFinite(first.score) || !Number.isFinite(second.score)
    || first.score - second.score < Math.log(20)) return undefined;
  return first.word;
}
