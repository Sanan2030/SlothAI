/** Conservative, language-wide sentence boundaries for unpunctuated prose. */
import { legacyModelMorphology as productiveMorphology } from './productive-morphology';
import { givenNames, ambiguousNames } from './entities/person-names';
import { places } from './entities/geo';
const verbs = /(?:mış(?:am|san|ıq|sınız|lar)?|miş(?:əm|sən|ik|siniz|lər)?|muş(?:am|san|uq|sunuz|lar)?|müş(?:əm|sən|ük|sünüz|lər)?|dım|dim|dum|düm|dın|din|dun|dün|dıq|dik|duq|dük|dı|di|du|dü|ırdı|irdi|urdu|ürdü|ır|ir|ur|ür|acaq(?:dır|lar)?|əcək(?:dir|lər)?|aram|ərəm|ərsiniz|acaqsınız|əcəksiniz|ılıb|ilib|ulub|ülüb|ıb|ib|ub|üb)$/iu;
const copula = /(?:yam|yəm|san|sən|dır|dir|dur|dür|dılar|dilər|durlar|dürlər|dı|di|du|dü)$/iu;
const dependent = /(?:anda|əndə|arkən|ərkən|dıqda|dikdə|duqda|dükdə|sa|sə|dığı|diyi|duğu|düyü)$/iu;
const connectors = new Set(['ki', 'çünki', 'amma', 'lakin', 'ancaq', 'isə', 'və', 'ya', 'yoxsa', 'əgər', 'üçün']);
const namedSubjects = new Set([...givenNames.filter(name => !ambiguousNames.has(name)), ...places].map(name => name.toLocaleLowerCase('az-AZ')));
const subjects = new Set(['mən', 'sən', 'biz', 'siz', 'o', 'onlar', 'biri', 'icraçı']);
const timeWords = new Set(['indi', 'sonra', 'yenidən', 'axşam', 'sabah', 'dünən', 'birdən', 'günortadan']);
const dependentStarts = new Set(['əgər', 'çünki', 'ki', 'üçün', 'deyə', 'ilə']);
const objectPronouns = new Set(['onu', 'onları', 'bunu', 'bunları']);

const lightVerbNouns = new Set(['təsvir', 'təhlil', 'təqdim', 'təklif', 'təmin', 'tətbiq', 'təşkil', 'nadir', 'aydın', 'əsasən', 'soyadın', 'dair', 'rica', 'təşəkkür', 'hazır', 'keçmiş']);
function independentStart(word: string): boolean {
  if (subjects.has(word) || timeWords.has(word) || namedSubjects.has(word)) return true;
  if (connectors.has(word) || dependentStarts.has(word) || word.length < 4) return false;
  const analyses = productiveMorphology.analyzeWord(word);
  // Nominative subjects can start a fresh clause. Accusative objects and
  // subordinate verbal forms alone cannot prove independence.
  return analyses.some(item => (item.pos === 'noun' && item.features.case === 'nominative' && !item.features.possessivePerson)
    || item.pos === 'adjective');
}

