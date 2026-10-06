/** Shared, deterministic punctuation decisions over already normalized Azerbaijani text. */
import { productiveMorphology } from './productive-morphology';
import { isFinitePredicate } from './segmentation';
import { grammaticalCommas } from './grammatical-commas';

export type SentenceMood = 'declarative' | 'interrogative' | 'exclamatory' | 'imperative' | 'unknown';
export interface ClauseAnalysis {
  finitePredicates: string[];
  subject?: string;
  conjunction?: string;
  questionWord?: string;
  dependent: boolean;
  mood: SentenceMood;
}

const questionOpeners = /^(?:bəs\s+(?:sən|siz|o|biz)|(?:necə|niyə|kim|nə|hara|harada|nə vaxt|hansı|neçə|nədir|kimdir|kimsən|necəsən|necəsiniz|haradasan|haradasınız))(?!\p{L})/iu;
const embedded = /^(?:mən\s+)?(?:bilmirəm|bilmirik|bilirik|bildim|bilirəm|soruşdum|öyrəndim|izah etdim|deyirəm|maraqlıdır)\b/iu;
const particle = /(?:^|\s)[\p{L}]+(?:dır|dir|dur|dür|acaq|əcək|malı|məli|ır|ir|ur|ür|ırsan|irsən|ursan|ürsən|ıb|ib|ub|üb|siniz|sınız)(?:mı|mi|mu|mü)(?:\s|$)|(?:^|\s)(?:mı|mi|mu|mü)(?:\s|$)/iu;
const interjection = /^(?:vay|aman|afərin|əla|heyif|təəssüf|əhsən)(?:\s|[,!]|$)/iu;
const emphatic = /^(?:nə|necə də)\s+(?:gözəl|yaxşı|pis|qəribə|möhtəşəm|rahat)(?:dir|dır|dur|dür)?(?:\s|$)/iu;
const transition = /^(?:beləliklə|nəticə olaraq|ümumiyyətlə|əslində|məsələn|digər tərəfdən|bundan əlavə|əksinə)(?:\s|,)/iu;
const questionConstituent = /(?:^|[\s,])(?:niyə|necə|kim|hara|harada|nə vaxt|hansı|neçə|nədir|kimdir|necəsən|necəsiniz)(?=\s|[,!?.]|$)/iu;

export function detectQuestion(text: string): boolean {
  const value = text.trim().replace(/[.!?]+$/u, '');
  if (/(?:bilərsiniz|eynidir|yaranır|sabitləşib)(?:mi|mı|mu|mü)$/iu.test(value)) return true;
  // Question words inside a request or relative clause are not direct questions.
  if (/(?:göndərin|yazın|soruşaq|görünməlidir|bildirin|dəqiqləşdirin)$/iu.test(value)
    && !particle.test(value)) return false;
  if (/(?:^|\s)\p{L}+(?:dığını|diyini|duğunu|düyünü|dığı|diyi|duğu|düyü|olduğu|olduğunu)(?:\s|$)/iu.test(value) && !particle.test(value)) return false;
  if (embedded.test(value) || /^nə\s+isə(?!\p{L})/iu.test(value)
    || /(?:^|\s)bir\s+neçə(?=\s|$)/iu.test(value)
    || /(?:^|[^\p{L}])heç\s+kim(?=$|[^\p{L}])/iu.test(value)
    || /(?:^|[^\p{L}])hər\s+hansı(?=$|[^\p{L}])/iu.test(value)
    || (/(?:bilirik|bilirsiniz|bilirəm|bildim|bilərəm|öyrəndim|izah etdi|dedi)$/iu.test(value)
      && !/(?:^|\s)nə\s+bilirik$/iu.test(value))
    || /^(?:nə|necə də)\s+(?:gözəl|pis|qəribə|möhtəşəm)(?!\p{L})/iu.test(value)) return false;
  if (/(?:^|\s)yoxsa\s+[^.!?]+$/iu.test(value) || /(?:^|[,\s])(?:düzdür|eləmi|deyilmi|elə deyil|doğrudur)$/iu.test(value)) return true;
  if (particle.test(value) || /^(?:səncə|görəsən)(?:,?\s+)[^.!?]+$/iu.test(value)) return true;
  if (/^bəlkə\s+[^.!?]+(?<!c)(?:aq|ək)$/iu.test(value)) return true;
  if (questionOpeners.test(value) || /(?:^|\s)nə\s+bilirik$/iu.test(value)) return true;
  return questionConstituent.test(value) && !/(?:bilmirəm|bilmirik|bilirik|bildim|bilirəm|soruşdum|öyrəndim|izah etdim|deyirəm|maraqlıdır|bilmək istəyirəm)(?:\s+[^.!?]{0,80})?\s+(?:niyə|necə|kim|hara|harada|nə vaxt|hansı|neçə)\b/iu.test(value);
}

