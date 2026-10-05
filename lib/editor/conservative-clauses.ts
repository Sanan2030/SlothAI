import { productiveMorphology } from './productive-morphology';
import { canonicalProtectedTerm } from './protected-terminology';
import { isFinitePredicate } from './segmentation';
import { isForeignTechnicalStem } from './technical';

/** A foreign modifier plus a possessed nominative noun can be a new subject.
 * Accusative objects and postpositional phrases cannot establish this boundary. */
export function segmentTechnicalNounClauses(text: string): string {
  const words = [...text.matchAll(/\p{L}+/gu)], insert = new Set<number>();
  for (let at = 1; at < words.length - 2; at++) {
    const previous = words[at - 1], modifier = words[at], noun = words[at + 1];
    if (!isFinitePredicate(previous[0]) || !(canonicalProtectedTerm(modifier[0]) || isForeignTechnicalStem(modifier[0]))) continue;
    if (!/^ +$/u.test(text.slice(previous.index! + previous[0].length, modifier.index!))
      || !/^ +$/u.test(text.slice(modifier.index! + modifier[0].length, noun.index!))) continue;
    const subject = productiveMorphology.analyzeWord(noun[0]).some(row => row.pos === 'noun'
      && row.features.case === 'nominative' && row.features.possessivePerson === 3);
    if (!subject || /^(?:haqqında|barədə|ilə|üçün|kimi|üzrə)$/iu.test(words[at + 2][0])) continue;
    const end = text.slice(modifier.index!).search(/[.!?\n]/u);
    const clause = words.slice(at + 2, at + 9).filter(row => end < 0 || row.index! < modifier.index! + end);
    if (clause.some(row => isFinitePredicate(row[0]))) insert.add(previous.index! + previous[0].length);
  }
  let result = '', cursor = 0;
  for (const offset of insert) { result += text.slice(cursor, offset) + '.'; cursor = offset; }
  return result + text.slice(cursor);
}

/** Causal phrase "ona görə" is comma-separated after a complete predicate,
 * but not in an ordinary phrase such as "ona görə hədiyyə aldım". */
export function punctuateCausalTransition(text: string): string {
  return text.replace(/(?<!\p{L})(\p{L}+) +(ona görə) +([^.!?\n]+)/giu,
    (match, left: string, transition: string, rest: string) => {
      if (!isFinitePredicate(left)) return match;
      const finite = (rest.match(/\p{L}+/gu) ?? []).slice(0, 20).some(isFinitePredicate);
      return finite ? left + ', ' + transition + ' ' + rest : match;
    });
}

/** Only a local status predicate licenses qalıb. Bare qalib/winner nouns,
 * winning predicates and contradictory context retain the author's spelling. */
export function resolveRemainingPredicate(text: string): string {
  return text.replace(/(?<!\p{L})qalib(?!\p{L})/giu, (word, offset: number) => {
    const left = text.slice(0, offset).split(/[.!?\n;,]/u).at(-1) ?? '';
    const before = left.trim().match(/\p{L}+$/u)?.[0].toLocaleLowerCase('az-AZ');
    const after = text.slice(offset + word.length).match(/^\s*(\p{L}+)/u)?.[1].toLocaleLowerCase('az-AZ');
    if (!/^(?:eyni|dəyişməz|sabit)$/u.test(before ?? '') || /^(?:ol|gəl|komanda|iştirakçı|idmançı|mükafat)/iu.test(after ?? '')) return word;
    const subject = (left.match(/\p{L}+/gu) ?? []).slice(-6, -1).some(token => productiveMorphology.analyzeWord(token)
      .some(row => row.pos === 'noun' && row.features.case === 'nominative' && row.features.possessivePerson === 3));
    return subject ? (/^\p{Lu}/u.test(word) ? 'Qalıb' : 'qalıb') : word;
  });
}

/** Question followed by an explicit new clause, plus a copula + invitation.
 * No boundary in a reported "necəsən deyə" or a coordinated question. */
export function punctuateConversation(text: string): string {
  return text.replace(/(^|[.!?]\s+)(necəsən|necəsiniz) +(?=(?:bu gün|hava|gəl|gəlin)(?!\p{L}))/giu, '$1$2? ')
    .replace(/(?<!\p{L})(\p{L}+(?:dır|dir|dur|dür)) +(gəl|gəlin) +([^.!?\n]+)/giu,
      (match, predicate: string, invitation: string, rest: string) => {
        const exhortation = (rest.match(/\p{L}+/gu) ?? []).slice(0, 6).some(word => productiveMorphology.analyzeWord(word)
          .some(row => row.pos === 'verb' && row.features.mood === 'optative'));
        return exhortation ? predicate + ', ' + invitation + ' ' + rest : match;
      });
}
