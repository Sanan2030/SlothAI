import type { MorphologyEngine, GenerateFormsRequest } from '../contracts/morphology';
import { analyzeEstablishedInflection, analyzeSourceInflection } from '../lexicon';

/** Parsed legacy suffix fallback. Unlike the old surface-as-lemma adapter,
 * returns recognized stems; POS remains unspecified if lexical evidence lacks it. */
export class VerifiedInflectionAdapter implements MorphologyEngine {
  readonly legacyEngine: MorphologyEngine;
  constructor(private readonly base: MorphologyEngine, private readonly includeSource = true) {
    this.legacyEngine = includeSource ? new VerifiedInflectionAdapter(base, false) : this;
  }
  analyzeWord(word: string) {
    const known = this.base.analyzeWord(word);
    const source = this.includeSource ? analyzeSourceInflection(word) : [];
    return known.length ? known : [...analyzeEstablishedInflection(word), ...source];
  }
  isValidWordForm(word: string): boolean { return this.base.isValidWordForm(word) || analyzeEstablishedInflection(word).length > 0 || this.includeSource && analyzeSourceInflection(word).length > 0; }
  findByFoldedForm(word: string): string | undefined { return this.base.findByFoldedForm?.(word); }
  correctMalformedForm(word: string): string | undefined { return this.base.correctMalformedForm?.(word); }
  generateForms(request: GenerateFormsRequest) { return this.base.generateForms(request); }
  stripSuffixes(word: string) { return this.analyzeWord(word).map(row => ({ stem: row.lemma,
    removedSuffixes: [word.toLocaleLowerCase('az-AZ').slice(row.lemma.length)].filter(Boolean) })); }
}
