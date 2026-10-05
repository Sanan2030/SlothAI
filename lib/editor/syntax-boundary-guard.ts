import { tokenize } from './local-ai/core';
import { productiveMorphology } from './productive-morphology';

/** Shared veto for proposals from all legacy and learned boundary stages.
 * This is a conservative POS/morphology constraint, not a dependency parser or
 * semantic model. Existing author punctuation is never removed. */
export function guardInsertedBoundaries(source: string, proposed: string): string {
  const before = tokenize(source), after = tokenize(proposed);
  if (before.length !== after.length || before.some((token, at) => token.word !== after[at].word)) return proposed;
  const remove = new Set<number>();
  for (let at = 0; at < after.length - 1; at++) {
    const gap = proposed.slice(after[at].end, after[at + 1].start);
    if (!/[.!?]/u.test(gap) || /[.!?\n]/u.test(source.slice(before[at].end, before[at + 1].start))) continue;
    const word = after[at].word, left = productiveMorphology.analyzeWord(word), right = productiveMorphology.analyzeWord(after[at + 1].word);
    const finite = left.some(row => row.pos === 'verb' && row.features.tense && !row.features.mood
      || row.features.derivation?.some(value => value.startsWith('copula-')));
    const nonPredicate = !/^(?:var|yox|deyil)$/iu.test(word) && left.length > 0 && left.every(row => row.pos !== 'verb') && !finite;
    const unknownPast = !left.length && /(?:dı|di|du|dü)$/iu.test(word)
      && right.some(row => row.pos === 'noun' && row.features.case === 'genitive');
    if (nonPredicate || unknownPast) {
      for (let offset = after[at].end; offset < after[at + 1].start; offset++) if (/[.!?]/u.test(proposed[offset])) remove.add(offset);
    }
  }
  return proposed.split('').filter((_, at) => !remove.has(at)).join('');
}