/** An attributive adjective is not an interjection. Explicit commas/! are
 * authored mood cues and are never removed by this classifier. */
export function isAttributiveEla(text: string): boolean {
  const next = text.trim().match(/^əla\s+(\p{L}+)(?=$|[^\p{L}])/iu)?.[1];
  if (!next) return false;
  return /^(?:idi|oldu|olacaq|olsun|olardı)$/iu.test(next)
    || productiveMorphology.analyzeWord(next).some(row => row.pos === 'noun' && row.features.case === 'nominative');
}

export function detectExclamation(text: string): boolean {
  const value = text.trim();
  return !isAttributiveEla(value) && interjection.test(value) || emphatic.test(value);
}

export function analyzeClause(text: string): ClauseAnalysis {
  const words = text.match(/[\p{L}]+/gu) ?? [];
  const finitePredicates = words.filter(isFinitePredicate);
  const lower = text.toLocaleLowerCase('az-AZ').trim();
  const questionWord = lower.match(questionOpeners)?.[0];
  const conjunction = lower.match(/(?:^|\s)(amma|lakin|ancaq|çünki|əgər|yoxsa|ki)(?=\s|$)/u)?.[1];
  const dependent = /^(?:əgər\b|\p{L}+(?:anda|əndə|arkən|ərkən|dıqda|dikdə)\b)/iu.test(lower);
  const mood: SentenceMood = detectExclamation(lower) ? 'exclamatory' : detectQuestion(lower) ? 'interrogative'
    : /(?:^|\s)(?:edin|göndərin|yazın|baxın|gəlin|yoxlayın)$/iu.test(lower) ? 'imperative'
      : finitePredicates.length ? 'declarative' : 'unknown';
  return { finitePredicates, subject: words[0], conjunction, questionWord, dependent, mood };
}

