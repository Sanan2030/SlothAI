import type { PartOfSpeech } from './lemma';

export type GrammaticalCase =
  | 'nominative'
  | 'genitive'
  | 'dative'
  | 'accusative'
  | 'locative'
  | 'ablative';

export type GrammaticalNumber = 'singular' | 'plural';
export type GrammaticalPerson = 1 | 2 | 3;
export type Polarity = 'positive' | 'negative';

export interface MorphologicalFeatures {
  case?: GrammaticalCase;
  number?: GrammaticalNumber;
  person?: GrammaticalPerson;
  possessivePerson?: GrammaticalPerson;
  possessiveNumber?: GrammaticalNumber;
  tense?: string;
  mood?: string;
  polarity?: Polarity;
  question?: boolean;
  derivation?: readonly string[];
}

export interface MorphologicalAnalysis {
  surface: string;
  lemma: string;
  pos?: PartOfSpeech;
  features: Readonly<MorphologicalFeatures>;
  source: 'legacy' | 'rule' | 'lexicon';
}

export interface GenerateFormsRequest {
  lemma: string;
  pos?: PartOfSpeech;
  features?: Readonly<MorphologicalFeatures>;
  /** Hard safety bound for future productive generators. */
  limit?: number;
}

export interface MorphologicalStemCandidate {
  stem: string;
  removedSuffixes: readonly string[];
}

export interface MorphologyEngine {
  findByFoldedForm?(word: string): string | undefined;
  analyzeWord(word: string): readonly MorphologicalAnalysis[];
  generateForms(request: GenerateFormsRequest): readonly string[];
  isValidWordForm(word: string): boolean;
  stripSuffixes(word: string): readonly MorphologicalStemCandidate[];
}
