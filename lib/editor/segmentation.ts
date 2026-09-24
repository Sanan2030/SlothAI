/** Conservative, language-wide sentence boundaries for unpunctuated prose. */
import { productiveMorphology } from './productive-morphology';
const verbs = /(?:mış(?:am|san|ıq|sınız|lar)?|miş(?:əm|sən|ik|siniz|lər)?|muş(?:am|san|uq|sunuz|lar)?|müş(?:əm|sən|ük|sünüz|lər)?|dım|dim|dum|düm|dın|din|dun|dün|dıq|dik|duq|dük|dı|di|du|dü|ırdı|irdi|urdu|ürdü|ır|ir|ur|ür|acaq(?:dır|lar)?|əcək(?:dir|lər)?|aram|ərəm|ərsiniz|acaqsınız|əcəksiniz|ılıb|ilib|ulub|ülüb|ıb|ib|ub|üb)$/iu;
const copula = /(?:yam|yəm|san|sən|dır|dir|dur|dür|dılar|dilər|durlar|dürlər|dı|di|du|dü)$/iu;
const dependent = /(?:anda|əndə|arkən|ərkən|dıqda|dikdə|duqda|dükdə|sa|sə|dığı|diyi|duğu|düyü)$/iu;
const connectors = new Set(['ki', 'çünki', 'amma', 'lakin', 'ancaq', 'isə', 'və', 'ya', 'yoxsa', 'əgər', 'üçün']);
const subjects = new Set(['mən', 'sən', 'biz', 'siz', 'o', 'onlar', 'biri']);
const timeWords = new Set(['indi', 'sonra', 'yenidən', 'axşam', 'sabah', 'dünən', 'birdən']);

export function isFinitePredicate(word: string): boolean {
  const lower = word.toLocaleLowerCase('az-AZ');
  if (lower.length < 4 || dependent.test(lower)) return false;
  const analyses = productiveMorphology.analyzeWord(lower).filter(item => item.pos === 'verb');
  if (analyses.length && analyses.every(item => item.features.mood === 'participle')) return false;
  if (analyses.some(item => item.features.tense)) return true;
  // Common nouns with a false positive verb-looking suffix should not split.
  if (/(?:məktəbi|kitabı|layihəsi|məlumatı|sistemi)$/iu.test(lower)) return false;
  return verbs.test(lower) || (lower.length > 5 && copula.test(lower));
}

export function segmentIndependentClauses(text: string): string {
  // A boundary requires a finite predicate followed by a subject or temporal
  // opener and evidence of a second predicate. Existing punctuation wins.
  const tokens = [...text.matchAll(/[\p{L}]+|[^\p{L}]+/gu)];
  if (tokens.length > 10_000) return text;
  let output = '';
  for (let index = 0; index < tokens.length; index++) {
    const current = tokens[index][0];
    const space = tokens[index + 1]?.[0] ?? '';
    const next = tokens[index + 2]?.[0]?.toLocaleLowerCase('az-AZ') ?? '';
    const participleBeforeNoun = /(?:mış|miş|muş|müş|acaq|əcək)$/iu.test(current) && /(?:lar|lər)$/iu.test(next);
    if (!/^\p{L}+$/u.test(current) || !/^ +$/u.test(space)
      || !isFinitePredicate(current) || participleBeforeNoun || connectors.has(next)
      || !(subjects.has(next) || timeWords.has(next)
        || (/^[\p{L}]{4,}(?:lar|lər)$/u.test(next) && !connectors.has(next)))) {
      output += current;
      continue;
    }
    const following = tokens.slice(index + 2, index + 34);
    const secondPredicate = following.some(token => /^\p{L}+$/u.test(token[0]) && isFinitePredicate(token[0]));
    const boundary = following.findIndex(token => /[.!?\n]/u.test(token[0]));
    if (secondPredicate && (boundary < 0 || following.slice(0, boundary).some(token =>
      /^\p{L}+$/u.test(token[0]) && isFinitePredicate(token[0])))) {
      const clause = output.split(/[.!?\n]/u).at(-1) ?? '';
      const question = /^(?:necəsən|necəsiniz|haradasan|haradasınız)$/iu.test(current)
        || /(?:^|\s)(?:necə|neçə|niyə|nə vaxt|harada|kim|hansı)(?:\s|$)/iu.test(clause);
      output += current + (question ? '?' : '.');
      continue;
    }
    output += current;
  }
  return output;
}
