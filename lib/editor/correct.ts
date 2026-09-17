import { restoreWord } from './lexicon';
import { repairPhrases, sentenceBoundaries } from './context';

export const MAX_TEXT_LENGTH = 10_000;
export interface LocalCorrection { text: string; corrections: number }

function capitalize(text: string): string {
  return text.replace(/(^|[.!?]\s+|\n(?:\d+[.)]|[-*])\s+)([a-zəçğıöşü])/g,
    (_, prefix: string, letter: string) => prefix + letter.toLocaleUpperCase('az-AZ'));
}

function punctuate(line: string): string {
  if (!line.trim()) return '';
  if (/^salam,$/i.test(line.trim())) return 'Salam,';
  if (/^mövzu:/i.test(line.trim())) return capitalize(line.trim());
  if (/^hörmətlə[,!.]?$/i.test(line.trim())) return 'Hörmətlə,';
  let result = line.replace(/[\t ]+/g, ' ').trim()
    .replace(/([,;:!?])\1+/g, '$1')
    .replace(/([!?])[.,]+/g, '$1')
    .replace(/\s+\./g, '.')
    .replace(/\.(?=[A-Za-zƏəÇçĞğİıÖöŞşÜü])/g, '. ')
    .replace(/\s+([,;:!?])/g, '$1')
    .replace(/([,;:!?])(?=[a-zA-ZəƏçÇğĞıİöÖşŞüÜ])/g, '$1 ');
  result = sentenceBoundaries(result);
  // Only well-defined conversational patterns are split; no guessed sentence
  // boundary before every pronoun or arbitrary verb.
  result = result
    .replace(/^(salam)\s+(?=[a-zəçğıöşü])/i, '$1, ')
    .replace(/(^|\s|,)(necəsən|necəsiniz)(?=\s|$)/gi, '$1$2?')
    .replace(/([^,;.!?:\s])\s+(amma|lakin|ancaq|çünki)\s+/gi, '$1, $2 ');
  if (!/[.!?:;…]["”»)]?$/.test(result)) {
    const lastSentence = result.split(/[.!?]\s+/).at(-1) ?? result;
    result += /^(?:[^,]+,\s*)?(?:(?:necə|niyə|nə vaxt|harada|hara|hansı|kim|nə)\s|(?:nədir|kimdir|kimsən)$)/i.test(lastSentence) ? '?' : '.';
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
  let text = input.replace(/```[\s\S]*?```|`[^`\n]*`|https?:\/\/[^\s<>]+|\b[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}\b|\b\d+(?:[.:\/-]\d+)+(?:%|\b)|\b(?:www\.[\w.-]+|[\w-]+\.(?:com|org|net|az))\b|\b(?:dr|prof|dos|müh)\.(?=\s)|\b[A-Za-z]+[A-Za-z0-9]*[_/][\w/.-]+\b/gi, value => {
    if (/^https?:/.test(value)) {
      const suffix = value.match(/[.,!?;:]+$/)?.[0] ?? '';
      return protect(suffix ? value.slice(0, -suffix.length) : value) + suffix;
    }
    return protect(value);
  });
  text = text.replace(/\r\n?/g, '\n').normalize('NFC');
  // A conjunction versus a location is distinguished only in these explicit
  // predicates; "kitab məndədir" and "məndə kitab var" remain intact.
  text = text.replace(/(^|[^\p{L}])(mende|məndə)\s+(yaxsiyam|yaxşıyam|pisem|pisəm)(?=$|[^\p{L}])/giu,
    '$1mən də $3');
  text = text.replace(/[A-Za-zƏəÇçĞğİıÖöŞşÜü]+/g, restoreWord);
  text = repairPhrases(text);
  const lines = text.split('\n').flatMap(line => {
    if (preserveFormatting) return [line];
    return enumerate(line);
  });
  text = lines.map(line => {
    if (line.includes(marker) && line.trim().startsWith(marker)) {
      const index = Number(line.trim().slice(marker.length).split('\uE001')[0]);
      if (protectedText[index]?.startsWith('```') && line.trim() === `${marker}${index}\uE001`) return line;
    }
    const list = line.match(/^(\s*(?:[-*]|\d+[.)])\s+)(.*)$/);
    return list ? list[1] + punctuate(list[2]) : punctuate(line);
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!preserveFormatting) {
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
