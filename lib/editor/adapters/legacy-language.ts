import { dictionaryCandidates, foldLetters } from '../dictionary';
import { regularForms } from '../morphology';
import type { LemmaDictionary, LemmaLookupResult, LemmaRecord } from '../contracts/lemma';
import type {
  GenerateFormsRequest,
  MorphologicalAnalysis,
  MorphologicalStemCandidate,
  MorphologyEngine,
} from '../contracts/morphology';

function lowerAz(value: string): string {
  return value.normalize('NFC').toLocaleLowerCase('az-AZ');
}

export class LegacyLemmaDictionaryAdapter implements LemmaDictionary {
  getByLemma(lemma: string): LemmaRecord | undefined {
    const normalized = lowerAz(lemma);
    const candidates = dictionaryCandidates(normalized);
    if (!candidates?.has(normalized)) return undefined;

    return {
      lemma: normalized,
      source: 'dictionary',
    };
  }

  findByFoldedForm(word: string): LemmaLookupResult {
    const normalized = lowerAz(word);
    const entries = [...(dictionaryCandidates(normalized) ?? [])].map<LemmaRecord>((lemma) => ({
      lemma,
      source: 'dictionary',
    }));

    return {
      query: word,
      normalized: foldLetters(normalized),
      entries,
    };
  }

  hasSurfaceForm(word: string): boolean {
    const normalized = lowerAz(word);
    return dictionaryCandidates(normalized)?.has(normalized) ?? false;
  }
}

/**
 * Compatibility adapter for the current reviewed-form generator.
 *
 * It intentionally does not pretend to recover a true lemma or suffix chain.
 * Astra/new engines can replace this implementation behind MorphologyEngine
 * without changing callers or the public editor/API contract.
 */
export class LegacyMorphologyEngineAdapter implements MorphologyEngine {
  private readonly forms = new Set(regularForms().map(lowerAz));

  analyzeWord(word: string): readonly MorphologicalAnalysis[] {
    const surface = lowerAz(word);
    if (!this.forms.has(surface)) return [];

    return [{
      surface,
      lemma: surface,
      features: {},
      source: 'legacy',
    }];
  }

  generateForms(request: GenerateFormsRequest): readonly string[] {
    const lemma = lowerAz(request.lemma);
    const limit = Math.max(1, Math.min(request.limit ?? 64, 256));

    // The legacy generator has no lemma-indexed generation contract.
    // Return only a recognized exact form; productive generation belongs
    // to the future implementation.
    return this.forms.has(lemma) ? [lemma].slice(0, limit) : [];
  }

  isValidWordForm(word: string): boolean {
    return this.forms.has(lowerAz(word));
  }

  stripSuffixes(word: string): readonly MorphologicalStemCandidate[] {
    const surface = lowerAz(word);
    return this.forms.has(surface)
      ? [{ stem: surface, removedSuffixes: [] }]
      : [];
  }
}

export const legacyLemmaDictionary = new LegacyLemmaDictionaryAdapter();
export const legacyMorphologyEngine = new LegacyMorphologyEngineAdapter();
