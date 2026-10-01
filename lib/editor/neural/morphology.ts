import { productiveMorphology } from '../productive-morphology';
import type { GenerateFormsRequest } from '../contracts/morphology';
/** Correct the legacy generator's duplicated past 2PL vowel at this new seam.
 * Existing model feature vocabulary stays frozen; neural teacher labels are standard forms. */
export function finiteAnalyses(word: string) {
  const rows = productiveMorphology.analyzeWord(word);
  if (rows.length) return rows;
  const legacy = word.replace(/d([ıiuü])n\1z$/iu, 'd$1$1n$1z');
  return legacy === word ? [] : productiveMorphology.analyzeWord(legacy).map(row => ({ ...row, surface: word }));
}
export function agreementForms(request: GenerateFormsRequest): string[] {
  return [...new Set(productiveMorphology.generateForms(request).map(word =>
    request.features?.tense === 'past' && request.features.person === 2 && request.features.number === 'plural'
      ? word.replace(/d([ıiuü])\1n\1z$/iu, 'd$1n$1z') : word))];
}
