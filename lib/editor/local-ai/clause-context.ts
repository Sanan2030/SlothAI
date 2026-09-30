import type { Token } from './core';
import { fold } from './core';
import { isFinitePredicate } from '../segmentation';
import { productiveMorphology } from '../productive-morphology';

const joiners = new Set(['ki', 'cunki', 'amma', 'ancaq', 'lakin', 've', 'ya', 'yoxsa', 'eger', 'ucun', 'ile', 'deye', 'ise', 'olaraq', 'kimi']);

/** Linear preprocessing preserves whole-clause scope without rescanning long prefixes. */
export function createBoundaryContext(tokens: readonly Token[]): (at: number) => boolean {
  const folded = tokens.map(token => fold(token.word));
  const finite = tokens.map(token => isFinitePredicate(token.word));
  const precedingDependent: boolean[] = [];
  const followingPredicate: boolean[] = [];
  let dependent = false;
  for (let at = 0; at < tokens.length; at++) {
    if (!at || tokens[at].sentence !== tokens[at - 1].sentence) dependent = false;
    if (/^(?:ki|eger)$/u.test(folded[at])) dependent = true;
    precedingDependent[at] = dependent;
  }
  let following = false;
  for (let at = tokens.length - 1; at >= 0; at--) {
    if (at === tokens.length - 1 || tokens[at].sentence !== tokens[at + 1].sentence) following = false;
    followingPredicate[at] = following;
    if (/^(?:ki|eger)$/u.test(folded[at])) following = false;
    else if (finite[at]) following = true;
  }
  return at => {
    const left = tokens[at], right = tokens[at + 1];
    if (!right || left.sentence !== right.sentence || !finite[at]
      || joiners.has(folded[at + 1]) || precedingDependent[at] || !followingPredicate[at]) return false;
    const surface = productiveMorphology.findByFoldedForm(right.word) ?? right.word;
    const analyses = productiveMorphology.analyzeWord(surface);
    // A declined object after a converb does not establish a new subject:
    // 'yoxlayıb qeydiyyatı tamamlayır' is one predicate sequence.
    if (/(?:ıb|ib|ub|üb)$/iu.test(left.word) && folded[at + 2] !== 'ise'
      && analyses.some(row => row.pos === 'noun') && !analyses.some(row =>
      row.pos === 'noun' && row.features.case === 'nominative' && !row.features.possessivePerson)) return false;
    return true;
  };
}
export function independentBoundaryContext(tokens: readonly Token[], at: number): boolean {
  return createBoundaryContext(tokens)(at);
}
