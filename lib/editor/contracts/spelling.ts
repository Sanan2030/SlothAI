import type { LemmaDictionary } from './lemma';
import type { MorphologyEngine } from './morphology';

export interface SpellingContext {
  lemmaDictionary: LemmaDictionary;
  morphology: MorphologyEngine;
}
export interface SpellingResolver {
  resolve(word: string, context: SpellingContext): string;
}
/** Future indexed typo generators must cap their candidate set. */
export interface SpellingCandidateGenerator {
  candidates(word: string, limit: number): readonly string[];
}
