import { restoreWord } from './lexicon';
import { repairPhrases, sentenceBoundaries } from './context';
import { punctuateNarrative, narrativeParagraphs } from './narrative';
import { beforeLexicalCorrection, extendedPhrases, extendedBoundaries } from './extended-narrative';
import { expositoryPhrases, punctuateExpository } from './expository';
import { businessPhrases, punctuateBusiness, businessLayout, businessStageLists } from './business';
import { prepareTechnicalPhrases, technicalPhrases, punctuateTechnical } from './technical';

export const MAX_TEXT_LENGTH = 10_000;
export interface LocalCorrection { text: string; corrections: number }

function capitalize(text: string): string {
  return text.replace(/(^[“«"(]?|[.!?]\s+[“«"(]?|\n(?:\d+[.)]|[-*])\s+)([a-zəçğıöşü])/g,
    (_, prefix: string, letter: string) => prefix + letter.toLocaleUpperCase('az-AZ'));
}

function punctuate(line: string): string {
  if (!line.trim()) return '';
  if (/^salam,$/i.test(line.trim())) return 'Salam,';
  if (/^mövzu:/i.test(line.trim())) return capitalize(line.trim());
  if (/^hörmətlə[,!.]?$/i.test(line.trim())) return 'Hörmətlə,';
  if (/^hörmətli [^.!?]+,$/i.test(line.trim())) return capitalize(line.trim());
  let result = line.replace(/[\t ]+/g, ' ').trim()
    .replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')
    .replace(/([,;:!?])\1+/g, '$1')
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
  // Only well-defined conversational patterns are split; no guessed sentence
  // boundary before every pronoun or arbitrary verb.
  result = result
    .replace(/^(salam)\s+(?=[a-zəçğıöşü])/i, '$1, ')
    .replace(/(^|^salam,\s*|[.!?]\s+)(necəsən|necəsiniz)(?=\s+(?:mən|sən|biz|siz)\s|$)/gi, '$1$2?')
    .replace(/([^,;.!?:\s])\s+(amma|lakin|çünki)\s+/gi, '$1, $2 ')
    .replace(/([^,;.!?:\s])\s+(ancaq)\s+(?=(?:mən|sən|biz|siz|o)\s)/gi, '$1, $2 ');
  if (!/[.!?:;…]["”»)]?$/.test(result)) {
    const lastSentence = result.split(/[.!?]\s+/).at(-1) ?? result;
    const indirect = /(?:bilirəm|bilirik|bilirsiniz|öyrəndim|izah etdi|dedi)[)”»"]?$/i.test(lastSentence);
    const exclamation = /^nə (?:gözəl|yaxşı|pis|qəribə)\s/i.test(lastSentence);
    const discourseMarker = /^nə isə(?:\s|$)/i.test(lastSentence);
    const question = !indirect && !exclamation && !discourseMarker && /^(?:[^,]+,\s*)?(?:(?:necə|niyə|nə vaxt|harada|hara|hansı|kim|nə)\s|(?:nədir|kimdir|kimsən)$)/i.test(lastSentence);
    result += question ? '?' : '.';
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
export function correctText(input: string, preserveFormatting = false): LocalCorrection {
  if (!input.trim()) throw new Error('Mətn boş ola bilməz.');
  if (input.length > MAX_TEXT_LENGTH) throw new Error('Mətn maksimum 10 000 simvol ola bilər.');
  const protectedText: string[] = [];
  // Reserve an unused delimiter; user-supplied private-use characters cannot
  // accidentally collide with our placeholders.
  let marker = '\uE000';
  while (input.includes(marker)) marker += '\uE000';
  const protect = (value: string) => `${marker}${protectedText.push(value) - 1}\uE001`;
  let text = input.replace(/```[\s\S]*?```|`[^`\n]*`|https?:\/\/[^\s<>]+|\bas is\b|\bto be\b|\bchess comda\b|\b[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}\b|\b\d+(?:[.,:\/-]\d+)+(?:%|\b)|\b(?:www\.[\w.-]+|[\w-]+\.(?:com|org|net|az))\b|\b(?:dr|prof|dos|müh)\.(?=\s)|\b[A-Za-z]+[A-Za-z0-9]*[_/][\w/.-]+\b/gi, value => {
    if (/^chess comda$/i.test(value)) return protect('Chess.com-da');
    if (/^https?:/.test(value)) {
      const suffix = value.match(/[.,!?;:]+$/)?.[0] ?? '';
      return protect(suffix ? value.slice(0, -suffix.length) : value) + suffix;
    }
    return protect(value);
  });
  text = text.replace(/\r\n?/g, '\n').normalize('NFC');
  // Type names are identifiers, not Azerbaijani prose (integer must not become
  // dotted-capital İnteger at the beginning of a generated sentence).
  text = text.replace(/(?<![\p{L}\p{N}_])(?:integer|string|protobuf)(?![\p{L}\p{N}_])/giu, protect);
  text = beforeLexicalCorrection(text);
  text = prepareTechnicalPhrases(text);
  // A conjunction versus a location is distinguished only in these explicit
  // predicates; "kitab məndədir" and "məndə kitab var" remain intact.
  text = text.replace(/(^|[^\p{L}])(mende|məndə)\s+(yaxsiyam|yaxşıyam|pisem|pisəm)(?=$|[^\p{L}])/giu,
    '$1mən də $3');
  text = text.replace(/[A-Za-zƏəÇçĞğİıÖöŞşÜü]+(?:[-’'][A-Za-zƏəÇçĞğİıÖöŞşÜü]+)*/g, word => {
    const corrected = restoreWord(word);
    return corrected !== word || !word.includes('-') ? corrected : word.split('-').map(restoreWord).join('-');
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
    return list ? normalizedPrefix! + punctuate(list[2]) : punctuate(line);
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!preserveFormatting) {
    text = businessStageLists(text);
    text = narrativeParagraphs(text);
    text = text.replace(/([.!?]) +(?=(?:Bundan əlavə|Digər tərəfdən|Nəticə olaraq)(?:\s|$))/g, '$1\n\n');
  }
  text = text.split(marker).map((part, index) => {
    if (!index) return part;
    const end = part.indexOf('\uE001');
    return end < 0 ? marker + part : protectedText[Number(part.slice(0, end))] + part.slice(end + 1);
  }).join('');
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
  // Preserve an existing short signature rather than punctuating a person's
  // name as a prose sentence. Length validation still covers the whole input.
  if (input.length > MAX_TEXT_LENGTH) throw new Error('Mətn maksimum 10 000 simvol ola bilər.');
  const signature = input.match(/(?:^|\n)(?:hörmətlə|hormetle)[,.]?\s*\n([^\n]{1,100})\s*$/iu);
  if (signature) {
    const body = input.slice(0, signature.index).trim();
    if (body) {
      const result = formatEmail(body);
      const name = signature[1].trim().replace(/[A-Za-zƏəÇçĞğİıÖöŞşÜü]+/g, restoreWord);
      return { text: result.text + '\n' + name, corrections: result.corrections };
    }
  }
  const result = correctText(input, true);
  const subjectMatch = result.text.match(/^Mövzu:\s*([^\n]+)\n*/i);
  const subject = subjectMatch ? `Mövzu: ${subjectMatch[1]}` : 'Mövzu: Müraciət';
  let body = subjectMatch ? result.text.slice(subjectMatch[0].length).trim() : result.text;
  let greeting = 'Salam,';
  const greetingMatch = body.match(/^(Salam|Hörmətli[^\n.!?]+)[,.]?\s*(?:\n|$)/i);
  if (greetingMatch) {
    greeting = greetingMatch[1].replace(/[,\s]+$/, '') + ',';
    body = body.slice(greetingMatch[0].length).trim();
  } else if (/^Salam,\s+/i.test(body)) {
    body = body.replace(/^Salam,\s+/i, '');
  }
  body = capitalize(body);
  const hasClosing = /(?:^|\n)Hörmətlə[,.:]?\s*(?:\n[^\n]+)?$/i.test(body);
  const text = [subject, greeting, body, ...(hasClosing ? [] : ['Hörmətlə,'])].filter(Boolean).join('\n\n');
  return { text, corrections: result.corrections + (text === result.text ? 0 : 1) };
}
