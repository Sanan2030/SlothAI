import type { LemmaDictionary } from './contracts/lemma';
import type { MorphologyEngine } from './contracts/morphology';
import {
  legacyLemmaDictionary,
  legacyMorphologyEngine,
} from './adapters/legacy-language';

/**
 * Stable language-service seam.
 *
 * New lemma/morphology implementations should be swapped here instead of
 * changing correctText(), API routes, UI code, or regression fixtures.
 */
export const lemmaDictionary: LemmaDictionary = legacyLemmaDictionary;
export const morphologyEngine: MorphologyEngine = legacyMorphologyEngine;
