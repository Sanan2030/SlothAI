import artifact from './log-ocr-model.json';

const mappings: Readonly<Record<string, string>> = artifact.mappings;
const targets = new Set(Object.values(mappings).flatMap(value => value.split(' ')));
export const isOCRSurface = (word: string): boolean => targets.has(word.toLocaleLowerCase('az-AZ'));

/** Recognize generic organizational labels, never prose, Markdown or code.
 * At least three short labels and two department/division markers are required.
 * Malformed/truncated unknown tokens are retained instead of guessed. */
export function isOCRLabelList(input: string): boolean {
  if (/```|~~~|<\/?[A-Za-z]|https?:\/\/|\S+@\S+|(?:^|\n)\s*(?:#{1,6}\s|[-*+]\s|\|)/u.test(input)) return false;
  const lines = input.split(/\r?\n/u).map(line => line.trim()).filter(Boolean);
  return lines.length >= 3 && lines.every(line => line.length <= 180 && !/[.!?]$/u.test(line))
    && lines.filter(line => /departament|[;sşSŞ59]öb|#basi/u.test(line)).length >= 2;
}

export function repairOCRTokens(input: string): string {
  let text = input;
  for (const phrase of artifact.phrases) text = text.replace(new RegExp('(?<![\\p{L}])' + phrase.input + '(?![\\p{L}])', 'giu'), phrase.target);
  return text.replace(/\S+/gu, raw => {
    const target = mappings[raw.normalize('NFC').toLocaleLowerCase('az-AZ')];
    if (!target) return raw;
    return target;
  });
}

/** OCR sometimes separates the last word of a label by a blank line. Only
 * explicit continuation markers join; arbitrary author paragraphs survive. */
export function editOCRLabels(input: string, edit: (value: string) => string): string | undefined {
  if (!isOCRLabelList(input)) return undefined;
  const normalized = repairOCRTokens(input).replace(/([^\n]+)\n[ \t]*\n[ \t]*(departamenti|şöbəsi)(?=\s*(?:\n|$))/gu, '$1 $2')
    .replace(/([^\n]+ və)\n[ \t]*\n[ \t]*([^\n]+şöbəsi)(?=\s*(?:\n|$))/gu, '$1 $2')
    .replace(/(korporativ sosial)\n[ \t]*\n[ \t]*(məsuliyyət)/gu, '$1 $2');
  return normalized.split(/(\r?\n)/u).map(value => {
    if (!value.trim()) return value;
    const leading = value.match(/^[ \t]*/u)![0], trailing = value.match(/[ \t]*$/u)![0];
    const body = value.trim();
    if (/\b(?:filiall|filialı)$/u.test(body)) return leading + body.replace(/filiall$/u, 'filialı') + trailing;
    if (/^(?:ending|'ayments|Ümumi Pba|Ylélm(?:\s|$))/u.test(body)) return value;
    // English product/team labels are outside Azerbaijani spelling training.
    if (/\b(?:tribe|squad|Squad|Tribe|Payments|Accounts|COE)\b/u.test(body)) return value;
    const result = edit(body);
    return leading + result.replace(/[.!?]+$/u, '') + trailing;
  }).join('');
}
