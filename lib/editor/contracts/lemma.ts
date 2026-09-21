export type PartOfSpeech =
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'pronoun'
  | 'numeral'
  | 'postposition'
  | 'conjunction'
  | 'particle'
  | 'interjection'
  | 'proper-noun'
  | 'unknown';

export type LemmaSource = 'curated' | 'dictionary' | 'generated' | 'legacy';

export interface LemmaRecord {
  lemma: string;
  pos?: PartOfSpeech;
  morphClass?: string;
  frequency?: number;
  flags?: readonly string[];
  source: LemmaSource;
}

export interface LemmaLookupResult {
  query: string;
  normalized: string;
  entries: readonly LemmaRecord[];
}

export interface LemmaDictionary {
  /** Exact canonical lemma lookup. */
  getByLemma(lemma: string): LemmaRecord | undefined;

  /** Folded/diacritic-insensitive lookup. Must stay bounded and indexed. */
  findByFoldedForm(word: string): LemmaLookupResult;

  /** True only when the dictionary recognizes this exact surface form. */
  hasSurfaceForm(word: string): boolean;
}
