import type { LemmaDictionary } from './contracts/lemma';
import type { MorphologyEngine } from './contracts/morphology';
import type { SpellingResolver, SpellingContext } from './contracts/spelling';
import { restoreWord } from './lexicon';
import { productiveMorphology } from './productive-morphology';
import {
  legacyLemmaDictionary,
} from './adapters/legacy-language';

/**
 * Stable language-service seam.
 *
 * New lemma/morphology implementations should be swapped here instead of
 * changing correctText(), API routes, UI code, or regression fixtures.
 */
export const lemmaDictionary: LemmaDictionary = legacyLemmaDictionary;
export const morphologyEngine: MorphologyEngine = productiveMorphology;

export interface LanguageServices extends SpellingContext {
  spelling: SpellingResolver;
}

export const languageServices: LanguageServices = {
  lemmaDictionary,
  morphology: morphologyEngine,
  spelling: { resolve: restoreWord },
};
