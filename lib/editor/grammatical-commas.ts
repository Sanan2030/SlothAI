import { productiveMorphology } from './productive-morphology';

const lower = (word: string) => word.toLocaleLowerCase('az-AZ');
const predicateAdjectives = new Set('ac yaxşı pis vacib maraqlı gözəl güclü zəif rahat çətin asan faydalı təhlükəli hazır düzgün səhv çalışqan'.split(' '));
const adverbs = new Set('çox az tez gec həmişə yenə artıq indi dünən sabah'.split(' '));

/** A comma distinguishes a subject from a demonstrative determiner.
 * Do not guess in ambiguous noun phrases ("o evə", "bu kitab").
 * Frozen neural morphology/artifacts are intentionally not changed here.
 */
export function punctuateSubjectPronouns(text: string): string {
  return text.replace(/(^|[,.!?;:]\s+|(?<!\p{L})ki\s+|[, ]+(?:amma|lakin|çünki|halbuki)\s+)(o|bu) +(\p{L}+)/giu,
    (match: string, prefix: string, pronoun: string, next: string, offset: number, whole: string) => {
      const word = lower(next);
      // Pronouns, particles and verbs must not receive a subject comma.
      if (/^(?:da|də|isə|ki|özü|öz|mən|sən|biz|siz|o|onlar|onun|onların|bizim|sizin|mənim|sənin)$/u.test(word)) return match;
      const analyses = productiveMorphology.analyzeWord(word);
      const nominalPredicate = analyses.some(item => item.pos === 'noun'
        && item.features.derivation?.some(value => value.startsWith('copula-')));
      const adjectivePredicate = /(?:dır|dir|dur|dür)$/u.test(word)
        && predicateAdjectives.has(word.slice(0, -3));
      const following = whole.slice(offset + match.length, offset + match.length + 96)
        .match(/^ +([\p{L}]+)/u)?.[1];
      const adjectiveBeforePredicate = predicateAdjectives.has(word) && following
        && (/^(?:idi|imiş|olduğu|olduğunu|olacaq|olardı)$/iu.test(following)
          || productiveMorphology.analyzeWord(following).some(item => item.features.derivation?.some(value => value.startsWith('copula-'))));
      // These adverbs cannot introduce a demonstrative noun phrase. "bu gün"
      // and "o zaman" are deliberately outside the set.
      if (adverbs.has(word) || nominalPredicate || adjectivePredicate || adjectiveBeforePredicate) {
        return `${prefix}${pronoun}, ${next}`;
      }
      return match;
    });
}

/** Only explicit reporting/complement predicates license comma-after-ki.
 * "sən ki", "elə ki", "ona görə ki" and sentence-final ki are excluded.
 */
export function punctuateComplementKi(text: string): string {
  return text.replace(/(?<!\p{L})(\p{L}+) +ki +(?=\p{L})/giu,
    (match: string, predicate: string) => {
      const analyses = [...productiveMorphology.analyzeWord(predicate)];
      // Compound past (düşünürdü, bilirdi) attaches -dı/-di/-du/-dü
      // to a present stem; the compact morphology does not index that paradigm.
      if (/(?:dı|di|du|dü)$/iu.test(predicate)) {
        analyses.push(...productiveMorphology.analyzeWord(predicate.slice(0, -2))
          .filter(item => item.pos === 'verb' && item.features.tense === 'present'));
      }
      const reporting = analyses.some(item => item.pos === 'verb'
        && /^(?:de|bildir|düşün|bil|gör|istə|anla|söylə|vurğula)$/u.test(item.lemma)
        && item.features.tense);
      // Reviewed forms not covered by the small productive verb inventory.
      const reviewed = /^(?:demişəm|demişik|demişdi|bildirilir|məlumdur|aydındır)$/iu.test(predicate);
      return reporting || reviewed ? `${predicate} ki, ` : match;
    });
}

/** Unambiguous parenthetical stance markers; lexical verbs such as "görünür"
 * and ambiguous "bəlkə" are deliberately left to existing scoped rules.
 */
export function punctuateParentheticals(text: string): string {
  return text.replace(/(^|[^\p{L}])(əlbəttə|şübhəsiz|məncə|səncə|bizcə|sizcə|təəssüf ki|heç şübhəsiz)(?=$|[^\p{L}])/giu,
    (match: string, prefix: string, marker: string, offset: number, whole: string) => {
      const start = offset + prefix.length, end = offset + match.length;
      const before = whole.slice(0, start), after = whole.slice(end);
      if (!after.trim() || /^\s*[.!?;:]/u.test(after)) return match;
      const startsClause = !before.trim() || /[.!?;:\n]\s*$/u.test(before);
      const leftComma = startsClause || /[,]\s*$/u.test(before) ? '' : ',';
      const rightComma = /^\s*,/u.test(after) ? '' : ',';
      return (leftComma && /^ +$/u.test(prefix) ? ',' + prefix : prefix + leftComma) + marker + rightComma;
    });
}

export function grammaticalCommas(text: string): string {
  return punctuateSubjectPronouns(punctuateComplementKi(punctuateParentheticals(text)));
}
