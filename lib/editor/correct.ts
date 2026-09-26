import { languageServices, type LanguageServices } from './language-services';
import { repairPhrases, sentenceBoundaries } from './context';
import { punctuateNarrative, narrativeParagraphs } from './narrative';
import { beforeLexicalCorrection, extendedPhrases, extendedBoundaries } from './extended-narrative';
import { expositoryPhrases, punctuateExpository } from './expository';
import { businessPhrases, punctuateBusiness, businessLayout, businessStageLists } from './business';
import { prepareTechnicalPhrases, technicalPhrases, punctuateTechnical } from './technical';
import { protectKnownTerminology } from './protected-terminology';
import { parseEmailSections, prepareEmailBody } from './rules/email';
import { segmentIndependentClauses, isFinitePredicate } from './segmentation';
import { detectExclamation, detectQuestion, punctuateCommas, terminalPunctuation } from './punctuation';
import { segmentParagraphs } from './paragraph-segmentation';
import { isCanonicalEntity, protectMultiwordEntities, resolveEntitiesInText, resolveEntityWord } from './entities/resolver';

export const MAX_TEXT_LENGTH = 10_000;
export interface LocalCorrection { text: string; corrections: number }
export interface CorrectionEvent {
  stage: 'spelling';
  original: string;
  replacement: string;
  reason: string;
}
export interface CorrectionRuntime {
  services?: LanguageServices;
  trace?: (event: CorrectionEvent) => void;
}

function capitalize(text: string): string {
  return text.replace(/(^[“«"(]?|[.!?]\s+[“«"(]?|\n(?:\d+[.)]|[-*])\s+)([a-zəçğıöşü])/g,
    (_, prefix: string, letter: string) => prefix + letter.toLocaleUpperCase('az-AZ'));
}

function punctuate(line: string): string {
  if (!line.trim()) return '';
  // Documentary headings and standalone subtitles are structure, not prose.
  if (/^===.+===$/u.test(line.trim()) || /^[A-ZƏÇĞIİÖŞÜ\s-]{3,}$/u.test(line.trim()) || (/^\(.+\)$/u.test(line.trim()) && line.trim().length <= 160)) return line.trim();
  if (/^salam,$/i.test(line.trim())) return 'Salam,';
  if (/^mövzu:/i.test(line.trim())) return capitalize(line.trim());
  if (/^hörmətlə[,!.]?$/i.test(line.trim())) return 'Hörmətlə,';
  if (/^hörmətli [^.!?]+[,]?$/i.test(line.trim()) && (/^hörmətli\s+\p{L}+(?:\s+(?:xanım|bəy))?[,]?$/iu.test(line.trim()) || !line.split(/\s+/u).some(isFinitePredicate))) return capitalize(line.trim().replace(/[,.]?$/, ','));
  let result = line.replace(/[\t ]+/g, ' ').trim()
    .replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')
    .replace(/([,;:!?])\1+/g, '$1')
    .replace(/\.{2,}/g, '.')
    .replace(/([!?])[.,]+/g, '$1')
    .replace(/\s+\./g, '.')
    .replace(/\.(?=[A-Za-zƏəÇçĞğİıÖöŞşÜü])/g, '. ')
    .replace(/\s+([,;:!?])/g, '$1')
    .replace(/([,;:!?])(?=[a-zA-ZəƏçÇğĞıİöÖşŞüÜ])/g, '$1 ');
  result = sentenceBoundaries(result);
  result = punctuateNarrative(result);
  result = extendedBoundaries(result);
  result = punctuateExpository(result);
  result = punctuateBusiness(result);
  result = punctuateTechnical(result);
  result = segmentIndependentClauses(result);
  result = punctuateCommas(result);
  // Only well-defined conversational patterns are split; no guessed sentence
  // boundary before every pronoun or arbitrary verb.
  result = result
    .replace(/^(salam)\s+(?=[a-zəçğıöşü])/i, '$1, ')
    .replace(/(^|^salam,\s*|[.!?]\s+)(necəsən|necəsiniz)(?=\s+(?:mən|sən|biz|siz)\s|$)/gi, '$1$2?');
  if (!/[.!?:;…]["”»)]?$/.test(result)) {
    const lastSentence = result.split(/[.!?]\s+/).at(-1) ?? result;
    const indirect = /(?:bilirəm|bilirik|bilirsiniz|öyrəndim|izah etdi|dedi)[)”»"]?$/i.test(lastSentence)
      && !/(?:^|\s)nə\s+bilirik$/iu.test(lastSentence);
    const exclamation = /^nə (?:gözəl|yaxşı|pis|qəribə)\s/i.test(lastSentence);
    const discourseMarker = /^nə isə(?:\s|$)/i.test(lastSentence);
    const explicitQuestion = /^(?:[^,]+,\s*)?(?:(?:necə|niyə|nə vaxt|harada|hara|hansı|kim|nə)\s|(?:nədir|kimdir|kimsən|necəsən|necəsiniz)$)/i.test(lastSentence);
    const alternativeQuestion = /,\s*yoxsa\s+[^.!?]+$/iu.test(lastSentence);
    const tagQuestion = /,\s*düzdür$/iu.test(lastSentence);
    const question = !indirect && !exclamation && !discourseMarker && (explicitQuestion || alternativeQuestion || tagQuestion || detectQuestion(lastSentence));
    result = question && !detectExclamation(result) ? result + '?' : terminalPunctuation(result);
  }
  return capitalize(result);
}

function enumerate(line: string): string[] {
  // Require explicit numeric markers 1) ... 2) ... or ordinal transition words
  // followed by punctuation. Bare "birinci sinif" is never turned into a list.
  const numeric = [...line.matchAll(/(?:^|\s)(\d{1,2})[.)]\s+/g)];
  const ordinals = [...line.matchAll(/(?:^|\s)(birinci|ikinci|üçüncü|dördüncü|beşinci)[:,]\s+/gi)];
  const matches = numeric.length >= 2 ? numeric : ordinals;
  if (matches.length < 2) return [line];
  const order = ['birinci', 'ikinci', 'üçüncü', 'dördüncü', 'beşinci'];
  if (!matches.every((match, index) => (numeric.length >= 2
    ? Number(match[1]) : order.indexOf(match[1].toLocaleLowerCase('az-AZ')) + 1) === index + 1)) return [line];
  const prefix = line.slice(0, matches[0].index).trim().replace(/[.:]$/, '');
  const items = matches.map((match, index) => {
    const start = match.index! + match[0].length;
    const end = matches[index + 1]?.index ?? line.length;
    return `${index + 1}. ${line.slice(start, end).trim().replace(/[;,]$/, '')}`;
  });
  return prefix ? [prefix + ':', ...items] : items;
}