export function isFinitePredicate(word: string): boolean {
  const lower = word.toLocaleLowerCase('az-AZ');
  // Participles and adjectives modify the following noun; their endings can
  // resemble finite predicates when the dictionary has no inflection entry.
  if (/^(?:gələcək|qədim)$/iu.test(lower)) return false;
  if (lightVerbNouns.has(lower)) return false;
  if (/(?:ın|in|un|ün)$/iu.test(lower) && productiveMorphology.analyzeWord(lower).some(row => row.pos === 'noun' && row.features.case === 'genitive')) return false;
  if (lower.length < 4 || dependent.test(lower) || timeWords.has(lower)) return false;
  const morphology = productiveMorphology.analyzeWord(lower);
  const analyses = morphology.filter(item => item.pos === 'verb');
  if (morphology.length && !analyses.length) return false;
  if (analyses.length && analyses.every(item => item.features.mood === 'participle' || item.features.mood === 'conditional')) return false;
  if (analyses.some(item => item.features.tense || item.features.mood === 'imperative')) return true;
  // Bare -ıb/-ib endings overlap with common adjectives (vacib, qərib);
  // demand lexical verbal evidence instead of treating the suffix as finite.
  if (/(?:ıb|ib|ub|üb)$/iu.test(lower)) return false;
  // Common nouns with a false positive verb-looking suffix should not split.
  if (/(?:məktəbi|kitabı|layihəsi|məlumatı|sistemi)$/iu.test(lower)) return false;
  return verbs.test(lower) || /(?:acağıq|əcəyik|acaqlar|əcəklər)$/iu.test(lower)
    || (lower.length > 5 && copula.test(lower));
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
    const participleBeforeNoun = /(?:mış|miş|muş|müş|acaq|əcək)$/iu.test(current)
      && (/(?:lar|lər)$/iu.test(next)
        || productiveMorphology.analyzeWord(next).some(item => item.pos === 'noun'));
    const wordAfterNext = tokens[index + 4]?.[0]?.toLocaleLowerCase('az-AZ') ?? '';
    if (/^(?:tamamlayıb|hazırlayıb)$/iu.test(current) && next === 'yenidən') { output += current; continue; }
    const freshObjectClause = (objectPronouns.has(next)
      || productiveMorphology.analyzeWord(next).some(item => item.pos === 'noun'
        && item.features.case === 'accusative'))
      && (wordAfterNext === 'isə'
        || (!/(?:ıb|ib|ub|üb)$/iu.test(current) && isFinitePredicate(wordAfterNext))
        || timeWords.has(wordAfterNext)
        || (objectPronouns.has(next) && wordAfterNext === 'bir'
          && tokens[index + 6]?.[0]?.toLocaleLowerCase('az-AZ') === 'daha'));
    const nextAnalysis = productiveMorphology.analyzeWord(next);
    const afterAnalysis = productiveMorphology.analyzeWord(wordAfterNext);
    const nominalSubjectClause = (nextAnalysis.some(row => row.pos === 'noun' && row.features.case === 'genitive')
      && afterAnalysis.some(row => row.pos === 'noun' && row.features.case === 'nominative' && row.features.possessivePerson === 3))
      || (nextAnalysis.some(row => row.pos === 'noun' && row.features.case === 'nominative' && row.features.possessivePerson === 3)
        && dependent.test(wordAfterNext));
    const temporalClause = /(?:dıqdan|dikdən|duqdan|dükdən|tıqdan|tikdən)$/iu.test(next)
      && wordAfterNext === 'sonra';
    const completedConverb = productiveMorphology.analyzeWord(current).some(row => row.pos === 'verb') && /(?:ıb|ib|ub|üb)$/iu.test(current)
      && (independentStart(next) || (wordAfterNext === 'isə'
        && productiveMorphology.analyzeWord(next).some(row => row.pos === 'noun')))
      && !objectPronouns.has(next)
      && (wordAfterNext === 'isə'
        || (productiveMorphology.analyzeWord(next).some(item => item.pos === 'noun'
          && item.features.case === 'nominative' && !item.features.possessivePerson)
          && productiveMorphology.analyzeWord(wordAfterNext).some(item => item.pos === 'noun'
            && item.features.case === 'nominative')));
    if (!/^\p{L}+$/u.test(current) || !/^ +$/u.test(space)
      || !(isFinitePredicate(current) || completedConverb) || participleBeforeNoun || connectors.has(next)
      || !(independentStart(next) || freshObjectClause || nominalSubjectClause || temporalClause || (next === 'daha' && wordAfterNext === 'sonra')
        || (/^[\p{L}]{4,}(?:lar|lər)$/u.test(next) && !connectors.has(next)))) {
      output += current;
      continue;
    }
    const precedingClause = output.slice(Math.max(output.lastIndexOf('.'), output.lastIndexOf('?'),
      output.lastIndexOf('!'), output.lastIndexOf('\n')) + 1).trim();
    if (!precedingClause) { output += current; continue; }
    // Do not terminate a still-open reported or conditional clause.
    if (/(?:^|[\s,])(?:ki|əgər)(?=[\s,]|$)/iu.test(precedingClause)) { output += current; continue; }
    // An indirect question is the object of the reporting verb, not a new sentence.
    if (/(?:bilmirəm|bilmirik|bilirik|bildim|bilirəm|soruşdum|öyrəndim)$/iu.test(current)
      && /^(?:o\s+)?(?:nə vaxt|niyə|necə|hara|harada|kim|hansı|nə)\b/iu.test(
        tokens.slice(index + 2, index + 12).map(token => token[0]).join(''))) {
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
        || /(?:^|\s)(?:necə|neçə|niyə|nə vaxt|harada|kim|hansı)(?!\p{L})/iu.test(clause.trim())
          && !/(?:bilmirəm|bilirəm|soruşdum|olduğu|olduğunu|dığını|diyini)/iu.test(clause);
      output += current + (question ? '?' : '.');
      continue;
    }
    output += current;
  }
  return output;
}