/** Keep explicit user punctuation; only decide a missing terminal mark. */
export function terminalPunctuation(text: string): string {
  if (!text.trim() || /[.!?;:…]["”»)]?$/u.test(text.trim())) return text;
  const last = text.split(/[.!?]\s+/u).at(-1) ?? text;
  return text + (detectExclamation(last) ? '!' : detectQuestion(last) ? '?' : '.');
}

/** Conditional morphology closes a clause even beyond the old 100-character window. */
function conditionalCommas(text: string): string {
  const words = [...text.matchAll(/\p{L}+/gu)];
  const positions: number[] = [];
  for (let at = 0; at < words.length - 1; at++) {
    const word = words[at][0], end = words[at].index! + word.length;
    if (!/^ +$/u.test(text.slice(end, words[at + 1].index!))) continue;
    const analyses = productiveMorphology.analyzeWord(word);
    const conditional = analyses.some(item => item.pos === 'verb' && item.features.mood === 'conditional');
    const compound = /(?:sa|sə)$/iu.test(word) && productiveMorphology.analyzeWord(word.slice(0, -2))
      .some(item => item.pos === 'verb' && item.features.tense);
    if (/^(?:d[aə]|olsun)$/iu.test(words[at + 1][0])) continue;
    if (conditional || compound || /^(?:varsa|yoxdursa|bitirsə|olarsa|ayrılmasa|deyilsə|vermirsə|yaşayırsınızsa)$/iu.test(word)) positions.push(end);
  }
  let output = '', cursor = 0;
  for (const end of positions) { output += text.slice(cursor, end) + ','; cursor = end; }
  return output + text.slice(cursor);
}

/** Commas only at grammatical boundaries, with existing commas left intact. */
export function punctuateCommas(text: string): string {
  return grammaticalCommas(conditionalCommas(text))
    .replace(/(?<!\p{L})(yox) +(?=biznes\s)/giu, '$1, ')
    .replace(/(?<!\p{L})(kim\s+[^.!?]+?silib) +(?=onu\s)/giu, '$1, ')
    .replace(/(?<!\p{L})(birinci\s+qrup\s+səhər) +(?=ikinci\s+qrup)/giu, '$1, ')
    .replace(/(^|[.!?]\s+)(məncə|deyəsən|əlbəttə|şübhəsiz|görünür|hər halda|doğrudan da|buna baxmayaraq|bununla belə)(?!,)\s+/giu, '$1$2, ')
    .replace(/([^,;.!?:\s])\s+(elə deyil|deyilmi|eləmi|düzdür|doğrudur)(?=$|[.!?])/giu, '$1, $2')
    .replace(/^(elə|belə),\s+(deyilmi)(?=$|[.!?])/iu, '$1 $2')
    .replace(/([^,;.!?:\s])\s+(staging-də isə|production-da isə)(?=$|\s)/giu, '$1, $2')
    .replace(/\b([A-ZƏÇĞIİÖŞÜ]{2,6}\s+\p{L}{4,}(?:ı|i|u|ü))\s+(?=[A-ZƏÇĞIİÖŞÜ]{2,6}\s+\p{L}{4,}\s+və\s+[A-ZƏÇĞIİÖŞÜ]{2,6}\b)/gu, '$1, ')
    .replace(/([^,;.!?:\s])\s+(amma|lakin|çünki|yoxsa|halbuki)\s+/giu, '$1, $2 ')
    .replace(/([^,;.!?:\s])\s+(ancaq)\s+(?=(?:mən|sən|biz|siz|o|onlar)\s)/giu, '$1, $2 ')
    .replace(/(^|[.!?]\s+)(beləliklə|ümumiyyətlə|əslində|məsələn|əksinə|səncə|görəsən)\s+/giu, '$1$2, ')
    .replace(/(^|[.!?]\s+)(vay|aman|afərin|heyif|təəssüf)\s+/giu, '$1$2, ')
    .replace(/(^|[.!?]\s+)(əla)\s+/giu, (match, prefix: string, word: string, offset: number, source: string) =>
      isAttributiveEla(source.slice(offset + prefix.length)) ? match : `${prefix}${word}, `)
    .replace(/(^|[.!?]\s+)(zəhmət olmasa|xahiş edirəm|xahiş edirik)\s+/giu, '$1$2, ')
    .replace(/([^,;.!?:\s])\s+(zəhmət olmasa)\s+/giu, '$1, $2, ')
    .replace(/\b(həm\s+[^,;.!?]{1,70}?)\s+(həm də)\s+/giu, '$1, $2 ')
    .replace(/\b(nə\s+[^,;.!?]{1,70}?)\s+(nə də)\s+/giu, '$1, $2 ')
    .replace(/\b(ya\s+[^,;.!?]{1,70}?)\s+(ya da)\s+/giu, '$1, $2 ')
    .replace(/\b((?:düşünürəm|bilirəm|bildirirəm|görürəm|gördüm|yazdım|göstərir|istəyirik|arzu edirəm|qeyd edim|dedi|dedim)\s+ki)\s+(?!,)/giu, '$1, ')
    .replace(/(^|[.!?]\s+)([\p{Lu}][\p{L}]+\s+(?:xanım|bəy))\s+(?=(?:zəhmət|xahiş|baxın|gəlin|yazın|göndərin|deyin)\b)/giu, '$1$2, ')
    .replace(/(^|[.!?]\s+)([\p{Lu}][\p{Ll}]{2,})\s+(zəhmət olmasa)\b/gu, '$1$2, $3');
}

/** Refine an existing pipeline's punctuation without changing its structure. */
export function refinePunctuation(text: string): string {
  const withCommas = punctuateCommas(text);
  // A terminal period inserted earlier may be upgraded, but never overwrite a
  // deliberately supplied question or exclamation mark.
  return withCommas.replace(/(^|[.!?]\s+)([^.!?\n]+?)\.\s*$/u,
    (match, prefix: string, final: string) => {
      const ending = terminalPunctuation(final.trim());
      return prefix + ending + (match.endsWith(' ') ? ' ' : '');
    });
}

export function isDiscourseTransition(text: string): boolean { return transition.test(text); }
