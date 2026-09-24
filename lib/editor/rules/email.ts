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

export interface EmailSections {
  subject?: string;
  salutation?: string;
  body: string;
  closing?: string;
  signature?: string;
}

/** Parse explicit mail structure before editing prose. A missing addressee is
 * never inferred from the body, and a signature is never fed to punctuation. */
export function parseEmailSections(input: string): EmailSections {
  let remaining = separateEmailSections(input);
  let subject: string | undefined;
  const heading = remaining.match(/^\s*(?:mövzu|movzu):\s*([^\n]+)(?:\n+|$)/iu);
  if (heading) {
    subject = heading[1].trim();
    remaining = remaining.slice(heading[0].length).trim();
  }
  let signature: string | undefined;
  let closing: string | undefined;
  const farewell = remaining.match(/(?:^|\n+)(?:hörmətlə|hormetle)[,.]?\s*(?:\n([^\n]+))?\s*$/iu);
  if (farewell && farewell.index !== undefined) {
    closing = 'Hörmətlə,';
    signature = farewell[1]?.trim();
    remaining = remaining.slice(0, farewell.index).trim();
  }
  let salutation: string | undefined;
  const hello = remaining.match(/^\s*(salam)[,!.]?\s*(?:\n+|(?=\p{L}))/iu);
  const honorific = remaining.match(/^\s*((?:hörmətli|hormetli)\s+.+?\s+(?:xanım|xanim|bəy|bey))[,!.]?\s*(?:\n+|(?=\p{L}))/iu);
  const greeting = hello ?? honorific;
  if (greeting) {
    salutation = greeting[1].trim();
    remaining = remaining.slice(greeting[0].length).trim();
  }
  return { subject, salutation, body: remaining, closing, signature };
}
