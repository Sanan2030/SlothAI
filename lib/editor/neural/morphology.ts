import { dictionaryCandidates } from '../dictionary';
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

/** Spelling scores must not choose between two valid regular case endings.
 * This conservative guard covers dictionary stems outside reviewed paradigms;
 * it does not infer POS or generate a full paradigm for arbitrary loanwords. */
export function areRegularCaseAlternatives(raw: string, candidate: string): boolean {
  const input = raw.toLocaleLowerCase('az-AZ'), target = candidate.toLocaleLowerCase('az-AZ');
  if (input === target) return false;
  for (let size = 1; size <= 3; size++) {
    const stem = input.slice(0, -size);
    if (stem.length < 3 || /[aıoueəiöü]$/u.test(stem) || !target.startsWith(stem)) continue;
    const lastVowel = stem.match(/[aıoueəiöü]/gu)?.at(-1);
    if (!lastVowel || !dictionaryCandidates(stem)?.has(stem)) continue;
    const a = /[eəiöü]/u.test(lastVowel) ? 'ə' : 'a';
    const i = ({ a: 'ı', ı: 'ı', o: 'u', u: 'u', e: 'i', ə: 'i', i: 'i', ö: 'ü', ü: 'ü' } as Record<string, string>)[lastVowel];
    const endings = new Set([a, i, i + 'n', 'd' + a, 'd' + a + 'n']);
    if (endings.has(input.slice(stem.length)) && endings.has(target.slice(stem.length))) return true;
  }
  return false;
}
