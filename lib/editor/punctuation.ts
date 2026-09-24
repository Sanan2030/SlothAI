/** Shared, deterministic punctuation decisions over already normalized Azerbaijani text. */
import { isFinitePredicate } from './segmentation';

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
const embedded = /^(?:mən\s+)?(?:bilmirəm|bilirik|bildim|bilirəm|soruşdum|öyrəndim|izah etdim|deyirəm|maraqlıdır)\b/iu;
const particle = /(?:^|\s)[\p{L}]+(?:dır|dir|dur|dür|acaq|əcək|malı|məli)(?:mı|mi|mu|mü)(?:\s|$)|(?:^|\s)(?:mı|mi|mu|mü)(?:\s|$)/iu;
const interjection = /^(?:vay|aman|afərin|əla|heyif|təəssüf)(?:\s|[,!]|$)/iu;
const emphatic = /^nə\s+(?:pis|qəribə|möhtəşəm)\s/iu;
const transition = /^(?:beləliklə|nəticə olaraq|ümumiyyətlə|əslində|məsələn|digər tərəfdən|bundan əlavə|əksinə)(?:\s|,)/iu;

export function detectQuestion(text: string): boolean {
  const value = text.trim().replace(/[.!?]+$/u, '');
  if (embedded.test(value) || /^nə\s+isə(?!\p{L})/iu.test(value)
    || /(?:bilirik|bilirsiniz|bilirəm|bildim|bilərəm|öyrəndim|izah etdi|dedi)$/iu.test(value)
    || /^nə\s+(?:gözəl|pis|qəribə|möhtəşəm)(?!\p{L})/iu.test(value)) return false;
  if (/(?:^|\s)yoxsa\s+[^.!?]+$/iu.test(value) || /(?:^|[,\s])düzdür$/iu.test(value)) return true;
  if (particle.test(value)) return true;
  return questionOpeners.test(value);
}

export function detectExclamation(text: string): boolean {
  const value = text.trim();
  return interjection.test(value) || emphatic.test(value);
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

/** Commas only at grammatical boundaries, with existing commas left intact. */
export function punctuateCommas(text: string): string {
  return text
    .replace(/([^,;.!?:\s])\s+(amma|lakin|çünki|yoxsa)\s+/giu, '$1, $2 ')
    .replace(/([^,;.!?:\s])\s+(ancaq)\s+(?=(?:mən|sən|biz|siz|o|onlar)\s)/giu, '$1, $2 ')
    .replace(/(^|[.!?]\s+)(beləliklə|ümumiyyətlə|əslində|məsələn|əksinə)\s+/giu, '$1$2, ')
    .replace(/(^|[.!?]\s+)(vay|aman|afərin|əla|heyif|təəssüf)\s+/giu, '$1$2, ')
    .replace(/(^|[.!?]\s+)(zəhmət olmasa|xahiş edirəm|xahiş edirik)\s+/giu, '$1$2, ')
    .replace(/([^,;.!?:\s])\s+(zəhmət olmasa)\s+/giu, '$1, $2, ')
    .replace(/\b(həm\s+[^,;.!?]{1,70}?)\s+(həm də)\s+/giu, '$1, $2 ')
    .replace(/\b(nə\s+[^,;.!?]{1,70}?)\s+(nə də)\s+/giu, '$1, $2 ')
    .replace(/\b(ya\s+[^,;.!?]{1,70}?)\s+(ya da)\s+/giu, '$1, $2 ')
    .replace(/\b(əgər\s+[^,;.!?]{1,100}?\b(?:olsa|olarsan|olarsa|etsə|gəlsə|bitirsə))\s+(?=\p{L})/giu, '$1, ')
    .replace(/\b((?:düşünürəm|bilirəm|bildirirəm|görürəm|gördüm|yazdım|göstərir|istəyirik|qeyd edim|dedi|dedim)\s+ki)\s+(?!,)/giu, '$1, ')
    .replace(/(^|[.!?]\s+)([\p{Lu}][\p{L}]+\s+(?:xanım|bəy))\s+(?=\p{L})/gu, '$1$2, ')
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
