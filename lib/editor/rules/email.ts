/** Recognize email sections before prose punctuation; never infer a name. */
export function separateEmailSections(input: string): string {
  let text = input.replace(/\r\n?/gu, '\n');
  // An explicit closing marks the end of prose even in a single-line draft.
  text = text.replace(/(?:^|\s)(?:hormetle|hörmətlə)[,.]?(?:[ \t]+([^\n]+))?\s*$/iu,
    (_, signature: string | undefined) => '\n\nHörmətlə,' + (signature ? '\n' + signature.trim().replace(/(^|\s)(\p{L})/gu, (_m, space: string, letter: string) => space + letter.toLocaleUpperCase('az-AZ')) : ''));
  text = text.replace(/^\s*(?:movzu|mövzu):[ \t]*([^\n]+?)[ \t]+(?=(?:salam|hormetli|hörmətli)(?:\s|,))/iu, 'Mövzu: $1\n\n');
  text = text.replace(/(^|\n)(?:hormetli|hörmətli)\s+([^\n,.!?]+?\s+(?:bey|bəy|xanim|xanım)|(?:komanda|hemkarlar|həmkarlar|terefdaslar|tərəfdaşlar|musteri|müştəri))[, \t]+/giu,
    (_, prefix: string, addressee: string) => prefix + 'Hörmətli ' + addressee.replace(/(^|\s)(\p{L})/u, (_m, space: string, letter: string) => space + letter.toLocaleUpperCase('az-AZ')) + ',\n\n');
  return text.trim();
}
