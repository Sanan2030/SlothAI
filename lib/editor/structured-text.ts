/** A lossless block/inline scanner: syntax is never handed to spelling rules. */
export function editStructuredText(input: string, edit: (text: string) => string, preserveLists = false): string | undefined {
  const lines = input.split(/(\r?\n)/u);
  if (!/(?:^|\n)[ \t]{0,3}(?:#{1,6}\s|>\s?|(?:[-+*])\s|`{3,}|~{3,}|\|)|\[[^\]\n]+\]\([^\n]+\)|(?:^|\n)[*_]{1,3}\p{L}/u.test(input) && !(preserveLists && /(?:^|\n)[ \t]*\d+[.)]\s/u.test(input))) return undefined;
  let fence: { char: string; size: number } | undefined;
  const fragment = (value: string, terminal: boolean) => {
    if (!value.trim() || !/\p{L}/u.test(value)) return value;
    const leading = value.match(/^\s*/u)![0], trailing = value.match(/\s*$/u)![0];
    const body = value.slice(leading.length, value.length - trailing.length);
    const labeled = body.replace(/(!?\[)([^\]\n]+)(\]\((?:[^()\n]|\([^()\n]*\))*\))/gu,
      (_, open: string, label: string, close: string) => open + edit(label).replace(/[.!?]+$/u, '') + close);
    let result = edit(labeled).replace(/^([*_]{1,3})(\p{Ll})/u,
      (_, mark: string, letter: string) => mark + letter.toLocaleUpperCase('az-AZ'));
    if (!terminal && !/[.!?…]["”»)]?$/u.test(body)) result = result.replace(/[.!?]+$/u, '');
    return leading + result + trailing;
  };
  const tableLine = (line: string): string => {
    let result = '', start = 0, codeSize = 0;
    for (let at = 0; at <= line.length; at++) {
      if (line[at] === '\\') { at++; continue; }
      if (line[at] === '`') {
        const length = line.slice(at).match(/^`+/u)![0].length;
        if (!codeSize) codeSize = length; else if (length === codeSize) codeSize = 0;
        at += length - 1; continue;
      }
      if (at === line.length || line[at] === '|' && !codeSize) {
        result += fragment(line.slice(start, at), false) + (at < line.length ? '|' : ''); start = at + 1;
      }
    }
    return result;
  };
  for (let at = 0; at < lines.length; at += 2) {
    const line = lines[at];
    const marker = line.match(/^[ \t]{0,3}(`{3,}|~{3,})(.*)$/u);
    if (fence) {
      if (marker && marker[1][0] === fence.char && marker[1].length >= fence.size && !marker[2].trim()) fence = undefined;
      continue;
    }
    if (marker) { fence = { char: marker[1][0], size: marker[1].length }; continue; }
    if (!line.trim() || /^(?: {4}|\t)/u.test(line)
      || /^[ \t]*(?:[-*_][ \t]*){3,}$/u.test(line)
      || /^[ \t]*\|?[ \t]*:?-{3,}:?[ \t]*(?:\|[ \t]*:?-{3,}:?[ \t]*)+\|?[ \t]*$/u.test(line)
      || /^\s*\[[^\]]+\]:\s*\S+/u.test(line)) continue;
    const table = line.includes('|') && (lines[at + 2]?.match(/^[ \t]*\|?[ \t]*:?-{3,}/u)
      || at > 1 && lines[at - 2].includes('|'));
    if (table) { lines[at] = tableLine(line); continue; }
    const heading = line.match(/^([ \t]{0,3}#{1,6}[ \t]+)(.*?)([ \t]+#+[ \t]*)?$/u);
    if (heading) { lines[at] = heading[1] + fragment(heading[2], false) + (heading[3] ?? ''); continue; }
    const setext = /^[ \t]*(?:={3,}|-{3,})[ \t]*$/u.test(lines[at + 2] ?? '');
    if (setext) { lines[at] = fragment(line, false); continue; }
    if (/^[ \t]*(?:={3,}|-{3,})[ \t]*$/u.test(line)) continue;
    const prefix = line.match(/^([ \t]*(?:>[ \t]*)*(?:(?:[-+*]|\d+[.)])[ \t]+(?:\[[ xX]\][ \t]+)?)?)(.*)$/u)!;
    lines[at] = prefix[1] + fragment(prefix[2], true);
  }
  return lines.join('');
}