/** Deterministic, bounded, synchronous editor; no fetch, model or environment access. */
export function correctText(input: string, preserveFormatting = false, runtime: CorrectionRuntime = {}): LocalCorrection {
  if (!input.trim()) throw new Error('Mətn boş ola bilməz.');
  if (input.length > MAX_TEXT_LENGTH) throw new Error('Mətn maksimum 10 000 simvol ola bilər.');
  const services = runtime.services ?? languageServices;
  const restoreWord = (word: string) => isCanonicalEntity(word) || /^eləmi$/iu.test(word) ? word : services.spelling.resolve(word, services);
  const protectedText: string[] = [];
  // Reserve an unused delimiter; user-supplied private-use characters cannot
  // accidentally collide with our placeholders.
  let marker = '\uE000';
  while (input.includes(marker)) marker += '\uE000';
  const protect = (value: string) => `${marker}${protectedText.push(value) - 1}\uE001`;
  // Attribute values (including ?id=7) are markup, not sentence punctuation.
  let text = input.replace(/```[\s\S]*?```|`[^`\n]*`|<\/?[A-Za-z][^<>\n]*?>|https?:\/\/[^\s<>]+|\bas is\b|\bto be\b|\bchess comda\b|\b[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}\b|\b\d+(?:[.,:\/-]\d+)+(?:%|\b)|\b(?:www\.[\w.-]+|[\w-]+\.(?:com|org|net|az))\b|\b(?:dr|prof|dos|müh)\.(?=\s)|\b[A-Za-z]+[A-Za-z0-9]*[_/][\w/.-]+\b/gi, value => {
    if (/^chess comda$/i.test(value)) return protect('Chess.com-da');
    if (/^https?:/.test(value)) {
      const suffix = value.match(/[.,!?;:]+$/)?.[0] ?? '';
      return protect(suffix ? value.slice(0, -suffix.length) : value) + suffix;
    }
    return protect(value);
  });
  text = text.replace(/\r\n?/g, '\n').normalize('NFC');
  text = prepareTechnicalPhrases(text);
  // Numeric/date/version values take Azerbaijani suffixes with a hyphen.
  text = text
    .replace(/(\d{1,2}:\d{2})\s+(da|də|dan|dən|a|ə)(?=$|[^\p{L}])/giu, '$1-$2')
    .replace(/(\d+(?:\.\d+){1,3})\s+(da|də|dan|dən|a|ə)(?=$|[^\p{L}])/giu, '$1-$2')
    .replace(/(\d{1,2})\s+(e|ə)(?=$|[^\p{L}])/giu, '$1-ə');
  // Keep lexical terminology visible to clause rules. Only punctuation-bearing
  // terms need opaque spans; spelling resolution already protects lexical terms.
  text = protectKnownTerminology(text, canonical =>
    /[.#]/u.test(canonical) || canonical === 'npm' ? protect(canonical) : canonical);
  text = protectMultiwordEntities(text, protect);
  text = resolveEntitiesInText(text);
  // Type names are identifiers, not Azerbaijani prose (integer must not become
  // dotted-capital İnteger at the beginning of a generated sentence).
  text = text.replace(/(?<![\p{L}\p{N}_])(?:integer|string|protobuf)(?![\p{L}\p{N}_])/giu, protect);
  text = beforeLexicalCorrection(text);
  text = prepareTechnicalPhrases(text);
  text = text.replace(/(^|[^\p{L}])bes(?=\s+(?:sen|sən|siz|biz|o)(?=$|[^\p{L}]))/giu, '$1bəs');
  // A conjunction versus a location is distinguished only in these explicit
  // predicates; "kitab məndədir" and "məndə kitab var" remain intact.
  text = text.replace(/(^|[^\p{L}])(mende|məndə)\s+(yaxsiyam|yaxşıyam|pisem|pisəm)(?=$|[^\p{L}])/giu,
    '$1mən də $3');
  text = text.replace(/[A-Za-zƏəÇçĞğİıÖöŞşÜü]+(?:[-’'][A-Za-zƏəÇçĞğİıÖöŞşÜü]+)*/g, word => {
    const attachedQuestion = word.match(/^([\p{L}]+(?:dır|dir|dur|dür))(mı|mi|mu|mü)$/iu);
    if (attachedQuestion) {
      const base = restoreWord(attachedQuestion[1]);
      if (base !== attachedQuestion[1]) {
        const vowel = [...base.toLocaleLowerCase('az-AZ')].reverse().find(letter => /[aəeıioöuü]/u.test(letter));
        const harmony: Record<string, string> = { a: 'mı', ı: 'mı', e: 'mi', ə: 'mi', i: 'mi', o: 'mu', u: 'mu', ö: 'mü', ü: 'mü' };
        return base + (vowel ? harmony[vowel] : attachedQuestion[2]);
      }
    }
    const corrected = restoreWord(word);
    const replacement = corrected !== word || !word.includes('-') ? corrected : word.split('-').map(restoreWord).join('-');
    if (runtime.trace && replacement !== word) runtime.trace({ stage: 'spelling', original: word, replacement, reason: 'language-service spelling resolution' });
    return replacement;
  });
  text = repairPhrases(text);
  text = extendedPhrases(text);
  text = expositoryPhrases(text);
  text = businessPhrases(text);
  text = technicalPhrases(text);
  if (!preserveFormatting) text = businessLayout(text);
  const lines = text.split('\n').flatMap(line => {
    if (preserveFormatting) return [line];
    return enumerate(line);
  });
  text = lines.map((line, index) => {
    if (index > 0 && /^hörmətlə[,!.]?$/i.test(lines[index - 1].trim())) return capitalize(line.trim());
    if (line.includes(marker) && line.trim().startsWith(marker)) {
      const index = Number(line.trim().slice(marker.length).split('\uE001')[0]);
      if (protectedText[index]?.startsWith('`') && line.trim() === `${marker}${index}\uE001`) return line;
    }
    const list = line.match(/^(\s*(?:[-*]|\d+[.)])\s+)(.*)$/);
    // A line that explicitly starts with a number is already an unambiguous
    // list item, including when each item was entered on a separate line.
    const normalizedPrefix = list?.[1].replace(/^(\s*\d+)[.)]\s+$/, '$1. ');
    if (list) {
      let item = punctuate(list[2]);
      // All-caps technical list items (for example "API") are headings only
      // outside lists; inside a list they still need terminal punctuation.
      if (!/[.!?:;…]["”»)]?$/u.test(item)) item += '.';
      return normalizedPrefix! + item;
    }
    return punctuate(line);
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!preserveFormatting) {
    text = businessStageLists(text);
    text = narrativeParagraphs(text);
    text = text.replace(/([.!?]) +(?=(?:Bundan əlavə|Digər tərəfdən|Nəticə olaraq)(?:\s|$))/g, '$1\n\n');
    if (!/\n\s*\n/u.test(input)) text = segmentParagraphs(text);
  }
  text = text.split(marker).map((part, index) => {
    if (!index) return part;
    const end = part.indexOf('\uE001');
    return end < 0 ? marker + part : protectedText[Number(part.slice(0, end))] + part.slice(end + 1);
  }).join('');
  // "gul" is otherwise ambiguous; a flower laid at the martyrs' memorial is unambiguous.
  text = text.replace(/(Şəhidlər xiyabanında\s+)gul(?=\s+qoyduq(?:$|[^\p{L}]))/giu, '$1gül');
  // Numeric values are protected during lexical correction, so attach
  // Azerbaijani case suffixes only after restoring the protected span.
  text = text
    .replace(/(\d{1,2}:\d{2})\s+(da|də|dan|dən|a|ə)(?=$|[^\p{L}])/giu, '$1-$2')
    .replace(/(\d+(?:\.\d+){1,3})\s+(da|də|dan|dən|a|ə)(?=$|[^\p{L}])/giu, '$1-$2')
    .replace(/(\d{1,2})\s+(e|ə)(?=$|[^\p{L}])/giu, '$1-ə');
  // Word/punctuation change estimate via common prefix/suffix; never advertised
  // as a linguistic error count. This is linear even for 10k-character inputs.
  const before = input.match(/\S+/g) ?? [];
  const after = text.match(/\S+/g) ?? [];
  let prefix = 0;
  while (prefix < Math.min(before.length, after.length) && before[prefix] === after[prefix]) prefix++;
  let suffix = 0;
  while (suffix < Math.min(before.length, after.length) - prefix && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix++;
  return { text, corrections: input === text ? 0 : Math.max(1, Math.max(before.length, after.length) - prefix - suffix) };
}

export function formatEmail(input: string): LocalCorrection {
  if (!input.trim()) throw new Error('Mətn boş ola bilməz.');
  if (input.length > MAX_TEXT_LENGTH) throw new Error('Mətn maksimum 10 000 simvol ola bilər.');
  const document = parseEmailSections(input);
  const subject = document.subject
    ? correctText(document.subject, true).text.replace(/[.!?]+$/u, '')
      .replace(/\babb\b/giu, 'ABB').replace(/\b(?:it|İt)\b/gu, 'IT')
      .replace(/\b(?:sla|Sla)\b/gu, 'SLA').replace(/\b(?:hr|Hr)\b/gu, 'HR')
    : 'Müraciət';
  const greeting = document.salutation?.type === 'honorific'
    ? correctText(`Hörmətli ${document.salutation.addressee}`, true).text
      .replace(/[,.!?]+$/u, '')
      .replace(/^(Hörmətli\s+)(\p{L}+)(\s+(?:xanım|bəy))$/iu,
        (_, title: string, name: string, suffix: string) => title + name[0].toLocaleUpperCase('az-AZ') + name.slice(1) + suffix) + ','
    : 'Salam,';
  // A compact draft needs the same sentence and paragraph segmentation as
  // prose; explicit user line breaks still take priority in a structured mail.
  let body = document.body ? correctText(prepareEmailBody(document.body), /\n/u.test(document.body)).text : '';
  if (body) {
    const inferred = prepareEmailBody(body);
    if (inferred !== body) body = correctText(inferred, true).text;
    if (!/\n/u.test(document.body)) body = segmentParagraphs(body);
  }
  // Names and job titles are structural signature text, never prose: preserve
  // their line breaks and never add sentence-ending punctuation to them.
  const signature = document.signature?.replace(/\b((?:Sanan|Sənan)\s+(?:Nabizada|Nabizadə))\s+(biznes analitik)(?=$|\s)/iu,
    '$1\n$2').split('\n').map(line => line.trim().replace(/\p{L}+/gu,
    word => resolveEntityWord(word, true, false) ?? word).replace(/^(\p{L})/u,
    letter => letter.toLocaleUpperCase('az-AZ'))).join('\n');
  const text = [`Mövzu: ${subject}`, greeting, body,
    signature ? `${document.closing ?? 'Hörmətlə,'}\n${signature}` : document.closing ?? 'Hörmətlə,'].filter(Boolean).join('\n\n');
  return { text, corrections: text === input ? 0 : 1 };
}
