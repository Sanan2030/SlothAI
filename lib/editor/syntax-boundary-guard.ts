import { tokenize } from './local-ai/core';
import { productiveMorphology } from './productive-morphology';
import { SourceInflectionEngine } from './source-inflection';
import { dictionaryCandidates } from './dictionary';

const sourceNouns = new SourceInflectionEngine(surface => dictionaryCandidates(surface)?.has(surface) === true);

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
    const word = after[at].word;
    const left = productiveMorphology.analyzeWord(word);
    const right = productiveMorphology.analyzeWord(after[at + 1].word);
    const finite = left.some(row => row.pos === 'verb' && row.features.tense && !row.features.mood
      || row.features.derivation?.some(value => value.startsWith('copula-')));
    const nonPredicate = !/^(?:var|yox|deyil)$/iu.test(word) && left.length > 0 && left.every(row => row.pos !== 'verb') && !finite;
    const unknownPast = !left.length && /(?:dı|di|du|dü)$/iu.test(word)
      && right.some(row => row.pos === 'noun' && row.features.case === 'genitive');
    const following = after[at + 2] ? sourceNouns.analyze(after[at + 2].word) : [];
    const rightExtended = [...right, ...sourceNouns.analyze(after[at + 1].word)];
    const participialModifier = /(?:mış|miş|muş|müş|acaq|əcək)$/iu.test(word)
      && (rightExtended.some(row => row.pos === 'noun' && row.features.case === 'genitive')
        || /(?:mış|miş|muş|müş)$/iu.test(word) && rightExtended.some(row => row.pos === 'adjective') && following.some(row => row.pos === 'noun'));
    const nominalOrdinal = sourceNouns.analyze(word).some(row => row.pos === 'noun' && row.features.possessivePerson === 3)
      && /^(?:birinci|ikinci|üçüncü|dördüncü|beşinci)$/iu.test(after[at+1].word)
      && following.some(row => row.pos === 'noun' && row.features.case === 'locative');
    if (nonPredicate || unknownPast || participialModifier || nominalOrdinal) {
      for (let offset = after[at].end; offset < after[at + 1].start; offset++) if (/[.!?]/u.test(proposed[offset])) remove.add(offset);
    }
  }
  return proposed.split('').filter((_, at) => !remove.has(at)).join('');
}
